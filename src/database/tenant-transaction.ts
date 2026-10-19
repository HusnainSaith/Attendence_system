import type { DataSource, EntityManager } from "typeorm";
import { database } from "./data-source";

export type DatabaseContext = { tenantId?: string; isSuperAdmin?: boolean };
type IsolationLevel = "READ UNCOMMITTED" | "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";

export async function withDatabaseContext<T>(
  context: DatabaseContext,
  work: (manager: EntityManager) => Promise<T>,
  isolation: IsolationLevel = "READ COMMITTED",
  source?: DataSource,
): Promise<T> {
  if (!context.tenantId && !context.isSuperAdmin) throw new Error("A tenant or platform context is required");
  const dataSource = source ?? await database();
  return dataSource.transaction(isolation, async (manager) => {
    await manager.query("SELECT set_config('app.tenant_id', $1, true)", [context.tenantId ?? ""]);
    await manager.query("SELECT set_config('app.is_super_admin', $1, true)", [String(context.isSuperAdmin === true)]);
    return work(manager);
  });
}
