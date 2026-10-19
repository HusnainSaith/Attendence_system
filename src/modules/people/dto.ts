import { z } from "zod";
import { dateOnly, dateRange, nonEmpty, subjectType, uuid } from "@/common/dto/primitives";

export const guardianDto = z.strictObject({ firstName: nonEmpty(100), lastName: nonEmpty(100), phone: z.string().trim().min(7).max(32).optional(), email: z.email().max(254).optional(), relationship: nonEmpty(30), isPrimary: z.boolean().default(false), notificationAuthority: z.boolean().default(true) }).refine((value)=>Boolean(value.phone||value.email),{message:"Guardian phone or email is required"});
const guardianContactDto = z.strictObject({firstName:nonEmpty(100),lastName:nonEmpty(100),phone:z.string().trim().min(7).max(32).optional(),email:z.email().max(254).optional()});
export const createGuardianDto = guardianContactDto.refine((value)=>Boolean(value.phone||value.email),{message:"Guardian phone or email is required"});
export const updateGuardianDto = guardianContactDto.partial().refine((value)=>Object.keys(value).length>0,{message:"At least one field is required"});
export const linkGuardianDto = z.strictObject({guardianId:uuid,relationship:nonEmpty(30),isPrimary:z.boolean().default(false),notificationAuthority:z.boolean().default(true)});
export const guardianListQueryDto = z.strictObject({cursor:z.string().max(500).optional(),limit:z.coerce.number().int().min(1).max(100).default(25),status:z.enum(["ACTIVE","INACTIVE","ARCHIVED"]).optional(),search:z.string().trim().max(100).optional()});
export const enrollmentDto = z.strictObject({ academicYearId: uuid, campusId: uuid, classId: uuid, sectionId: uuid, startsOn: dateOnly, endsOn: dateOnly.optional() }).superRefine(dateRange);
export const createStudentDto = z.strictObject({ admissionNo: nonEmpty(50), firstName: nonEmpty(100), lastName: nonEmpty(100), dateOfBirth: dateOnly, sex: z.enum(["FEMALE", "MALE", "OTHER", "UNSPECIFIED"]).optional(), guardian: guardianDto.optional(), enrollment: enrollmentDto.optional() });
export const updateStudentDto = createStudentDto.omit({ admissionNo: true, guardian: true, enrollment: true }).partial();
export const employeeDto = z.strictObject({ employeeNo: nonEmpty(50), categoryId: uuid.optional(), firstName: nonEmpty(100), lastName: nonEmpty(100), joinedOn: dateOnly.optional(), category: z.enum(["TEACHER", "STAFF", "ADMIN"]) });
export const updateEmployeeDto = employeeDto.omit({employeeNo:true}).partial();
export const employeeCategoryDto = z.strictObject({code:nonEmpty(30),name:nonEmpty(100),teaching:z.boolean().default(false)});
export const employeeListQueryDto = z.strictObject({cursor:z.string().max(500).optional(),limit:z.coerce.number().int().min(1).max(100).default(25),status:z.enum(["ACTIVE","INACTIVE","LEFT","ARCHIVED"]).optional(),category:z.enum(["TEACHER","STAFF","ADMIN"]).optional(),search:z.string().trim().max(100).optional()});
export const teacherAssignmentDto = z.strictObject({ employeeId: uuid, campusId: uuid, classId: uuid, sectionId: uuid.optional(), subjectId: uuid.optional(), startsOn: dateOnly, endsOn: dateOnly.optional() }).superRefine(dateRange);
export const transferStudentDto = z.strictObject({ currentEnrollmentId: uuid, campusId: uuid, classId: uuid, sectionId: uuid, effectiveOn: dateOnly, reason: nonEmpty(1000) });
export const promoteStudentsDto = z.strictObject({
  sourceAcademicYearId: uuid,
  sourceSectionId: uuid,
  targetAcademicYearId: uuid,
  targetCampusId: uuid,
  targetClassId: uuid,
  targetSectionId: uuid,
  startsOn: dateOnly,
  studentIds: z.array(uuid).min(1).max(500).optional(),
}).refine((value) => value.sourceAcademicYearId !== value.targetAcademicYearId, {
  message: "Source and target academic years must differ",
  path: ["targetAcademicYearId"],
}).superRefine((value, context) => {
  if (value.studentIds && new Set(value.studentIds).size !== value.studentIds.length) context.addIssue({ code: "custom", message: "Student IDs must be unique", path: ["studentIds"] });
});
export const studentListQueryDto = z.strictObject({ cursor:z.string().max(500).optional(),limit:z.coerce.number().int().min(1).max(100).default(25),status:z.enum(["ACTIVE","INACTIVE","LEFT","ARCHIVED"]).optional(),search:z.string().trim().max(100).optional() });
export const studentImportRowDto = createStudentDto.omit({ guardian: true });
export const employeeImportRowDto = employeeDto;
export const createPeopleImportDto = z.strictObject({
  type: z.enum(["STUDENTS", "EMPLOYEES"]),
  rows: z.array(z.unknown()).min(1).max(1000),
});
export const leaveRequestDto = z.strictObject({ subjectType, subjectId: uuid, leaveTypeId: uuid, startsOn: dateOnly, endsOn: dateOnly, partialRule: z.record(z.string(), z.unknown()).optional(), reason: nonEmpty(1000).optional() }).superRefine(dateRange);

export type CreateStudentDto = z.infer<typeof createStudentDto>;
export type EmployeeDto = z.infer<typeof employeeDto>;
export type PromoteStudentsDto = z.infer<typeof promoteStudentsDto>;
export type CreatePeopleImportDto = z.infer<typeof createPeopleImportDto>;
