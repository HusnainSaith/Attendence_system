import { forbidden } from "@/common/errors/app-error";
import { withDatabaseContext } from "@/database/tenant-transaction";
import { verifyAccessToken } from "@/modules/auth/tokens";

export type Principal = {
  userId: string;
  tenantId: string | null;
  permissions: string[];
  role: string;
  sessionId: string;
};

export async function authenticate(request: Request): Promise<Principal> {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) throw forbidden("AUTH_REQUIRED", "Authentication required");
  let claims;
  try { claims = await verifyAccessToken(value.slice(7)); }
  catch { throw forbidden("AUTH_INVALID_TOKEN", "Invalid access token"); }
  const active = await withDatabaseContext({ isSuperAdmin: true }, async (manager) => manager.query(`SELECT 1 FROM refresh_sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>now()`, [claims.sessionId,claims.userId]));
  if (active.length === 0) throw forbidden("AUTH_SESSION_REVOKED", "Session is no longer active");
  return {
    userId: claims.userId,
    tenantId: claims.tenantId,
    role: claims.role,
    sessionId: claims.sessionId,
    permissions: claims.permissions,
  };
}

export function requirePermission(principal: Principal, permission: string): void {
  if (!principal.permissions.includes(permission)) throw forbidden();
}

export function requireTenant(principal: Principal): string {
  if (!principal.tenantId) throw forbidden("TENANT_SCOPE_VIOLATION", "Tenant context is required");
  return principal.tenantId;
}
