import { z } from "zod";
import { dateOnly, instant, nonEmpty, subjectType, uuid } from "@/common/dto/primitives";

export const attendancePolicyDto = z.strictObject({ campusId: uuid.optional(), name: nonEmpty(120), version: z.number().int().positive(), timezone: nonEmpty(64), rules: z.strictObject({ lateAfterMinutes: z.number().int().min(0).max(360), absentAfterMinutes: z.number().int().min(0).max(1440), debounceSeconds: z.number().int().min(0).max(3600), requireCheckOut: z.boolean().default(false) }), effectiveFrom: dateOnly, effectiveTo: dateOnly.optional() });
export const attendanceSessionDto = z.strictObject({ campusId: uuid, academicYearId: uuid, policyId: uuid, sessionDate: dateOnly, type: z.enum(["DAILY", "CLASS", "SHIFT", "EVENT"]), startsAt: instant, closesAt: instant, scopes: z.array(z.strictObject({ scopeType: z.enum(["CLASS", "SECTION", "SHIFT", "LOCATION"]), scopeId: uuid })).min(1) });
export const manualAttendanceDto = z.strictObject({ subjectType, subjectId: uuid, status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED", "EARLY_DEPARTURE"]), checkInAt: instant.optional(), checkOutAt: instant.optional(), reasonCode: nonEmpty(60), reasonText: nonEmpty(1000) });
export const correctionDto = z.strictObject({ expectedVersion: z.number().int().positive(), reasonCode: nonEmpty(60), reasonText: nonEmpty(1000).optional(), proposedValues: z.strictObject({ status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED", "EARLY_DEPARTURE"]).optional(), checkInAt: instant.optional().nullable(), checkOutAt: instant.optional().nullable() }).refine((value) => Object.keys(value).length > 0, "At least one proposed value is required") });
export const correctionDecisionDto = z.strictObject({ decision: z.enum(["APPROVED", "REJECTED"]), decisionReason: nonEmpty(1000), expectedVersion: z.number().int().positive() });
export const sessionTransitionDto = z.strictObject({ expectedStatus: z.enum(["OPEN", "FINALIZED", "LOCKED"]), reason: nonEmpty(1000).optional() });

export type AttendancePolicyDto = z.infer<typeof attendancePolicyDto>;
export type CorrectionDto = z.infer<typeof correctionDto>;
