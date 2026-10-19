import { z } from "zod";
import { dateOnly, instant, nonEmpty, subjectType, uuid } from "@/common/dto/primitives";

export const deviceEventInput = z.object({
  eventId: z.string().uuid(), providerEventRef: z.string().min(1).max(160),
  subjectType: z.enum(["STUDENT", "EMPLOYEE"]), subjectId: z.string().uuid(),
  eventType: z.enum(["CHECK_IN", "CHECK_OUT", "PRESENCE"]),
  capturedAt: z.iso.datetime({ offset: true }), modality: z.enum(["FINGERPRINT", "FACE"]),
  confidence: z.number().min(0).max(1).optional(), sequence: z.number().int().nonnegative().optional(),
});

export const attendancePolicyDto = z.strictObject({
  campusId: uuid.optional(), name: nonEmpty(120), timezone: nonEmpty(64),
  rules: z.strictObject({ lateAfterMinutes: z.number().int().min(0).max(240), absentAfterMinutes: z.number().int().min(0).max(1440), debounceSeconds: z.number().int().min(0).max(3600).default(30), requireCheckOut: z.boolean().default(false) }),
  effectiveFrom: dateOnly, effectiveTo: dateOnly.optional(), status: z.enum(["DRAFT", "ACTIVE"]).default("ACTIVE"),
}).refine((value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, { path: ["effectiveTo"], message: "effectiveTo must not precede effectiveFrom" });

export const attendanceSessionDto = z.strictObject({
  campusId: uuid, academicYearId: uuid, policyId: uuid, sessionDate: dateOnly,
  type: z.enum(["DAILY", "MORNING", "EVENING", "SPECIAL"]), startsAt: instant, closesAt: instant,
  scopes: z.array(z.strictObject({ scopeType: z.enum(["CLASS", "SECTION", "SHIFT", "LOCATION"]), scopeId: uuid })).min(1).max(500),
}).superRefine((value, context) => {
  if (value.closesAt <= value.startsAt) context.addIssue({ code: "custom", path: ["closesAt"], message: "closesAt must be after startsAt" });
  const keys = value.scopes.map((scope) => `${scope.scopeType}:${scope.scopeId}`);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", path: ["scopes"], message: "Session scopes must be unique" });
});

export const manualAttendanceDto = z.strictObject({
  subjectType, subjectId: uuid, status: z.enum(["PRESENT", "LATE", "ABSENT", "LEAVE"]),
  checkInAt: instant.optional(), checkOutAt: instant.optional(), reason: nonEmpty(1000), expectedVersion: z.number().int().positive().optional(),
}).refine((value) => !value.checkInAt || !value.checkOutAt || value.checkOutAt >= value.checkInAt, { path: ["checkOutAt"], message: "checkOutAt must not precede checkInAt" });

export const attendanceSessionQueryDto = z.strictObject({ date: dateOnly.optional(), status: z.enum(["OPEN", "FINALIZED", "LOCKED"]).optional(), campusId: uuid.optional() });
export const leaveTypeDto = z.strictObject({ code: nonEmpty(30), name: nonEmpty(100), paid: z.boolean().optional() });
export const leaveRequestDto = z.strictObject({ subjectType, subjectId: uuid, leaveTypeId: uuid, startsOn: dateOnly, endsOn: dateOnly, partialRule: z.record(z.string(), z.unknown()).optional(), reason: nonEmpty(1000).optional() }).refine((value) => value.endsOn >= value.startsOn, { path: ["endsOn"], message: "endsOn must not precede startsOn" });
export const decisionDto = z.strictObject({ decision: z.enum(["APPROVED", "REJECTED"]), reason: nonEmpty(1000) });
export const attendanceCorrectionDto = z.strictObject({
  expectedVersion: z.number().int().positive(), reasonCode: nonEmpty(60), reasonText: nonEmpty(1000).optional(),
  proposedValues: z.strictObject({ status: z.enum(["PRESENT", "LATE", "ABSENT", "LEAVE"]), checkInAt: instant.nullable().optional(), checkOutAt: instant.nullable().optional() }),
}).refine((value) => !value.proposedValues.checkInAt || !value.proposedValues.checkOutAt || value.proposedValues.checkOutAt >= value.proposedValues.checkInAt, { path: ["proposedValues", "checkOutAt"], message: "checkOutAt must not precede checkInAt" });
export const workflowListQueryDto = z.strictObject({ status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(), subjectType: subjectType.optional(), subjectId: uuid.optional() });
