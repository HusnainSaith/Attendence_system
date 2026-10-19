import { describe, expect, it } from "vitest";
import { biometricEnrollmentDto, consentDto, deviceAssignmentDto, deviceCredentialDto, deviceDto } from "./dto";

describe("biometric and device contracts", () => {
  it("accepts explicit biometric attendance consent", () => expect(consentDto.parse({ subjectType: "STUDENT", subjectId: crypto.randomUUID(), purpose: "BIOMETRIC_ATTENDANCE", basis: "GUARDIAN_CONSENT", policyVersion: "v1" }).purpose).toBe("BIOMETRIC_ATTENDANCE"));
  it("does not allow clients to select the granting user", () => expect(() => consentDto.parse({ subjectType: "STUDENT", subjectId: crypto.randomUUID(), purpose: "BIOMETRIC_ATTENDANCE", basis: "CONSENT", policyVersion: "v1", grantedBy: crypto.randomUUID() })).toThrow());
  it("requires an opaque capture token instead of a template", () => expect(biometricEnrollmentDto.parse({ subjectType: "STUDENT", subjectId: crypto.randomUUID(), consentId: crypto.randomUUID(), provider: "Vendor", modality: "FINGERPRINT", captureToken: "opaque-capture-token-123" }).modality).toBe("FINGERPRINT"));
  it("validates device registration", () => expect(deviceDto.parse({ campusId: crypto.randomUUID(), provider: "Vendor", serialNo: "SN-1", publicKey: "x".repeat(64) }).capabilities).toEqual({}));
  it("rejects reversed credential and assignment ranges", () => { expect(() => deviceCredentialDto.parse({ keyId: "key-1", publicMaterial: "x".repeat(64), notBefore: "2026-01-02T00:00:00Z", expiresAt: "invalid" })).toThrow(); expect(() => deviceAssignmentDto.parse({ locationId: crypto.randomUUID(), purpose: "ENTRY", startsAt: "2026-01-02T00:00:00Z", endsAt: "2026-01-01T00:00:00Z" })).toThrow(/after startsAt/); });
});
