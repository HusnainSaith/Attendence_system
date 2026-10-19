import "dotenv/config";
import argon2 from "argon2";
import { AppDataSource } from "../data-source";

const permissions = [
  "schools:create","schools:read","schools:update","schools:status","subscriptions:write",
  "iam:users:write","iam:roles:write","campuses:write","academics:write","students:read","students:write",
  "guardians:read","guardians:write","employees:read","employees:write","enrollments:read","enrollments:write","consent:write","biometric:read","biometric:enroll",
  "biometric:revoke","devices:write","devices:health","attendance:policies:write","attendance:sessions:write",
  "attendance:manual","attendance:read","attendance:corrections:request","attendance:corrections:approve",
  "leave:write","leave:approve","notifications:read","notifications:write","privacy:write","privacy:approve","imports:read","imports:write","reports:read","reports:export","audit:read","security:read","security:resolve",
] as const;

const rolePermissions: Record<string, readonly string[]> = {
  SUPER_ADMIN: permissions,
  SCHOOL_OWNER: permissions.filter((p) => !p.startsWith("schools:")),
  SCHOOL_ADMIN: permissions.filter((p) => !p.startsWith("schools:") && !p.startsWith("subscriptions:")),
  ATTENDANCE_MANAGER: permissions.filter((p) => p.startsWith("attendance:") || p === "devices:health" || p.startsWith("reports:")),
  TEACHER: ["attendance:read","attendance:manual","attendance:corrections:request","leave:write"],
  STUDENT: ["attendance:read","attendance:corrections:request","leave:write","notifications:read"],
  GUARDIAN: ["attendance:read","attendance:corrections:request","notifications:read"],
  STAFF: ["attendance:read","attendance:corrections:request","leave:write","notifications:read"],
  AUDITOR: ["audit:read","attendance:read","reports:read"],
};

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction("SERIALIZABLE", async (manager) => {
      await manager.query("SELECT set_config('app.is_super_admin','true',true)");
      for (const code of permissions) await manager.query(`INSERT INTO permissions(code,description) VALUES($1,$2) ON CONFLICT(code) DO UPDATE SET description=excluded.description`, [code, code.replaceAll(":", " ")]);
      for (const [code, granted] of Object.entries(rolePermissions)) {
        const [role] = await manager.query(`INSERT INTO roles(tenant_id,code,name,scope_type,is_system) VALUES(NULL,$1,$2,$3,true) ON CONFLICT(tenant_id,code) DO UPDATE SET name=excluded.name RETURNING id`, [code, code.replaceAll("_", " "), code === "SUPER_ADMIN" ? "PLATFORM" : "TENANT"]);
        await manager.query(`DELETE FROM role_permissions WHERE role_id=$1`, [role.id]);
        await manager.query(`INSERT INTO role_permissions(role_id,permission_id,effect) SELECT $1,id,'ALLOW' FROM permissions WHERE code=ANY($2::text[])`, [role.id, granted]);
      }
      const email = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
      const password = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;
      if ((email && !password) || (!email && password)) throw new Error("Both bootstrap super-admin values are required");
      if (email && password) {
        if (password.length < 12) throw new Error("Bootstrap password must contain at least 12 characters");
        const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 });
        const [user] = await manager.query(`INSERT INTO users(email,password_hash,status,email_verified_at) VALUES($1,$2,'ACTIVE',now()) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,status='ACTIVE' RETURNING id`, [email,passwordHash]);
        const [role] = await manager.query(`SELECT id FROM roles WHERE tenant_id IS NULL AND code='SUPER_ADMIN'`);
        await manager.query(`INSERT INTO user_roles(tenant_id,user_id,role_id,status) SELECT NULL,$1,$2,'ACTIVE' WHERE NOT EXISTS(SELECT 1 FROM user_roles WHERE tenant_id IS NULL AND user_id=$1 AND role_id=$2 AND status='ACTIVE')`, [user.id,role.id]);
      }
    });
  } finally { await AppDataSource.destroy(); }
}

seed().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "IAM seed failed"); process.exitCode = 1; });
