import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PlatformAndTenancy1770000000000 } from "./migrations/1770000000000-PlatformAndTenancy";
import { IdentityAndAccess1770000001000 } from "./migrations/1770000001000-IdentityAndAccess";
import { AcademicsAndPeople1770000002000 } from "./migrations/1770000002000-AcademicsAndPeople";
import { ConsentBiometricsAndDevices1770000003000 } from "./migrations/1770000003000-ConsentBiometricsAndDevices";
import { AttendanceAndLeave1770000004000 } from "./migrations/1770000004000-AttendanceAndLeave";
import { OperationsAuditAndPrivacy1770000005000 } from "./migrations/1770000005000-OperationsAuditAndPrivacy";
import { IntegrityRlsAndLifecycle1770000006000 } from "./migrations/1770000006000-IntegrityRlsAndLifecycle";
import { AuthenticationHardening1770000007000 } from "./migrations/1770000007000-AuthenticationHardening";

const enabled = process.env.RUN_DB_TESTS === "1";
describe.skipIf(!enabled)("complete PostgreSQL migration chain", () => {
  let container: StartedPostgreSqlContainer;
  let db: DataSource;
  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    db = new DataSource({ type: "postgres", url: container.getConnectionUri(), migrations: [PlatformAndTenancy1770000000000, IdentityAndAccess1770000001000, AcademicsAndPeople1770000002000, ConsentBiometricsAndDevices1770000003000, AttendanceAndLeave1770000004000, OperationsAuditAndPrivacy1770000005000, IntegrityRlsAndLifecycle1770000006000, AuthenticationHardening1770000007000], migrationsTransactionMode: "all" });
    await db.initialize(); await db.runMigrations();
  }, 120_000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); if (container) await container.stop(); });

  it("creates the complete schema and tenant policies", async () => {
    const [{ count }] = await db.query("SELECT count(*)::int count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
    expect(count).toBeGreaterThanOrEqual(50);
    const [{ count: policies }] = await db.query("SELECT count(*)::int count FROM pg_policies WHERE schemaname='public'");
    expect(policies).toBeGreaterThanOrEqual(45);
  });

  it("rejects cross-tenant composite relationships", async () => {
    const [a] = await db.query("INSERT INTO schools(slug,name,timezone) VALUES('a','A','Asia/Karachi') RETURNING id");
    const [b] = await db.query("INSERT INTO schools(slug,name,timezone) VALUES('b','B','Asia/Karachi') RETURNING id");
    const [campus] = await db.query("INSERT INTO campuses(tenant_id,code,name) VALUES($1,'MAIN','Main') RETURNING id", [a.id]);
    await expect(db.query("INSERT INTO locations(tenant_id,campus_id,type,code,name) VALUES($1,$2,'GATE','G1','Gate')", [b.id, campus.id])).rejects.toThrow();
  });

  it("keeps append-only evidence immutable", async () => {
    const [tenant] = await db.query("SELECT id FROM schools WHERE slug='a'");
    const [user] = await db.query("INSERT INTO users(email,status) VALUES('audit@example.test','ACTIVE') RETURNING id");
    const [row] = await db.query("INSERT INTO audit_logs(tenant_id,actor_type,actor_id,action,resource_type,result,correlation_id) VALUES($1,'USER',$2,'TEST','TEST','SUCCESS',gen_random_uuid()) RETURNING id", [tenant.id,user.id]);
    await expect(db.query("DELETE FROM audit_logs WHERE id=$1", [row.id])).rejects.toThrow(/append-only/);
  });
});
