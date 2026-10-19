import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/config/env";

export type AccessClaims = { userId: string; tenantId: string | null; roleId: string; role: string; permissions: string[]; sessionId: string };

const key = () => new TextEncoder().encode(env().JWT_SECRET);
export const hashOpaqueToken = (token: string): string => createHash("sha256").update(token).digest("hex");
export const newRefreshToken = (): string => randomBytes(48).toString("base64url");

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ tenantId: claims.tenantId, roleId: claims.roleId, role: claims.role, permissions: claims.permissions, sid: claims.sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" }).setSubject(claims.userId).setIssuedAt()
    .setExpirationTime(`${env().ACCESS_TOKEN_TTL_SECONDS}s`).setJti(crypto.randomUUID()).sign(key());
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
  if (!payload.sub || typeof payload.roleId !== "string" || typeof payload.role !== "string" || typeof payload.sid !== "string" || !Array.isArray(payload.permissions)) throw new Error("Invalid access token claims");
  return { userId: payload.sub, tenantId: typeof payload.tenantId === "string" ? payload.tenantId : null, roleId: payload.roleId, role: payload.role, sessionId: payload.sid, permissions: payload.permissions.map(String) };
}
