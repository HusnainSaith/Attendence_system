import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { payloadHash, verifyDevicePublicSignature, verifyDeviceSignature } from "./device-auth";

describe("device request authentication", () => {
  const secret = "a-secure-test-secret-that-is-long-enough";
  const body = '{"eventId":"123"}';
  const timestamp = "2026-09-30T08:00:00.000Z";

  it("accepts an authentic request within the replay window", () => {
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    expect(() => verifyDeviceSignature(body, timestamp, signature, secret, Date.parse(timestamp) + 10_000)).not.toThrow();
  });

  it("rejects a modified payload", () => {
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    expect(() => verifyDeviceSignature(`${body} `, timestamp, signature, secret, Date.parse(timestamp))).toThrowError(/invalid/i);
  });

  it("rejects an expired signature", () => {
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    expect(() => verifyDeviceSignature(body, timestamp, signature, secret, Date.parse(timestamp) + 301_000)).toThrowError(/timestamp/i);
  });

  it("hashes payloads deterministically", () => {
    expect(payloadHash(body)).toMatch(/^[a-f0-9]{64}$/);
    expect(payloadHash(body)).toBe(payloadHash(body));
  });
  it("accepts registered asymmetric device signatures",()=>{const{privateKey,publicKey}=generateKeyPairSync("ed25519");const signature=sign(null,Buffer.from(`${timestamp}.${body}`),privateKey).toString("base64");expect(()=>verifyDevicePublicSignature(body,timestamp,signature,publicKey.export({type:"spki",format:"pem"}).toString(),Date.parse(timestamp))).not.toThrow();expect(()=>verifyDevicePublicSignature(`${body} `,timestamp,signature,publicKey.export({type:"spki",format:"pem"}).toString(),Date.parse(timestamp))).toThrow(/invalid/i);});
});
