import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { env } from "@/config/env";
import { entities } from "./entities";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: env().DATABASE_URL,
  entities,
  migrations: ["src/database/migrations/*.{ts,js}"],
  synchronize: false,
  ssl: env().NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
});

declare global { var __edupresenceDataSource: DataSource | undefined; }

export async function database(): Promise<DataSource> {
  const instance = globalThis.__edupresenceDataSource ?? AppDataSource;
  if (!instance.isInitialized) await instance.initialize();
  if (env().NODE_ENV !== "production") globalThis.__edupresenceDataSource = instance;
  return instance;
}
