import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { AppError, notFound } from "@/common/errors/app-error";
import { env } from "@/config/env";
import { withDatabaseContext } from "@/database/tenant-transaction";
import { sendEmail } from "@/integrations/email/mailer";
import { encryptMfaSecret, base32Encode, generateRecoveryCodes, verifyMfaCode } from "./mfa";
import { hashOpaqueToken } from "./tokens";

const oneTimeToken = () => randomBytes(48).toString("base64url");

export async function inviteUser(actorId: string, tenantId: string | null, input: { email: string; roleId: string; campusId?: string }): Promise<void> {
  const token = oneTimeToken();
  await withDatabaseContext(tenantId ? { tenantId } : { isSuperAdmin: true }, async (manager) => {
    const [role] = await manager.query(`SELECT id FROM roles WHERE id=$1 AND (tenant_id IS NULL OR tenant_id IS NOT DISTINCT FROM $2)`, [input.roleId,tenantId]);
    if (!role) throw notFound();
    await manager.query(`UPDATE user_invitations SET revoked_at=now() WHERE tenant_id IS NOT DISTINCT FROM $1 AND email=$2 AND accepted_at IS NULL AND revoked_at IS NULL`, [tenantId,input.email.toLowerCase()]);
    await manager.query(`INSERT INTO user_invitations(tenant_id,email,role_id,campus_id,token_hash,invited_by,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '48 hours')`, [tenantId,input.email.toLowerCase(),input.roleId,input.campusId ?? null,hashOpaqueToken(token),actorId]);
  });
  await sendEmail({ to: input.email, subject: "Your EduPresence invitation", text: `Accept your invitation: ${env().APP_BASE_URL}/accept-invitation?token=${encodeURIComponent(token)}\nThis link expires in 48 hours.` });
}

export async function acceptInvitation(input: { token: string; password: string; firstName: string; lastName: string }): Promise<void> {
  await withDatabaseContext({ isSuperAdmin: true }, async (manager) => {
    const [invitation] = await manager.query(`SELECT * FROM user_invitations WHERE token_hash=$1 FOR UPDATE`, [hashOpaqueToken(input.token)]);
    if (!invitation || invitation.accepted_at || invitation.revoked_at || new Date(invitation.expires_at) <= new Date()) throw new AppError("INVITATION_INVALID", 422, "Invitation is invalid or expired");
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 });
    const [user] = await manager.query(`INSERT INTO users(email,password_hash,status,email_verified_at) VALUES($1,$2,'ACTIVE',now()) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,status='ACTIVE' RETURNING id`, [invitation.email,passwordHash]);
    await manager.query(`INSERT INTO user_profiles(user_id,first_name,last_name,display_name) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,display_name=excluded.display_name`, [user.id,input.firstName,input.lastName,`${input.firstName} ${input.lastName}`]);
    await manager.query(`INSERT INTO user_roles(tenant_id,user_id,role_id,campus_id,status) SELECT $1,$2,$3,$4,'ACTIVE' WHERE NOT EXISTS(SELECT 1 FROM user_roles WHERE tenant_id IS NOT DISTINCT FROM $1 AND user_id=$2 AND role_id=$3 AND status='ACTIVE')`, [invitation.tenant_id,user.id,invitation.role_id,invitation.campus_id]);
    await manager.query(`UPDATE user_invitations SET accepted_at=now() WHERE id=$1`, [invitation.id]);
  }, "SERIALIZABLE");
}

export async function requestPasswordReset(email: string): Promise<void> {
  const result = await withDatabaseContext({ isSuperAdmin: true }, async (manager) => {
    const [user] = await manager.query(`SELECT id,email FROM users WHERE email=$1 AND status='ACTIVE'`, [email.toLowerCase()]);
    if (!user) return null;
    const token = oneTimeToken();
    await manager.query(`UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL`, [user.id]);
    await manager.query(`INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '30 minutes')`, [user.id,hashOpaqueToken(token)]);
    return { token, email: user.email };
  });
  if (result) await sendEmail({ to: result.email, subject: "Reset your EduPresence password", text: `Reset your password: ${env().APP_BASE_URL}/reset-password?token=${encodeURIComponent(result.token)}\nThis link expires in 30 minutes.` });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await withDatabaseContext({ isSuperAdmin: true }, async (manager) => {
    const [row] = await manager.query(`SELECT * FROM password_reset_tokens WHERE token_hash=$1 FOR UPDATE`, [hashOpaqueToken(token)]);
    if (!row || row.used_at || new Date(row.expires_at) <= new Date()) throw new AppError("RESET_TOKEN_INVALID", 422, "Reset token is invalid or expired");
    const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 });
    await manager.query(`UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1`, [row.user_id,hash]);
    await manager.query(`UPDATE password_reset_tokens SET used_at=now() WHERE id=$1`, [row.id]);
    await manager.query(`UPDATE refresh_sessions SET revoked_at=coalesce(revoked_at,now()) WHERE user_id=$1`, [row.user_id]);
  }, "SERIALIZABLE");
}

export async function beginMfaSetup(userId: string): Promise<{ secret: string; uri: string }> {
  const secret = base32Encode(randomBytes(20));
  const email = await withDatabaseContext({ isSuperAdmin: true }, async (manager) => {
    const [user] = await manager.query(`SELECT email FROM users WHERE id=$1`,[userId]); if (!user) throw notFound();
    await manager.query(`UPDATE mfa_factors SET revoked_at=now() WHERE user_id=$1 AND type='TOTP' AND revoked_at IS NULL`, [userId]);
    await manager.query(`INSERT INTO mfa_factors(user_id,type,encrypted_secret) VALUES($1,'TOTP',$2)`, [userId,encryptMfaSecret(secret)]);
    return user.email;
  });
  return { secret, uri: `otpauth://totp/EduPresence:${encodeURIComponent(email)}?secret=${secret}&issuer=EduPresence&algorithm=SHA1&digits=6&period=30` };
}

export async function confirmMfa(userId: string, sessionId: string, code: string): Promise<string[]> {
  return withDatabaseContext({ isSuperAdmin: true }, async (manager) => {
    const [factor] = await manager.query(`SELECT id,encrypted_secret FROM mfa_factors WHERE user_id=$1 AND type='TOTP' AND verified_at IS NULL AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [userId]);
    if (!factor) throw new AppError("MFA_SETUP_NOT_FOUND", 404, "MFA setup was not found");
    const { decryptMfaSecret, verifyTotp } = await import("./mfa");
    if (!verifyTotp(decryptMfaSecret(factor.encrypted_secret),code)) throw new AppError("MFA_CODE_INVALID", 422, "MFA code is invalid");
    const codes = generateRecoveryCodes();
    await manager.query(`UPDATE mfa_factors SET verified_at=now() WHERE id=$1`, [factor.id]);
    await manager.query(`UPDATE refresh_sessions SET mfa_verified=true WHERE id=$1 AND user_id=$2`,[sessionId,userId]);
    await manager.query(`DELETE FROM mfa_recovery_codes WHERE user_id=$1`, [userId]);
    for (const recovery of codes) await manager.query(`INSERT INTO mfa_recovery_codes(user_id,code_hash) VALUES($1,$2)`, [userId,await argon2.hash(recovery,{type:argon2.argon2id})]);
    return codes;
  }, "SERIALIZABLE");
}

export async function disableMfa(userId: string, password: string, code: string): Promise<void> {
  await withDatabaseContext({ isSuperAdmin: true }, async (manager) => {
    const [user] = await manager.query(`SELECT password_hash FROM users WHERE id=$1`, [userId]);
    if (!user || !await argon2.verify(user.password_hash,password) || !await verifyMfaCode(manager,userId,code)) throw new AppError("AUTH_INVALID_CREDENTIALS",401,"Invalid credentials");
    await manager.query(`UPDATE mfa_factors SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [userId]);
    await manager.query(`DELETE FROM mfa_recovery_codes WHERE user_id=$1`, [userId]);
    await manager.query(`UPDATE refresh_sessions SET revoked_at=coalesce(revoked_at,now()) WHERE user_id=$1`, [userId]);
  }, "SERIALIZABLE");
}
