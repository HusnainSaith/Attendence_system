import { createCipheriv, randomBytes } from "node:crypto";
import { env } from "@/config/env";

function key(): Buffer {
  const encoded = env().BIOMETRIC_ENCRYPTION_KEY;
  if (!encoded) throw new Error("Biometric reference encryption is not configured");
  const value = Buffer.from(encoded, "base64");
  if (value.length !== 32) throw new Error("BIOMETRIC_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return value;
}

export function encryptBiometricReference(reference: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(reference, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), ciphertext]);
}
