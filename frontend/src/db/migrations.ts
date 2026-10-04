import type { SqlDB } from "./sqlite-types";

// Lightweight column migrations for databases created by an earlier schema
// version (native installs). Adds missing columns; CREATE TABLE IF NOT EXISTS
// handles brand-new tables. Safe to run on every launch.

async function hasColumn(db: SqlDB, table: string, column: string): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

export async function runMigrations(db: SqlDB): Promise<void> {
  const addColumn = async (table: string, column: string, ddl: string) => {
    if (!(await hasColumn(db, table, column))) {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  };

  await addColumn("sales", "payment_method", "payment_method TEXT NOT NULL DEFAULT 'cash'");
  await addColumn("sales", "payment_status", "payment_status TEXT NOT NULL DEFAULT 'lunas'");
  await addColumn("sales", "note", "note TEXT");
  await addColumn("payments", "status", "status TEXT NOT NULL DEFAULT 'lunas'");
  await addColumn("payments", "note", "note TEXT");
  await addColumn("settings", "store_logo", "store_logo TEXT NOT NULL DEFAULT ''");
  await addColumn("products", "brand", "brand TEXT");
}
