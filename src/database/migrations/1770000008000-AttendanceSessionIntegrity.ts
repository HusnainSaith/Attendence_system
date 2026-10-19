import type { MigrationInterface, QueryRunner } from "typeorm";

export class AttendanceSessionIntegrity1770000008000 implements MigrationInterface {
  name = "AttendanceSessionIntegrity1770000008000";
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE UNIQUE INDEX uq_attendance_session_identity ON attendance_sessions(tenant_id,campus_id,session_date,type)`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX uq_attendance_session_identity`);
  }
}
