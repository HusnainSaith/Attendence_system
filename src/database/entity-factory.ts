import { EntitySchema, type EntitySchemaColumnOptions } from "typeorm";

type ColumnMap = Record<string, EntitySchemaColumnOptions>;
const id: EntitySchemaColumnOptions = { type: "uuid", primary: true, generated: "uuid" };
const tenantId: EntitySchemaColumnOptions = { name: "tenant_id", type: "uuid" };

export function tenantEntity(name: string, tableName: string, columns: ColumnMap = {}): EntitySchema {
  return new EntitySchema({ name, tableName, columns: { id, tenantId, ...columns }, synchronize: false });
}

export function globalEntity(name: string, tableName: string, columns: ColumnMap = {}): EntitySchema {
  return new EntitySchema({ name, tableName, columns: { id, ...columns }, synchronize: false });
}

export const c = {
  uuid: (name?: string): EntitySchemaColumnOptions => ({ name, type: "uuid", nullable: true }),
  text: (name?: string): EntitySchemaColumnOptions => ({ name, type: "text", nullable: true }),
  varchar: (name?: string): EntitySchemaColumnOptions => ({ name, type: "varchar", nullable: true }),
  bool: (name?: string): EntitySchemaColumnOptions => ({ name, type: "boolean", nullable: true }),
  int: (name?: string): EntitySchemaColumnOptions => ({ name, type: "int", nullable: true }),
  bigint: (name?: string): EntitySchemaColumnOptions => ({ name, type: "bigint", nullable: true }),
  date: (name?: string): EntitySchemaColumnOptions => ({ name, type: "date", nullable: true }),
  time: (name?: string): EntitySchemaColumnOptions => ({ name, type: "time", nullable: true }),
  instant: (name?: string): EntitySchemaColumnOptions => ({ name, type: "timestamptz", nullable: true }),
  json: (name?: string): EntitySchemaColumnOptions => ({ name, type: "jsonb", nullable: true }),
  bytes: (name?: string): EntitySchemaColumnOptions => ({ name, type: "bytea", nullable: true }),
};
