import { z } from "zod";
import { dateOnly, dateRange, nonEmpty, uuid } from "@/common/dto/primitives";

export const academicYearDto = z.strictObject({ name: nonEmpty(100), startsOn: dateOnly, endsOn: dateOnly, isDefault: z.boolean().default(false) }).superRefine(dateRange);
export const termDto = z.strictObject({ academicYearId: uuid, name: nonEmpty(100), sequence: z.number().int().positive().max(20), startsOn: dateOnly, endsOn: dateOnly }).superRefine(dateRange);
export const calendarDto = z.strictObject({ campusId: uuid.optional(), academicYearId: uuid, timezone: nonEmpty(64), workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7) });
export const calendarDayDto = z.strictObject({ calendarId: uuid, date: dateOnly, type: z.enum(["WORKING", "HOLIDAY", "EXAM", "EVENT"]), name: nonEmpty(140).optional(), isWorking: z.boolean() });
export const classDto = z.strictObject({ academicYearId: uuid, code: nonEmpty(30), name: nonEmpty(120), level: nonEmpty(30).optional() });
export const sectionDto = z.strictObject({ classId: uuid, code: nonEmpty(30), name: nonEmpty(120), capacity: z.number().int().positive().max(500).optional() });
export const subjectDto = z.strictObject({ code: nonEmpty(30), name: nonEmpty(120) });
export const shiftDto = z.strictObject({ campusId: uuid, code: nonEmpty(30), name: nonEmpty(100), startsAt: z.iso.time(), endsAt: z.iso.time(), graceMinutes: z.number().int().min(0).max(180).default(0) });

export type ClassDto = z.infer<typeof classDto>;
export type SectionDto = z.infer<typeof sectionDto>;
