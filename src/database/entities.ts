import { EntitySchema } from "typeorm";
import { auxiliaryEntities } from "./entity-catalog";

const base = {
  id: { type: "uuid" as const, primary: true, generated: "uuid" as const },
  createdAt: { name: "created_at", type: "timestamptz" as const, createDate: true },
  updatedAt: { name: "updated_at", type: "timestamptz" as const, updateDate: true },
};

export type School = { id: string; slug: string; name: string; status: string; timezone: string; createdAt: Date; updatedAt: Date };
export const SchoolEntity = new EntitySchema<School>({
  name: "School", tableName: "schools",
  columns: { ...base, slug: { type: "varchar", length: 80, unique: true }, name: { type: "varchar", length: 160 }, status: { type: "varchar", length: 20, default: "PENDING" }, timezone: { type: "varchar", length: 64 } },
});

export type AcademicClass = { id: string; tenantId: string; academicYearId: string; code: string; name: string; level: string | null; status: string; createdAt: Date; updatedAt: Date };
export const ClassEntity = new EntitySchema<AcademicClass>({
  name: "AcademicClass", tableName: "classes",
  columns: { ...base, tenantId: { name: "tenant_id", type: "uuid" }, academicYearId: { name: "academic_year_id", type: "uuid" }, code: { type: "varchar", length: 30 }, name: { type: "varchar", length: 120 }, level: { type: "varchar", length: 30, nullable: true }, status: { type: "varchar", length: 20, default: "ACTIVE" } },
  uniques: [{ columns: ["tenantId", "academicYearId", "code"] }],
});

export type Section = { id: string; tenantId: string; classId: string; code: string; name: string; capacity: number | null; status: string; createdAt: Date; updatedAt: Date };
export const SectionEntity = new EntitySchema<Section>({
  name: "Section", tableName: "sections",
  columns: { ...base, tenantId: { name: "tenant_id", type: "uuid" }, classId: { name: "class_id", type: "uuid" }, code: { type: "varchar", length: 30 }, name: { type: "varchar", length: 120 }, capacity: { type: "int", nullable: true }, status: { type: "varchar", length: 20, default: "ACTIVE" } },
  uniques: [{ columns: ["tenantId", "classId", "code"] }],
});

export type Student = { id: string; tenantId: string; admissionNo: string; firstName: string; lastName: string; dateOfBirth: string; status: string; createdAt: Date; updatedAt: Date };
export const StudentEntity = new EntitySchema<Student>({
  name: "Student", tableName: "students",
  columns: { ...base, tenantId: { name: "tenant_id", type: "uuid" }, admissionNo: { name: "admission_no", type: "varchar", length: 50 }, firstName: { name: "first_name", type: "varchar", length: 100 }, lastName: { name: "last_name", type: "varchar", length: 100 }, dateOfBirth: { name: "date_of_birth", type: "date" }, status: { type: "varchar", length: 20, default: "ACTIVE" } },
  uniques: [{ columns: ["tenantId", "admissionNo"] }],
});

export type Employee = { id: string; tenantId: string; employeeNo: string; firstName: string; lastName: string; category: string; status: string; createdAt: Date; updatedAt: Date };
export const EmployeeEntity = new EntitySchema<Employee>({
  name: "Employee", tableName: "employees",
  columns: { ...base, tenantId: { name: "tenant_id", type: "uuid" }, employeeNo: { name: "employee_no", type: "varchar", length: 50 }, firstName: { name: "first_name", type: "varchar", length: 100 }, lastName: { name: "last_name", type: "varchar", length: 100 }, category: { type: "varchar", length: 50 }, status: { type: "varchar", length: 20, default: "ACTIVE" } },
  uniques: [{ columns: ["tenantId", "employeeNo"] }],
});

export type AttendanceEvent = { id: string; tenantId: string; sessionId: string | null; deviceId: string; providerEventRef: string; subjectType: string; subjectId: string; eventType: string; capturedAt: Date; receivedAt: Date; modality: string; confidence: number | null; sequence: string | null; payloadHash: string; status: string };
export const AttendanceEventEntity = new EntitySchema<AttendanceEvent>({
  name: "AttendanceEvent", tableName: "attendance_events",
  columns: { id: { type: "uuid", primary: true }, tenantId: { name: "tenant_id", type: "uuid" }, sessionId: { name: "session_id", type: "uuid", nullable: true }, deviceId: { name: "device_id", type: "uuid" }, providerEventRef: { name: "provider_event_ref", type: "varchar", length: 160 }, subjectType: { name: "subject_type", type: "varchar", length: 20 }, subjectId: { name: "subject_id", type: "uuid" }, eventType: { name: "event_type", type: "varchar", length: 20 }, capturedAt: { name: "captured_at", type: "timestamptz" }, receivedAt: { name: "received_at", type: "timestamptz" }, modality: { type: "varchar", length: 20 }, confidence: { type: "numeric", precision: 5, scale: 4, nullable: true }, sequence: { type: "bigint", nullable: true }, payloadHash: { name: "payload_hash", type: "varchar", length: 64 }, status: { type: "varchar", length: 20 } },
  uniques: [{ columns: ["deviceId", "providerEventRef"] }],
});

export const entities = [SchoolEntity, ClassEntity, SectionEntity, StudentEntity, EmployeeEntity, AttendanceEventEntity, ...auxiliaryEntities];
