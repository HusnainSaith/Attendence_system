import { z } from "zod";
import { dateOnly, nonEmpty, uuid } from "@/common/dto/primitives";

const section = z.strictObject({ code: nonEmpty(30), name: nonEmpty(120), capacity: z.number().int().positive().max(500).optional() });
const academicClass = z.strictObject({ code: nonEmpty(30), name: nonEmpty(120), level: nonEmpty(30).optional(), sections: z.array(section).min(1).max(30) });

export const schoolOnboardingDto = z.strictObject({
  school: z.strictObject({ slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/), name: nonEmpty(160), timezone: nonEmpty(64), locale: nonEmpty(16).default("en-PK"), planId: uuid.optional() }),
  principal: z.strictObject({ email: z.email().max(254), firstName: nonEmpty(100), lastName: nonEmpty(100) }),
  campus: z.strictObject({ code: nonEmpty(30), name: nonEmpty(140), address: z.record(z.string(), z.unknown()).default({}) }),
  academicYear: z.strictObject({ name: nonEmpty(100), startsOn: dateOnly, endsOn: dateOnly }),
  classes: z.array(academicClass).min(1).max(50),
  attendancePolicy: z.strictObject({ name: nonEmpty(120).default("Default attendance policy"), lateAfterMinutes: z.number().int().min(0).max(360).default(15), absentAfterMinutes: z.number().int().min(1).max(1440).default(120), debounceSeconds: z.number().int().min(0).max(3600).default(30), requireCheckOut: z.boolean().default(false) }),
}).superRefine((value, context) => {
  if (value.academicYear.endsOn <= value.academicYear.startsOn) context.addIssue({ code: "custom", path: ["academicYear","endsOn"], message: "Academic year must end after it starts" });
  const classCodes = value.classes.map((item) => item.code.toLowerCase());
  if (new Set(classCodes).size !== classCodes.length) context.addIssue({ code: "custom", path: ["classes"], message: "Class codes must be unique" });
  value.classes.forEach((item,index) => { const codes=item.sections.map((entry)=>entry.code.toLowerCase()); if(new Set(codes).size!==codes.length) context.addIssue({code:"custom",path:["classes",index,"sections"],message:"Section codes must be unique within a class"}); });
});

export type SchoolOnboardingDto = z.infer<typeof schoolOnboardingDto>;
