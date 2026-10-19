import { ClassEntity, EmployeeEntity, SchoolEntity, SectionEntity, StudentEntity } from "@/database/entities";
import { withDatabaseContext } from "@/database/tenant-transaction";
import { conflict, notFound } from "@/common/errors/app-error";

export async function createSchool(input: { slug: string; name: string; timezone: string }) {
  return withDatabaseContext({ isSuperAdmin: true }, async (manager) => {
    const repo = manager.getRepository(SchoolEntity);
    if (await repo.existsBy({ slug: input.slug })) throw conflict("SCHOOL_SLUG_EXISTS", "School slug already exists");
    return repo.save(repo.create(input));
  });
}

export async function createClass(tenantId: string, input: { academicYearId: string; code: string; name: string; level?: string }) {
  return withDatabaseContext({ tenantId }, async (manager) => {
    const repo = manager.getRepository(ClassEntity);
    if (await repo.existsBy({ tenantId, academicYearId: input.academicYearId, code: input.code })) throw conflict("CLASS_CODE_EXISTS", "Class code already exists");
    return repo.save(repo.create({ ...input, tenantId, level: input.level ?? null }));
  });
}

export async function createSection(tenantId: string, input: { classId: string; code: string; name: string; capacity?: number }) {
  return withDatabaseContext({ tenantId }, async (manager) => {
    if (!await manager.getRepository(ClassEntity).existsBy({ id: input.classId, tenantId })) throw notFound();
    const repo = manager.getRepository(SectionEntity);
    if (await repo.existsBy({ tenantId, classId: input.classId, code: input.code })) throw conflict("SECTION_CODE_EXISTS", "Section code already exists");
    return repo.save(repo.create({ ...input, tenantId, capacity: input.capacity ?? null }));
  });
}

export async function createStudent(tenantId: string, input: { admissionNo: string; firstName: string; lastName: string; dateOfBirth: string }) {
  return withDatabaseContext({ tenantId }, async (manager) => {
    const repo = manager.getRepository(StudentEntity);
    if (await repo.existsBy({ tenantId, admissionNo: input.admissionNo })) throw conflict("STUDENT_ADMISSION_EXISTS", "Admission number already exists");
    return repo.save(repo.create({ ...input, tenantId }));
  });
}

export async function createEmployee(tenantId: string, input: { employeeNo: string; firstName: string; lastName: string; category: string }) {
  return withDatabaseContext({ tenantId }, async (manager) => {
    const repo = manager.getRepository(EmployeeEntity);
    if (await repo.existsBy({ tenantId, employeeNo: input.employeeNo })) throw conflict("EMPLOYEE_NUMBER_EXISTS", "Employee number already exists");
    return repo.save(repo.create({ ...input, tenantId }));
  });
}
