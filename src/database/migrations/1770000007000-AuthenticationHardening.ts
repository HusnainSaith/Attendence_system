import type { MigrationInterface, QueryRunner } from "typeorm";

export class AuthenticationHardening1770000007000 implements MigrationInterface {
  name = "AuthenticationHardening1770000007000";
  async up(q: QueryRunner): Promise<void> { await q.query(`
    ALTER TABLE user_roles ALTER COLUMN tenant_id DROP NOT NULL;
    ALTER TABLE refresh_sessions ADD COLUMN tenant_id uuid REFERENCES schools(id), ADD COLUMN role_id uuid REFERENCES roles(id), ADD COLUMN replaced_by_id uuid REFERENCES refresh_sessions(id), ADD COLUMN last_used_at timestamptz, ADD COLUMN mfa_verified boolean NOT NULL DEFAULT false;
    CREATE INDEX ix_refresh_active ON refresh_sessions(user_id,expires_at) WHERE revoked_at IS NULL;
    CREATE TABLE user_invitations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES schools(id), email citext NOT NULL, role_id uuid NOT NULL REFERENCES roles(id), campus_id uuid, token_hash varchar(128) NOT NULL UNIQUE, invited_by uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL, accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(campus_id,tenant_id) REFERENCES campuses(id,tenant_id));
    CREATE UNIQUE INDEX uq_invitation_pending ON user_invitations(tenant_id,email,role_id) WHERE accepted_at IS NULL AND revoked_at IS NULL;
    CREATE TABLE password_reset_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash varchar(128) NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX ix_password_reset_active ON password_reset_tokens(user_id,expires_at) WHERE used_at IS NULL;
    CREATE TABLE mfa_recovery_codes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, code_hash varchar(255) NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
    ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY; ALTER TABLE user_invitations FORCE ROW LEVEL SECURITY;
    CREATE POLICY invitation_tenant ON user_invitations USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true') WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true');
    DROP POLICY tenant_isolation ON user_roles;
    CREATE POLICY user_role_read ON user_roles FOR SELECT USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid OR (tenant_id IS NULL AND coalesce(current_setting('app.is_super_admin',true),'false')='true') OR coalesce(current_setting('app.is_super_admin',true),'false')='true');
    CREATE POLICY user_role_write ON user_roles FOR ALL USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true') WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true');
  `); }
  async down(q: QueryRunner): Promise<void> { await q.query(`DROP TABLE mfa_recovery_codes,password_reset_tokens,user_invitations CASCADE; ALTER TABLE refresh_sessions DROP COLUMN mfa_verified,DROP COLUMN last_used_at,DROP COLUMN replaced_by_id,DROP COLUMN role_id,DROP COLUMN tenant_id; DROP POLICY user_role_read ON user_roles; DROP POLICY user_role_write ON user_roles; CREATE POLICY tenant_isolation ON user_roles USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true') WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid OR coalesce(current_setting('app.is_super_admin',true),'false')='true'); ALTER TABLE user_roles ALTER COLUMN tenant_id SET NOT NULL;`); }
}
