import { getDb } from "../database";
import type { Category } from "../types";
import { nowIso, uuid } from "@/src/lib/uuid";

export async function listCategories(): Promise<Category[]> {
  const db = getDb();
  return db.getAllAsync<Category>("SELECT * FROM categories ORDER BY name ASC");
}

export async function createCategory(name: string): Promise<Category> {
  const db = getDb();
  const now = nowIso();
  const id = uuid();
  await db.runAsync("INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", [
    id,
    name.trim(),
    now,
    now,
  ]);
  return { id, name: name.trim(), created_at: now, updated_at: now };
}
