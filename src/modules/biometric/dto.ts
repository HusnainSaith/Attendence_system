import { z } from "zod";
import { instant, nonEmpty, subjectType, uuid } from "@/common/dto/primitives";

export const consentDto = z.strictObject({ subjectType, subjectId: uuid, purpose: z.literal("BIOMETRIC_ATTENDANCE"), basis: nonEmpty(60), policyVersion: nonEmpty(40), expiresAt: instant.optional(), evidenceRef: z.string().trim().max(500).optional() });
export const consentWithdrawDto = z.strictObject({ reason: nonEmpty(1000) });
export const biometricEnrollmentDto = z.strictObject({ subjectType, subjectId: uuid, consentId: uuid, provider: nonEmpty(60), modality: z.enum(["FINGERPRINT", "FACE"]), captureToken: z.string().min(16).max(2048) });
export const biometricRevokeDto = z.strictObject({ reason: nonEmpty(1000), expectedStatus: z.enum(["PENDING", "ACTIVE", "QUARANTINED"]) });
export const deviceDto = z.strictObject({ campusId: uuid, provider: nonEmpty(60), serialNo: nonEmpty(160), publicKey: z.string().min(32).max(8192), capabilities: z.record(z.string(), z.unknown()).default({}), firmware: z.string().trim().max(80).optional() });
export const deviceCredentialDto = z.strictObject({ keyId: nonEmpty(100), publicMaterial: z.string().min(32).max(8192), notBefore: instant, expiresAt: instant.optional() });
export const deviceAssignmentDto = z.strictObject({ locationId: uuid, purpose: nonEmpty(40), startsAt: instant, endsAt: instant.optional() }).refine((value) => !value.endsAt || value.endsAt > value.startsAt, { path: ["endsAt"], message: "endsAt must be after startsAt" });
export const biometricProfileQueryDto = z.strictObject({ subjectType: subjectType.optional(), subjectId: uuid.optional(), status: z.enum(["PENDING", "ACTIVE", "QUARANTINED", "REVOKED"]).optional() });
export const deviceEventDto = z.strictObject({ eventId: uuid, providerEventRef: nonEmpty(160), subjectType, subjectId: uuid, sessionId: uuid.optional(), eventType: z.enum(["CHECK_IN", "CHECK_OUT", "PRESENCE"]), capturedAt: instant, modality: z.enum(["FINGERPRINT", "FACE"]), confidence: z.number().min(0).max(1).optional(), liveness: z.enum(["PASS", "FAIL", "NOT_APPLICABLE", "UNKNOWN"]).optional(), sequence: z.number().int().nonnegative().optional(), nonce: nonEmpty(200) });
export const offlineBatchDto = z.strictObject({ batchRef: nonEmpty(160), firstSequence: z.number().int().nonnegative(), lastSequence: z.number().int().nonnegative(), events: z.array(deviceEventDto).min(1).max(1000) }).refine((v) => v.lastSequence >= v.firstSequence, { path: ["lastSequence"], message: "lastSequence must be greater than or equal to firstSequence" });

export type DeviceEventDto = z.infer<typeof deviceEventDto>;
export type DeviceDto = z.infer<typeof deviceDto>;
export type ConsentDto = z.infer<typeof consentDto>;
export type BiometricEnrollmentDto = z.infer<typeof biometricEnrollmentDto>;
