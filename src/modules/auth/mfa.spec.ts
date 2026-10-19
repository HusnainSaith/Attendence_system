import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { resetEnvForTests } from "@/config/env";
import { base32Encode, decryptMfaSecret, encryptMfaSecret, generateRecoveryCodes, totp, verifyTotp } from "./mfa";

beforeEach(() => {
  Object.assign(process.env, { NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@localhost:5432/test", JWT_SECRET: "a-test-secret-with-at-least-thirty-two-characters", MFA_ENCRYPTION_KEY: randomBytes(32).toString("base64") });
  resetEnvForTests();
});

describe("TOTP MFA", () => {
  it("generates and verifies time-bound six-digit codes", () => {
    const secret=base32Encode(Buffer.from("12345678901234567890")); const now=1_700_000_000_000;
    const code=totp(secret,now); expect(code).toMatch(/^\d{6}$/); expect(verifyTotp(secret,code,now)).toBe(true); expect(verifyTotp(secret,code,now+120_000)).toBe(false);
  });
  it("encrypts secrets with authenticated encryption", () => {
    const payload=encryptMfaSecret("SECRET"); expect(payload.toString()).not.toContain("SECRET"); expect(decryptMfaSecret(payload)).toBe("SECRET");
    payload[payload.length-1]^=1; expect(()=>decryptMfaSecret(payload)).toThrow();
  });
  it("creates unique recovery codes", () => { const codes=generateRecoveryCodes(); expect(codes).toHaveLength(10); expect(new Set(codes).size).toBe(10); });
});
