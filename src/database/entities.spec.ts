import { describe, expect, it } from "vitest";
import { entities } from "./entities";

const expectedTables = [
  "plans","schools","subscriptions","campuses","locations","users","user_profiles","roles","permissions","role_permissions","user_roles","refresh_sessions","mfa_factors","academic_years","terms","calendars","calendar_days","classes","sections","subjects","students","guardians","student_guardians","employee_categories","employees","enrollments","teacher_assignments","shifts","shift_assignments","consent_records","biometric_profiles","biometric_profile_syncs","biometric_devices","device_credentials","device_assignments","device_sync_batches","attendance_policies","attendance_sessions","session_scopes","attendance_events","attendance_records","attendance_record_events","attendance_corrections","leave_types","leave_requests","notification_templates","notification_preferences","notifications","notification_deliveries","outbox_events","imports","import_rows","report_exports","audit_logs","security_events","idempotency_keys","privacy_requests",
  "user_invitations","password_reset_tokens","mfa_recovery_codes",
].sort();

describe("TypeORM entity catalogue", () => {
  it("maps every application table exactly once", () => {
    const tables = entities.map((entity) => entity.options.tableName).sort();
    expect(tables).toEqual(expectedTables);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it("never enables TypeORM schema synchronization", () => {
    expect(entities.every((entity) => entity.options.synchronize !== true)).toBe(true);
  });
});
