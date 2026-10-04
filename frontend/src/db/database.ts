import { SCHEMA_SQL } from "./schema";
import { runMigrations } from "./migrations";
import { seedDatabase } from "./seed";
import { openDatabaseAsync } from "./sqlite";
import type { SqlDB } from "./sqlite-types";

const DB_NAME = "pos.db";

let db: SqlDB | null = null;
let initPromise: Promise<void> | null = null;

/** Returns the open database handle. Throws if initDatabase() has not run. */
export function getDb(): SqlDB {
  if (!db) {
    throw new Error("Database not initialised. Call initDatabase() first.");
  }
  return db;
}

/** Opens the database, applies the schema and seeds baseline rows. Idempotent. */
export function initDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const handle = await openDatabaseAsync(DB_NAME);
    await handle.execAsync("PRAGMA journal_mode = WAL;");
    await handle.execAsync("PRAGMA foreign_keys = ON;");
    await handle.execAsync(SCHEMA_SQL);
    await runMigrations(handle);
    db = handle;
    await seedDatabase(handle);
  })();

  return initPromise;
}
