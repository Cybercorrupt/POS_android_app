import { getDb } from "../database";
import type { Brand } from "../types";
import { nowIso, uuid } from "@/src/lib/uuid";

export async function listBrands(): Promise<Brand[]> {
  const db = getDb();
  return db.getAllAsync<Brand>("SELECT * FROM brands WHERE deleted_at IS NULL ORDER BY name ASC");
}

export async function createBrand(name: string): Promise<Brand> {
  const db = getDb();
  const now = nowIso();
  const id = uuid();
  await db.runAsync("INSERT INTO brands (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", [
    id,
    name.trim(),
    now,
    now,
  ]);
  return { id, name: name.trim(), created_at: now, updated_at: now };
}

export async function softDeleteBrand(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync("UPDATE brands SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
}
