import type { MigrationInterface, QueryRunner } from "typeorm";

export class IdentityAndAccess1770000001000 implements MigrationInterface {
  name = "IdentityAndAccess1770000001000";
  async up(q: QueryRunner): Promise<void> { await q.query(`
    CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email citext, phone varchar(32), password_hash varchar(255), status varchar(20) NOT NULL DEFAULT 'INVITED', email_verified_at timestamptz, phone_verified_at timestamptz, last_login_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX uq_users_email ON users(email) WHERE email IS NOT NULL; CREATE UNIQUE INDEX uq_users_phone ON users(phone) WHERE phone IS NOT NULL;
    CREATE TABLE user_profiles (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, first_name varchar(100) NOT NULL, last_name varchar(100) NOT NULL, display_name varchar(160), locale varchar(16), avatar_ref varchar(500), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES schools(id), code varchar(60) NOT NULL, name varchar(120) NOT NULL, scope_type varchar(30) NOT NULL, is_system boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE NULLS NOT DISTINCT(tenant_id,code), UNIQUE(id,tenant_id));
    CREATE TABLE permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(100) NOT NULL UNIQUE, description varchar(300) NOT NULL);
    CREATE TABLE role_permissions (role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, effect varchar(10) NOT NULL DEFAULT 'ALLOW' CHECK(effect IN ('ALLOW','DENY')), PRIMARY KEY(role_id,permission_id));
    CREATE TABLE user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES schools(id), user_id uuid NOT NULL REFERENCES users(id), role_id uuid NOT NULL REFERENCES roles(id), campus_id uuid, starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz, status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(campus_id,tenant_id) REFERENCES campuses(id,tenant_id), CHECK(ends_at IS NULL OR ends_at>starts_at), UNIQUE(id,tenant_id));
    CREATE INDEX ix_user_roles_effective ON user_roles(user_id,tenant_id,status,starts_at,ends_at);
    CREATE TABLE refresh_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, family_id uuid NOT NULL, token_hash varchar(255) NOT NULL UNIQUE, device_fingerprint varchar(255), ip inet, expires_at timestamptz NOT NULL, rotated_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()); CREATE INDEX ix_refresh_family ON refresh_sessions(family_id);
    CREATE TABLE mfa_factors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, type varchar(20) NOT NULL, encrypted_secret bytea NOT NULL, verified_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
  `); }
  async down(q: QueryRunner): Promise<void> { await q.query(`DROP TABLE mfa_factors,refresh_sessions,user_roles,role_permissions,permissions,roles,user_profiles,users CASCADE;`); }
}
