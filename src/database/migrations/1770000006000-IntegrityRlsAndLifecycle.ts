import type { MigrationInterface, QueryRunner } from "typeorm";

const tenantTables = [
  "subscriptions","campuses","locations","user_roles","academic_years","terms","calendars","calendar_days","classes","sections","subjects","students","guardians","student_guardians","employee_categories","employees","enrollments","teacher_assignments","shifts","shift_assignments","consent_records","biometric_devices","device_credentials","device_assignments","biometric_profiles","biometric_profile_syncs","device_sync_batches","attendance_policies","attendance_sessions","session_scopes","attendance_events","attendance_records","attendance_record_events","attendance_corrections","leave_types","leave_requests","notification_preferences","notifications","notification_deliveries","imports","import_rows","report_exports","idempotency_keys","privacy_requests",
];

export class IntegrityRlsAndLifecycle1770000006000 implements MigrationInterface {
  name = "IntegrityRlsAndLifecycle1770000006000";
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=clock_timestamp(); RETURN NEW; END $$;
      CREATE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '% is append-only',TG_TABLE_NAME USING ERRCODE='55000'; END $$;
      CREATE FUNCTION validate_user_role_tenant() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE role_tenant uuid; BEGIN SELECT tenant_id INTO role_tenant FROM roles WHERE id=NEW.role_id; IF role_tenant IS NOT NULL AND role_tenant<>NEW.tenant_id THEN RAISE EXCEPTION 'role tenant mismatch' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
      CREATE FUNCTION validate_subject_tenant() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE found_id uuid; BEGIN IF NEW.subject_type='STUDENT' THEN SELECT id INTO found_id FROM students WHERE id=NEW.subject_id AND tenant_id=NEW.tenant_id; ELSIF NEW.subject_type='EMPLOYEE' THEN SELECT id INTO found_id FROM employees WHERE id=NEW.subject_id AND tenant_id=NEW.tenant_id; ELSE RAISE EXCEPTION 'unsupported subject type' USING ERRCODE='23514'; END IF; IF found_id IS NULL THEN RAISE EXCEPTION 'subject tenant mismatch' USING ERRCODE='23503'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER trg_user_roles_tenant BEFORE INSERT OR UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION validate_user_role_tenant();
      CREATE TRIGGER trg_events_subject BEFORE INSERT ON attendance_events FOR EACH ROW EXECUTE FUNCTION validate_subject_tenant();
      CREATE TRIGGER trg_consent_subject BEFORE INSERT OR UPDATE ON consent_records FOR EACH ROW EXECUTE FUNCTION validate_subject_tenant();
      CREATE TRIGGER trg_profiles_subject BEFORE INSERT OR UPDATE ON biometric_profiles FOR EACH ROW EXECUTE FUNCTION validate_subject_tenant();
      CREATE TRIGGER trg_leave_subject BEFORE INSERT OR UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION validate_subject_tenant();
      CREATE TRIGGER trg_events_immutable BEFORE UPDATE OR DELETE ON attendance_events FOR EACH ROW EXECUTE FUNCTION reject_mutation();
      CREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_mutation();
      CREATE TRIGGER trg_schools_updated BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      CREATE TRIGGER trg_students_updated BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      CREATE TRIGGER trg_records_updated BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);
    for (const table of tenantTables) {
      await q.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${table} FORCE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation ON ${table} USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true') WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true')`);
    }
    await q.query(`
      ALTER TABLE schools ENABLE ROW LEVEL SECURITY; ALTER TABLE schools FORCE ROW LEVEL SECURITY;
      CREATE POLICY school_isolation ON schools USING (id=nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true') WITH CHECK (id=nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true');
      ALTER TABLE roles ENABLE ROW LEVEL SECURITY; ALTER TABLE roles FORCE ROW LEVEL SECURITY;
      CREATE POLICY role_read ON roles FOR SELECT USING (tenant_id IS NULL OR tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true');
      CREATE POLICY role_write ON roles FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true') WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true');
      ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY; ALTER TABLE notification_templates FORCE ROW LEVEL SECURITY;
      CREATE POLICY template_read ON notification_templates FOR SELECT USING (tenant_id IS NULL OR tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true');
      CREATE POLICY template_write ON notification_templates FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true') WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true');
    `);
    for (const table of ["outbox_events","audit_logs","security_events"]) {
      await q.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${table} FORCE ROW LEVEL SECURITY; CREATE POLICY tenant_or_platform ON ${table} USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true') WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true')`);
    }
  }
  async down(q: QueryRunner): Promise<void> {
    for (const table of [...tenantTables,"schools","roles","notification_templates","outbox_events","audit_logs","security_events"]) await q.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
    await q.query(`DROP FUNCTION validate_subject_tenant() CASCADE; DROP FUNCTION validate_user_role_tenant() CASCADE; DROP FUNCTION reject_mutation() CASCADE; DROP FUNCTION set_updated_at() CASCADE;`);
  }
}
