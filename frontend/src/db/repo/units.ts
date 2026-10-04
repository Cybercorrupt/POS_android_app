import { getDb } from "../database";
import type { Unit } from "../types";
import { nowIso, uuid } from "@/src/lib/uuid";

export async function listUnits(): Promise<Unit[]> {
  const db = getDb();
  return db.getAllAsync<Unit>("SELECT * FROM units WHERE deleted_at IS NULL ORDER BY name ASC");
}

export async function createUnit(name: string): Promise<Unit> {
  const db = getDb();
  const now = nowIso();
  const id = uuid();
  await db.runAsync("INSERT INTO units (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", [
    id,
    name.trim(),
    now,
    now,
  ]);
  return { id, name: name.trim(), created_at: now, updated_at: now };
}

export async function softDeleteUnit(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync("UPDATE units SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
}
