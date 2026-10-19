import { z } from "zod";
import { nonEmpty, status, uuid } from "@/common/dto/primitives";

export const createSchoolDto = z.strictObject({ slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/), name: nonEmpty(160), timezone: nonEmpty(64), locale: nonEmpty(16).default("en-PK"), planId: uuid.optional() });
export const updateSchoolDto = createSchoolDto.omit({ slug: true }).partial().strict();
export const schoolStatusDto = z.strictObject({ status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]), reason: nonEmpty(1000) });
export const createCampusDto = z.strictObject({ code: nonEmpty(30), name: nonEmpty(140), address: z.record(z.string(), z.unknown()).default({}) });
export const createLocationDto = z.strictObject({ campusId: uuid, parentId: uuid.optional(), type: z.enum(["CAMPUS", "BUILDING", "FLOOR", "ROOM", "GATE", "ZONE"]), code: nonEmpty(30), name: nonEmpty(140) });
export const createSubscriptionDto = z.strictObject({ planId: uuid, startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }).optional(), metadata: z.record(z.string(), z.unknown()).default({}) });
export const updateCampusDto = createCampusDto.partial().extend({ status: status.optional() }).strict();

export type CreateSchoolDto = z.infer<typeof createSchoolDto>;
export type CreateCampusDto = z.infer<typeof createCampusDto>;
