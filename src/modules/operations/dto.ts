import { z } from "zod";
import { nonEmpty, uuid } from "@/common/dto/primitives";

export const importCreateDto = z.strictObject({ type: z.enum(["STUDENTS", "EMPLOYEES", "ENROLLMENTS"]), objectRef: nonEmpty(500), checksum: z.string().regex(/^[a-f0-9]{64}$/) });
export const importCommitDto = z.strictObject({ idempotencyKey: nonEmpty(200), expectedValidRows: z.number().int().nonnegative() });
export const reportExportDto = z.strictObject({ reportType: nonEmpty(80), filters: z.record(z.string(), z.unknown()), format: z.enum(["PDF", "XLSX", "CSV"]) });
export const notificationPreferenceDto = z.strictObject({ channel: z.enum(["EMAIL", "PUSH", "SMS", "WHATSAPP"]), eventType: nonEmpty(60), enabled: z.boolean(), quietHours: z.strictObject({ startsAt: z.iso.time(), endsAt: z.iso.time(), timezone: nonEmpty(64) }).optional() });
export const privacyRequestDto = z.strictObject({ subjectType: z.enum(["STUDENT", "EMPLOYEE", "GUARDIAN", "USER"]), subjectId: uuid, requestType: z.enum(["ACCESS", "EXPORT", "DELETE", "RESTRICT", "WITHDRAW"]), reason: z.string().trim().max(2000).optional() });
export const notificationQueueDto = z.strictObject({ recipientUserId: uuid, type: nonEmpty(60), channel: z.literal("EMAIL"), subject: nonEmpty(200), text: nonEmpty(10000), scheduledAt: z.iso.datetime({ offset: true }).optional() });
export const notificationListQueryDto = z.strictObject({ status: z.enum(["PENDING", "PROCESSING", "SENT", "FAILED"]).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) });
export const privacyListQueryDto = z.strictObject({ status: z.enum(["PENDING", "APPROVED", "REJECTED", "COMPLETED"]).optional(), requestType: z.enum(["ACCESS", "EXPORT", "DELETE", "RESTRICT", "WITHDRAW"]).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) });
export const privacyDecisionDto = z.strictObject({ decision: z.enum(["APPROVED", "REJECTED"]), reason: nonEmpty(1000) });

export type ReportExportDto = z.infer<typeof reportExportDto>;
