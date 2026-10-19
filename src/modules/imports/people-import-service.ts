import { createHash } from "node:crypto";
import { AppError, conflict, notFound } from "@/common/errors/app-error";
import { withDatabaseContext } from "@/database/tenant-transaction";
import type { EntityManager } from "typeorm";
import { employeeImportRowDto, studentImportRowDto, type CreatePeopleImportDto } from "@/modules/people/dto";

type RowError = { field: string; code: string };
type ValidatedRow = { rowNo: number; normalized: Record<string, unknown>; errors: RowError[] };

const errorRows = (issues: Array<{ path: PropertyKey[]; code: string }>): RowError[] =>
  issues.map((issue) => ({ field: issue.path.join("."), code: issue.code }));

function duplicateValues(values: string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    else seen.add(value);
  }
  return duplicates;
}

async function validateStudentReferences(manager: EntityManager, tenantId: string, rows: ValidatedRow[]): Promise<void> {
  const enrollments = rows.flatMap((row) => {
    const enrollment = row.normalized.enrollment as Record<string, string> | undefined;
    return enrollment ? [{ row, enrollment }] : [];
  });
  if (!enrollments.length) return;
  const placements = await manager.query(
    `SELECT year.id "academicYearId",campus.id "campusId",class.id "classId",section.id "sectionId"
       FROM academic_years year
       JOIN campuses campus ON campus.tenant_id=year.tenant_id AND campus.id=ANY($2::uuid[]) AND campus.status='ACTIVE'
       JOIN classes class ON class.tenant_id=year.tenant_id AND class.academic_year_id=year.id AND class.id=ANY($3::uuid[]) AND class.status='ACTIVE'
       JOIN sections section ON section.tenant_id=year.tenant_id AND section.class_id=class.id AND section.id=ANY($4::uuid[]) AND section.status='ACTIVE'
      WHERE year.tenant_id=$1 AND year.id=ANY($5::uuid[])`,
    [tenantId, enrollments.map(({ enrollment }) => enrollment.campusId), enrollments.map(({ enrollment }) => enrollment.classId), enrollments.map(({ enrollment }) => enrollment.sectionId), enrollments.map(({ enrollment }) => enrollment.academicYearId)],
  );
  const valid = new Set(placements.map((item: Record<string, string>) => [item.academicYearId, item.campusId, item.classId, item.sectionId].join(":")));
  for (const { row, enrollment } of enrollments) {
    if (!valid.has([enrollment.academicYearId, enrollment.campusId, enrollment.classId, enrollment.sectionId].join(":"))) row.errors.push({ field: "enrollment", code: "PLACEMENT_INVALID" });
  }
}

async function validateRows(manager: EntityManager, tenantId: string, input: CreatePeopleImportDto): Promise<ValidatedRow[]> {
  const schema = input.type === "STUDENTS" ? studentImportRowDto : employeeImportRowDto;
  const rows = input.rows.map((raw, index): ValidatedRow => {
    const parsed = schema.safeParse(raw);
    return parsed.success
      ? { rowNo: index + 1, normalized: parsed.data as Record<string, unknown>, errors: [] }
      : { rowNo: index + 1, normalized: typeof raw === "object" && raw !== null ? raw as Record<string, unknown> : { value: raw }, errors: errorRows(parsed.error.issues) };
  });
  const identifier = input.type === "STUDENTS" ? "admissionNo" : "employeeNo";
  const validIdentifiers = rows.filter((row) => !row.errors.length && typeof row.normalized[identifier] === "string").map((row) => row.normalized[identifier] as string);
  const duplicates = duplicateValues(validIdentifiers);
  const existingRows = validIdentifiers.length
    ? await manager.query(input.type === "STUDENTS"
      ? `SELECT admission_no identifier FROM students WHERE tenant_id=$1 AND admission_no=ANY($2::text[])`
      : `SELECT employee_no identifier FROM employees WHERE tenant_id=$1 AND employee_no=ANY($2::text[])`, [tenantId, validIdentifiers])
    : [];
  const existing = new Set(existingRows.map((row: { identifier: string }) => row.identifier));
  for (const row of rows) {
    const value = row.normalized[identifier];
    if (typeof value === "string" && duplicates.has(value)) row.errors.push({ field: identifier, code: "DUPLICATE_IN_IMPORT" });
    if (typeof value === "string" && existing.has(value)) row.errors.push({ field: identifier, code: "ALREADY_EXISTS" });
  }
  if (input.type === "STUDENTS") await validateStudentReferences(manager, tenantId, rows.filter((row) => !row.errors.length));
  if (input.type === "EMPLOYEES") {
    const categoryIds = rows.flatMap((row) => typeof row.normalized.categoryId === "string" ? [row.normalized.categoryId] : []);
    const categories = categoryIds.length ? await manager.query(`SELECT id FROM employee_categories WHERE tenant_id=$1 AND id=ANY($2::uuid[]) AND status='ACTIVE'`, [tenantId, categoryIds]) : [];
    const validCategories = new Set(categories.map((row: { id: string }) => row.id));
    for (const row of rows) if (typeof row.normalized.categoryId === "string" && !validCategories.has(row.normalized.categoryId)) row.errors.push({ field: "categoryId", code: "CATEGORY_INVALID" });
  }
  return rows;
}

export async function createPeopleImport(tenantId: string, actorId: string, input: CreatePeopleImportDto) {
  return withDatabaseContext({ tenantId }, async (manager) => {
    const rows = await validateRows(manager, tenantId, input);
    const checksum = createHash("sha256").update(JSON.stringify({ type: input.type, rows: rows.map((row) => row.normalized) })).digest("hex");
    const [existing] = await manager.query(`SELECT id,type,status,totals,created_at "createdAt" FROM imports WHERE tenant_id=$1 AND type=$2 AND checksum=$3`, [tenantId, input.type, checksum]);
    if (existing) return { ...existing, reused: true };
    const valid = rows.filter((row) => !row.errors.length).length;
    const totals = { total: rows.length, valid, invalid: rows.length - valid, committed: 0 };
    const [created] = await manager.query(
      `INSERT INTO imports(tenant_id,type,object_ref,checksum,status,totals,created_by) VALUES($1,$2,'inline://json',$3,'VALIDATED',$4,$5)
       ON CONFLICT(tenant_id,type,checksum) DO NOTHING RETURNING id,type,status,totals,created_at "createdAt"`,
      [tenantId, input.type, checksum, totals, actorId],
    );
    if (!created) {
      const [concurrent] = await manager.query(`SELECT id,type,status,totals,created_at "createdAt" FROM imports WHERE tenant_id=$1 AND type=$2 AND checksum=$3`, [tenantId, input.type, checksum]);
      return { ...concurrent, reused: true };
    }
    for (const row of rows) await manager.query(
      `INSERT INTO import_rows(tenant_id,import_id,row_no,normalized,status,errors) VALUES($1,$2,$3,$4,$5,$6)`,
      [tenantId, created.id, row.rowNo, row.normalized, row.errors.length ? "INVALID" : "VALID", row.errors],
    );
    return { ...created, reused: false };
  }, "SERIALIZABLE");
}

export async function getPeopleImport(tenantId: string, importId: string) {
  return withDatabaseContext({ tenantId }, async (manager) => {
    const [item] = await manager.query(`SELECT id,type,status,totals,committed_at "committedAt",created_at "createdAt" FROM imports WHERE id=$1 AND tenant_id=$2`, [importId, tenantId]);
    if (!item) throw notFound();
    const rows = await manager.query(`SELECT row_no "rowNo",normalized,status,errors,entity_id "entityId" FROM import_rows WHERE import_id=$1 AND tenant_id=$2 ORDER BY row_no`, [importId, tenantId]);
    return { ...item, rows };
  });
}

export async function commitPeopleImport(tenantId: string, actorId: string, importId: string) {
  try {
    return await withDatabaseContext({ tenantId }, async (manager) => {
      const [item] = await manager.query(`SELECT id,type,status,totals FROM imports WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [importId, tenantId]);
      if (!item) throw notFound();
      if (item.status === "COMMITTED") return { id: item.id, type: item.type, status: item.status, totals: item.totals, reused: true };
      if (item.status !== "VALIDATED") throw conflict("IMPORT_NOT_COMMITTABLE", "Import is not ready to commit");
      if (Number(item.totals.invalid) > 0) throw new AppError("IMPORT_HAS_ERRORS", 422, "Submit a corrected batch before committing this import");

      if (item.type === "STUDENTS") {
        await manager.query(
          `INSERT INTO students(tenant_id,admission_no,first_name,last_name,date_of_birth,sex,status,joined_on)
           SELECT $1,row.normalized->>'admissionNo',row.normalized->>'firstName',row.normalized->>'lastName',(row.normalized->>'dateOfBirth')::date,
                  row.normalized->>'sex','ACTIVE',NULLIF(row.normalized->'enrollment'->>'startsOn','')::date
             FROM import_rows row WHERE row.import_id=$2 AND row.tenant_id=$1 AND row.status='VALID'`,
          [tenantId, importId],
        );
        await manager.query(`UPDATE import_rows row SET entity_id=student.id FROM students student WHERE row.import_id=$2 AND row.tenant_id=$1 AND student.tenant_id=$1 AND student.admission_no=row.normalized->>'admissionNo'`, [tenantId, importId]);
        await manager.query(
          `INSERT INTO enrollments(tenant_id,student_id,academic_year_id,campus_id,class_id,section_id,starts_on,ends_on,status,source)
           SELECT $1,row.entity_id,(row.normalized->'enrollment'->>'academicYearId')::uuid,(row.normalized->'enrollment'->>'campusId')::uuid,
                  (row.normalized->'enrollment'->>'classId')::uuid,(row.normalized->'enrollment'->>'sectionId')::uuid,
                  (row.normalized->'enrollment'->>'startsOn')::date,NULLIF(row.normalized->'enrollment'->>'endsOn','')::date,'ACTIVE','IMPORT'
             FROM import_rows row WHERE row.import_id=$2 AND row.tenant_id=$1 AND row.normalized ? 'enrollment'`,
          [tenantId, importId],
        );
      } else if (item.type === "EMPLOYEES") {
        await manager.query(
          `INSERT INTO employees(tenant_id,employee_no,category_id,first_name,last_name,joined_on,category,status)
           SELECT $1,row.normalized->>'employeeNo',NULLIF(row.normalized->>'categoryId','')::uuid,row.normalized->>'firstName',row.normalized->>'lastName',
                  NULLIF(row.normalized->>'joinedOn','')::date,row.normalized->>'category','ACTIVE'
             FROM import_rows row WHERE row.import_id=$2 AND row.tenant_id=$1 AND row.status='VALID'`,
          [tenantId, importId],
        );
        await manager.query(`UPDATE import_rows row SET entity_id=employee.id FROM employees employee WHERE row.import_id=$2 AND row.tenant_id=$1 AND employee.tenant_id=$1 AND employee.employee_no=row.normalized->>'employeeNo'`, [tenantId, importId]);
      } else throw new AppError("IMPORT_TYPE_UNSUPPORTED", 422, "Import type is not supported");

      const totals = { ...item.totals, committed: Number(item.totals.valid) };
      await manager.query(`UPDATE imports SET status='COMMITTED',totals=$3,committed_at=now() WHERE id=$1 AND tenant_id=$2`, [importId, tenantId, totals]);
      await manager.query(`UPDATE import_rows SET status='COMMITTED' WHERE import_id=$1 AND tenant_id=$2 AND status='VALID'`, [importId, tenantId]);
      await manager.query(`INSERT INTO audit_logs(tenant_id,actor_type,actor_id,action,resource_type,resource_id,after_hash,result,correlation_id) VALUES($1,'USER',$2,'IMPORT_COMMITTED','IMPORT',$3,encode(digest($4,'sha256'),'hex'),'SUCCESS',gen_random_uuid())`, [tenantId, actorId, importId, JSON.stringify(totals)]);
      return { id: importId, type: item.type, status: "COMMITTED", totals, reused: false };
    }, "SERIALIZABLE");
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") throw conflict("IMPORT_DATA_CONFLICT", "One or more records were created after validation; create a new import");
    throw error;
  }
}
