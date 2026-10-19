import argon2 from "argon2";
import type { EntityManager } from "typeorm";
import { AppError, forbidden } from "@/common/errors/app-error";
import { env } from "@/config/env";
import { withDatabaseContext } from "@/database/tenant-transaction";
import { hashOpaqueToken, newRefreshToken, signAccessToken } from "./tokens";
import { verifyMfaCode } from "./mfa";

type Grant = { tenant_id: string | null; tenant_slug: string | null; role_id: string; role_code: string; permissions: string[] };
const invalidCredentials = () => new AppError("AUTH_INVALID_CREDENTIALS", 401, "Invalid email or password");
let dummyHash: Promise<string> | undefined;

async function activeGrants(manager: EntityManager, userId: string, tenantSlug?: string): Promise<Grant[]> {
  return manager.query(`SELECT ur.tenant_id,s.slug tenant_slug,r.id role_id,r.code role_code,coalesce(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL AND rp.effect='ALLOW'),'{}') permissions FROM user_roles ur JOIN roles r ON r.id=ur.role_id LEFT JOIN schools s ON s.id=ur.tenant_id LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=$1 AND ur.status='ACTIVE' AND ur.starts_at<=now() AND (ur.ends_at IS NULL OR ur.ends_at>now()) AND ($2::text IS NULL OR s.slug=$2 OR (ur.tenant_id IS NULL AND r.code='SUPER_ADMIN')) GROUP BY ur.tenant_id,s.slug,r.id,r.code`, [userId, tenantSlug ?? null]);
}

async function issueSession(manager: EntityManager, userId: string, grant: Grant, familyId = crypto.randomUUID(), deviceFingerprint?: string, mfaVerified = false) {
  const refreshToken = newRefreshToken();
  const [session] = await manager.query(`INSERT INTO refresh_sessions(user_id,family_id,token_hash,tenant_id,role_id,device_fingerprint,mfa_verified,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+($8||' seconds')::interval) RETURNING id,expires_at`, [userId, familyId, hashOpaqueToken(refreshToken), grant.tenant_id, grant.role_id, deviceFingerprint ?? null, mfaVerified, env().REFRESH_TOKEN_TTL_SECONDS]);
  const accessToken = await signAccessToken({ userId, tenantId: grant.tenant_id, roleId: grant.role_id, role: grant.role_code, permissions: grant.permissions, sessionId: session.id });
  return { accessToken, refreshToken, expiresIn: env().ACCESS_TOKEN_TTL_SECONDS, refreshExpiresAt: session.expires_at, sessionId: session.id };
}

export async function login(input: { email: string; password: string; tenantSlug?: string; mfaCode?: string; deviceFingerprint?: string }, context: { ip?: string; userAgent?: string }) {
  return withDatabaseContext({ isSuperAdmin: true }, async (manager) => {
    const [user] = await manager.query(`SELECT id,password_hash,status FROM users WHERE email=$1 LIMIT 1`, [input.email.toLowerCase()]);
    const hash = user?.password_hash ?? await (dummyHash ??= argon2.hash("not-a-real-password", { type: argon2.argon2id }));
    if (!await argon2.verify(hash, input.password) || !user || user.status !== "ACTIVE") throw invalidCredentials();
    const grants = await activeGrants(manager, user.id, input.tenantSlug);
    if (grants.length === 0) throw forbidden("PERMISSION_DENIED", "No active role is available");
    if (grants.length > 1 && !input.tenantSlug) throw new AppError("TENANT_SELECTION_REQUIRED", 409, "Select a school before signing in");
    const grant = grants[0];
    const privileged = ["SUPER_ADMIN","SCHOOL_OWNER","SCHOOL_ADMIN","CAMPUS_ADMIN","ATTENDANCE_MANAGER"].includes(grant.role_code);
    const [{ configured }] = await manager.query(`SELECT EXISTS(SELECT 1 FROM mfa_factors WHERE user_id=$1 AND verified_at IS NOT NULL AND revoked_at IS NULL) configured`, [user.id]);
    if (configured && (!input.mfaCode || !await verifyMfaCode(manager,user.id,input.mfaCode))) throw new AppError("MFA_REQUIRED", 401, "A valid MFA or recovery code is required");
    const effectiveGrant = privileged && !configured ? { ...grant, permissions: ["mfa:enroll"] } : grant;
    const result = await issueSession(manager, user.id, effectiveGrant, undefined, input.deviceFingerprint, configured);
    await manager.query(`UPDATE users SET last_login_at=now() WHERE id=$1`, [user.id]);
    await manager.query(`INSERT INTO audit_logs(tenant_id,actor_type,actor_id,effective_role,action,resource_type,resource_id,result,ip,user_agent,correlation_id) VALUES($1,'USER',$2,$3,'AUTH_LOGIN','SESSION',$4,'SUCCESS',$5,$6,gen_random_uuid())`, [grant.tenant_id,user.id,grant.role_code,result.sessionId,context.ip ?? null,context.userAgent ?? null]);
    return { ...result, mfaEnrollmentRequired: privileged && !configured, user: { id: user.id, tenantId: grant.tenant_id, tenantSlug: grant.tenant_slug, role: grant.role_code, permissions: effectiveGrant.permissions } };
  }, "SERIALIZABLE");
}

export async function rotateRefreshToken(token: string, deviceFingerprint?: string) {
  const result = await withDatabaseContext({ isSuperAdmin: true }, async (manager) => {
    const [session] = await manager.query(`SELECT * FROM refresh_sessions WHERE token_hash=$1 FOR UPDATE`, [hashOpaqueToken(token)]);
    if (!session) throw invalidCredentials();
    if (session.rotated_at || session.revoked_at) {
      await manager.query(`UPDATE refresh_sessions SET revoked_at=coalesce(revoked_at,now()) WHERE family_id=$1`, [session.family_id]);
      await manager.query(`INSERT INTO security_events(tenant_id,type,severity,principal_type,principal_id,details) VALUES($1,'TOKEN_REUSE_DETECTED','HIGH','USER',$2,$3)`, [session.tenant_id,session.user_id,JSON.stringify({ familyId: session.family_id })]);
      return { reuseDetected: true as const };
    }
    if (new Date(session.expires_at) <= new Date()) throw invalidCredentials();
    if (session.device_fingerprint && deviceFingerprint !== session.device_fingerprint) throw invalidCredentials();
    const grants = await activeGrants(manager, session.user_id);
    const grant = grants.find((value) => value.role_id === session.role_id && value.tenant_id === session.tenant_id);
    if (!grant) throw forbidden();
    const privileged = ["SUPER_ADMIN","SCHOOL_OWNER","SCHOOL_ADMIN","CAMPUS_ADMIN","ATTENDANCE_MANAGER"].includes(grant.role_code);
    if (privileged && !session.mfa_verified) throw new AppError("MFA_REQUIRED",401,"Sign in with MFA to continue");
    const replacement = await issueSession(manager, session.user_id, grant, session.family_id, session.device_fingerprint ?? deviceFingerprint, session.mfa_verified);
    await manager.query(`UPDATE refresh_sessions SET rotated_at=now(),last_used_at=now(),replaced_by_id=$2 WHERE id=$1`, [session.id,replacement.sessionId]);
    return { reuseDetected: false as const, ...replacement };
  }, "SERIALIZABLE");
  if (result.reuseDetected) throw new AppError("TOKEN_REUSE_DETECTED", 401, "Refresh session has been revoked");
  return result;
}

export async function logout(token: string): Promise<void> {
  await withDatabaseContext({ isSuperAdmin: true }, async (manager) => { await manager.query(`UPDATE refresh_sessions SET revoked_at=coalesce(revoked_at,now()) WHERE token_hash=$1`, [hashOpaqueToken(token)]); });
}
