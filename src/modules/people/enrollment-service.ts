import { AppError, notFound } from "@/common/errors/app-error";
import { withDatabaseContext } from "@/database/tenant-transaction";
import type { EntityManager } from "typeorm";
import type { PromoteStudentsDto } from "./dto";

type PromotionCandidate = {
  enrollmentId: string;
  studentId: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  alreadyEnrolled: boolean;
};

async function validatePromotion(
  manager: EntityManager,
  tenantId: string,
  input: PromoteStudentsDto,
): Promise<{ sourceEndsOn: string }> {
  const [years] = await manager.query(
    `SELECT source.ends_on "sourceEndsOn",target.starts_on "targetStartsOn",target.ends_on "targetEndsOn"
       FROM academic_years source
       JOIN academic_years target ON target.id=$2 AND target.tenant_id=source.tenant_id
      WHERE source.id=$1 AND source.tenant_id=$3
        AND source.status='ACTIVE' AND target.status IN ('ACTIVE','DRAFT')`,
    [input.sourceAcademicYearId, input.targetAcademicYearId, tenantId],
  );
  if (!years) throw new AppError("ACADEMIC_YEARS_INVALID", 422, "Source and target academic years must be available in this school");
  if (years.targetStartsOn <= years.sourceEndsOn) throw new AppError("ACADEMIC_YEAR_SEQUENCE_INVALID", 422, "Target academic year must begin after the source academic year ends");
  if (input.startsOn < years.targetStartsOn || input.startsOn > years.targetEndsOn) throw new AppError("PROMOTION_DATE_INVALID", 422, "Promotion start date must fall within the target academic year");

  const [placement] = await manager.query(
    `SELECT section.id
       FROM sections section
       JOIN classes class ON class.id=section.class_id AND class.tenant_id=section.tenant_id
       JOIN campuses campus ON campus.id=$4 AND campus.tenant_id=section.tenant_id
      WHERE section.id=$3 AND class.id=$2 AND class.academic_year_id=$1
        AND section.tenant_id=$5 AND section.status='ACTIVE' AND class.status='ACTIVE' AND campus.status='ACTIVE'`,
    [input.targetAcademicYearId, input.targetClassId, input.targetSectionId, input.targetCampusId, tenantId],
  );
  if (!placement) throw new AppError("TARGET_PLACEMENT_INVALID", 422, "Target campus, class, and section must be active and belong to the target academic year");

  const [source] = await manager.query(
    `SELECT section.id FROM sections section
       JOIN classes class ON class.id=section.class_id AND class.tenant_id=section.tenant_id
      WHERE section.id=$1 AND class.academic_year_id=$2 AND section.tenant_id=$3`,
    [input.sourceSectionId, input.sourceAcademicYearId, tenantId],
  );
  if (!source) throw new AppError("SOURCE_SECTION_INVALID", 422, "Source section does not belong to the source academic year");
  return { sourceEndsOn: years.sourceEndsOn };
}

async function loadCandidates(manager: EntityManager, tenantId: string, input: PromoteStudentsDto, lock: boolean): Promise<PromotionCandidate[]> {
  return manager.query(
    `SELECT enrollment.id "enrollmentId",student.id "studentId",student.admission_no "admissionNo",
            student.first_name "firstName",student.last_name "lastName",
            EXISTS(SELECT 1 FROM enrollments target WHERE target.tenant_id=enrollment.tenant_id
              AND target.student_id=student.id AND target.academic_year_id=$4) "alreadyEnrolled"
       FROM enrollments enrollment
       JOIN students student ON student.id=enrollment.student_id AND student.tenant_id=enrollment.tenant_id
      WHERE enrollment.tenant_id=$1 AND enrollment.academic_year_id=$2 AND enrollment.section_id=$3
        AND enrollment.status='ACTIVE' AND enrollment.ends_on IS NULL AND student.status='ACTIVE'
        AND ($5::uuid[] IS NULL OR student.id=ANY($5::uuid[]))
      ORDER BY student.admission_no,student.id${lock ? " FOR UPDATE OF enrollment" : ""}`,
    [tenantId, input.sourceAcademicYearId, input.sourceSectionId, input.targetAcademicYearId, input.studentIds ?? null],
  );
}

export async function previewPromotion(tenantId: string, input: PromoteStudentsDto) {
  return withDatabaseContext({ tenantId }, async (manager) => {
    await validatePromotion(manager, tenantId, input);
    const students = await loadCandidates(manager, tenantId, input, false);
    const foundIds = new Set(students.map((student) => student.studentId));
    const missingStudentIds = input.studentIds?.filter((id) => !foundIds.has(id)) ?? [];
    return {
      eligible: students.filter((student) => !student.alreadyEnrolled),
      skipped: students.filter((student) => student.alreadyEnrolled),
      missingStudentIds,
      totals: {
        requested: input.studentIds?.length ?? students.length,
        eligible: students.filter((student) => !student.alreadyEnrolled).length,
        skipped: students.filter((student) => student.alreadyEnrolled).length,
        missing: missingStudentIds.length,
      },
    };
  });
}

export async function promoteStudents(tenantId: string, actorId: string, input: PromoteStudentsDto) {
  return withDatabaseContext({ tenantId }, async (manager) => {
    const { sourceEndsOn } = await validatePromotion(manager, tenantId, input);
    const students = await loadCandidates(manager, tenantId, input, true);
    const foundIds = new Set(students.map((student) => student.studentId));
    const missingStudentIds = input.studentIds?.filter((id) => !foundIds.has(id)) ?? [];
    if (missingStudentIds.length) throw new AppError("PROMOTION_STUDENTS_INVALID", 422, "One or more selected students do not have an active enrollment in the source section", missingStudentIds.map((id) => ({ field: `studentIds.${id}`, code: "NOT_IN_SOURCE_SECTION" })));

    const eligible = students.filter((student) => !student.alreadyEnrolled);
    if (eligible.length) {
      const enrollmentIds = eligible.map((student) => student.enrollmentId);
      await manager.query(`UPDATE enrollments SET ends_on=$2,status='PROMOTED' WHERE tenant_id=$1 AND id=ANY($3::uuid[])`, [tenantId, sourceEndsOn, enrollmentIds]);
      await manager.query(
        `INSERT INTO enrollments(tenant_id,student_id,academic_year_id,campus_id,class_id,section_id,starts_on,status,source)
         SELECT $1,unnest($2::uuid[]),$3,$4,$5,$6,$7,'ACTIVE','PROMOTION'`,
        [tenantId, eligible.map((student) => student.studentId), input.targetAcademicYearId, input.targetCampusId, input.targetClassId, input.targetSectionId, input.startsOn],
      );
    }
    await manager.query(
      `INSERT INTO audit_logs(tenant_id,actor_type,actor_id,action,resource_type,resource_id,after_hash,result,correlation_id)
       VALUES($1,'USER',$2,'STUDENTS_PROMOTED','SECTION',$3,encode(digest($4,'sha256'),'hex'),'SUCCESS',gen_random_uuid())`,
      [tenantId, actorId, input.sourceSectionId, JSON.stringify({ targetSectionId: input.targetSectionId, promoted: eligible.length, skipped: students.length - eligible.length })],
    );
    return { promoted: eligible.length, skipped: students.length - eligible.length, studentIds: eligible.map((student) => student.studentId) };
  }, "SERIALIZABLE");
}

export async function listStudentEnrollments(tenantId: string, studentId: string) {
  return withDatabaseContext({ tenantId }, async (manager) => {
    const [student] = await manager.query(`SELECT id FROM students WHERE id=$1 AND tenant_id=$2`, [studentId, tenantId]);
    if (!student) throw notFound();
    return manager.query(
      `SELECT enrollment.id,enrollment.starts_on "startsOn",enrollment.ends_on "endsOn",enrollment.status,enrollment.source,
              year.id "academicYearId",year.name "academicYear",campus.id "campusId",campus.name campus,
              class.id "classId",class.name class,section.id "sectionId",section.name section
         FROM enrollments enrollment
         JOIN academic_years year ON year.id=enrollment.academic_year_id AND year.tenant_id=enrollment.tenant_id
         JOIN campuses campus ON campus.id=enrollment.campus_id AND campus.tenant_id=enrollment.tenant_id
         JOIN classes class ON class.id=enrollment.class_id AND class.tenant_id=enrollment.tenant_id
         JOIN sections section ON section.id=enrollment.section_id AND section.tenant_id=enrollment.tenant_id
        WHERE enrollment.student_id=$1 AND enrollment.tenant_id=$2
        ORDER BY enrollment.starts_on DESC,enrollment.created_at DESC`,
      [studentId, tenantId],
    );
  });
}
