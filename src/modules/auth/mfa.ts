import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import type { EntityManager } from "typeorm";
import { env } from "@/config/env";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function encryptionKey(): Buffer {
  const encoded = env().MFA_ENCRYPTION_KEY;
  if (!encoded) throw new Error("MFA encryption is not configured");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("MFA_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return key;
}

export function base32Encode(input: Buffer): string {
  let bits = ""; for (const byte of input) bits += byte.toString(2).padStart(8, "0");
  let output = ""; for (let i = 0; i < bits.length; i += 5) output += alphabet[Number.parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return output;
}

function base32Decode(value: string): Buffer {
  let bits = ""; for (const char of value.replace(/=+$/g, "").toUpperCase()) { const index = alphabet.indexOf(char); if (index < 0) throw new Error("Invalid base32 value"); bits += index.toString(2).padStart(5, "0"); }
  const bytes: number[] = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function encryptMfaSecret(secret: string): Buffer {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptMfaSecret(payload: Buffer): string {
  if (payload.length < 29) throw new Error("Invalid encrypted MFA secret");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
}

export function totp(secret: string, now = Date.now(), stepSeconds = 30): string {
  const counter = Math.floor(now / 1000 / stepSeconds); const buffer = Buffer.alloc(8); buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest(); const offset = digest[digest.length - 1] & 15;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}

export function verifyTotp(secret: string, code: string, now = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  return [-1, 0, 1].some((window) => timingSafeEqual(Buffer.from(totp(secret, now + window * 30_000)), Buffer.from(code)));
}

export async function verifyMfaCode(manager: EntityManager, userId: string, code: string): Promise<boolean> {
  const [factor] = await manager.query(`SELECT encrypted_secret FROM mfa_factors WHERE user_id=$1 AND type='TOTP' AND verified_at IS NOT NULL AND revoked_at IS NULL ORDER BY verified_at DESC LIMIT 1`, [userId]);
  if (factor && /^\d{6}$/.test(code) && verifyTotp(decryptMfaSecret(factor.encrypted_secret), code)) return true;
  const recovery = await manager.query(`SELECT id,code_hash FROM mfa_recovery_codes WHERE user_id=$1 AND used_at IS NULL FOR UPDATE`, [userId]);
  for (const item of recovery) if (await argon2.verify(item.code_hash, code)) { await manager.query(`UPDATE mfa_recovery_codes SET used_at=now() WHERE id=$1`, [item.id]); return true; }
  return false;
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => `${randomBytes(4).toString("hex")}-${randomBytes(4).toString("hex")}`);
}
