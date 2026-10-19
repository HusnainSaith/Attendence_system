import { z } from "zod";

export const uuid = z.string().uuid();
export const dateOnly = z.iso.date();
export const instant = z.iso.datetime({ offset: true });
export const nonEmpty = (max: number) => z.string().trim().min(1).max(max);
export const status = z.enum(["DRAFT", "PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED", "INACTIVE"]);
export const subjectType = z.enum(["STUDENT", "EMPLOYEE"]);
export const pageQuery = z.strictObject({ cursor: z.string().max(500).optional(), limit: z.coerce.number().int().min(1).max(100).default(25) });

export function dateRange<T extends { startsOn: string; endsOn?: string | null }>(value: T, context: z.RefinementCtx): void {
  if (value.endsOn && value.endsOn < value.startsOn) context.addIssue({ code: "custom", path: ["endsOn"], message: "endsOn must not be before startsOn" });
}
