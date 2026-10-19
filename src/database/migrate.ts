import "dotenv/config";
import { AppDataSource } from "./data-source";

async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    if (process.argv[2] === "down") await AppDataSource.undoLastMigration({ transaction: "all" });
    else await AppDataSource.runMigrations({ transaction: "all" });
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Migration failed");
  process.exitCode = 1;
});
