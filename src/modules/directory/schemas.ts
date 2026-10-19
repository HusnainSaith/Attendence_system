import { z } from "zod";

export const schoolInput = z.object({
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(160),
  timezone: z.string().trim().min(3).max(64),
});

export const classInput = z.object({
  academicYearId: z.string().uuid(), code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(120), level: z.string().trim().max(30).optional(),
});
export const sectionInput = z.object({
  classId: z.string().uuid(), code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(120), capacity: z.number().int().positive().max(500).optional(),
});
export const studentInput = z.object({
  admissionNo: z.string().trim().min(1).max(50), firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100), dateOfBirth: z.iso.date(),
});
export const employeeInput = z.object({
  employeeNo: z.string().trim().min(1).max(50), firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100), category: z.enum(["TEACHER", "STAFF", "ADMIN"]),
});
