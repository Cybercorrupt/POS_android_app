import { getDb } from "../database";
import { nowIso } from "@/src/lib/uuid";

// Tables in foreign-key dependency order (parents first). Import inserts in
// this order and deletes in reverse so references always resolve.
const TABLES = [
  "roles",
  "users",
  "categories",
  "units",
  "brands",
  "products",
  "stock",
  "customers",
  "sales",
  "sale_items",
  "payments",
  "stock_movements",
  "settings",
] as const;

export interface BackupData {
  app: "kasir-pos";
  version: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}

/** Serialise every table into a single JSON-friendly object. */
export async function exportAllData(): Promise<BackupData> {
  const db = getDb();
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABLES) {
    tables[t] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t}`);
  }
  return { app: "kasir-pos", version: 1, exportedAt: nowIso(), tables };
}

export interface BackupSummary {
  products: number;
  sales: number;
  customers: number;
  exportedAt: string | null;
}

/** Quick counts used to preview a backup file before the user confirms import. */
export function summarise(data: BackupData): BackupSummary {
  return {
    products: data.tables?.products?.length ?? 0,
    sales: data.tables?.sales?.length ?? 0,
    customers: data.tables?.customers?.length ?? 0,
    exportedAt: data.exportedAt ?? null,
  };
}

export function isValidBackup(data: unknown): data is BackupData {
  const d = data as BackupData;
  return !!d && d.app === "kasir-pos" && !!d.tables && typeof d.tables === "object";
}

/**
 * Replace ALL local data with the contents of a backup file. Wipes every table
 * (reverse FK order) and re-inserts the backed-up rows inside one transaction,
 * so a failed import rolls back and leaves the database untouched.
 */
export async function importAllData(data: BackupData): Promise<void> {
  if (!isValidBackup(data)) throw new Error("File backup tidak valid");
  const db = getDb();

  await db.execAsync("PRAGMA foreign_keys = OFF;");
  try {
    await db.withTransactionAsync(async () => {
      for (const t of [...TABLES].reverse()) {
        await db.runAsync(`DELETE FROM ${t}`);
      }
      for (const t of TABLES) {
        const rows = data.tables[t] ?? [];
        for (const row of rows) {
          const cols = Object.keys(row);
          if (cols.length === 0) continue;
          const placeholders = cols.map(() => "?").join(", ");
          const values = cols.map((c) => (row as Record<string, unknown>)[c] as unknown);
          await db.runAsync(
            `INSERT INTO ${t} (${cols.join(", ")}) VALUES (${placeholders})`,
            values,
          );
        }
      }
    });
  } finally {
    await db.execAsync("PRAGMA foreign_keys = ON;");
  }
}
