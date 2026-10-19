import type { MigrationInterface, QueryRunner } from "typeorm";

export class PlatformAndTenancy1770000000000 implements MigrationInterface {
  name = "PlatformAndTenancy1770000000000";
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext;
      CREATE TABLE plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(40) NOT NULL UNIQUE, name varchar(120) NOT NULL, status varchar(20) NOT NULL DEFAULT 'ACTIVE', limits jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE schools (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug varchar(80) NOT NULL UNIQUE, name varchar(160) NOT NULL, status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACTIVE','SUSPENDED','ARCHIVED')), timezone varchar(64) NOT NULL, locale varchar(16) NOT NULL DEFAULT 'en-PK', plan_id uuid REFERENCES plans(id), settings jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz, UNIQUE(id,plan_id));
      CREATE TABLE subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES schools(id), plan_id uuid NOT NULL REFERENCES plans(id), status varchar(20) NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), CHECK(ends_at IS NULL OR ends_at > starts_at), UNIQUE(id,tenant_id));
      CREATE UNIQUE INDEX uq_subscription_current ON subscriptions(tenant_id) WHERE status='ACTIVE' AND ends_at IS NULL;
      CREATE TABLE campuses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES schools(id), code varchar(30) NOT NULL, name varchar(140) NOT NULL, address jsonb NOT NULL DEFAULT '{}', status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,code), UNIQUE(id,tenant_id));
      CREATE TABLE locations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES schools(id), campus_id uuid NOT NULL, parent_id uuid, type varchar(30) NOT NULL, code varchar(30) NOT NULL, name varchar(140) NOT NULL, status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(campus_id,code), UNIQUE(id,tenant_id), FOREIGN KEY(campus_id,tenant_id) REFERENCES campuses(id,tenant_id), FOREIGN KEY(parent_id,tenant_id) REFERENCES locations(id,tenant_id));
    `);
  }
  async down(q: QueryRunner): Promise<void> { await q.query(`DROP TABLE locations,campuses,subscriptions,schools,plans CASCADE;`); }
}
