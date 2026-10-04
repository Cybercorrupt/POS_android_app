import { getDb } from "../database";
import type { Customer } from "../types";
import { nowIso, uuid } from "@/src/lib/uuid";

export async function listCustomers(search?: string): Promise<Customer[]> {
  const db = getDb();
  const term = (search ?? "").trim();
  if (term) {
    const like = `%${term}%`;
    return db.getAllAsync<Customer>(
      "SELECT * FROM customers WHERE deleted_at IS NULL AND (name LIKE ? OR phone LIKE ?) ORDER BY name ASC",
      [like, like],
    );
  }
  return db.getAllAsync<Customer>(
    "SELECT * FROM customers WHERE deleted_at IS NULL ORDER BY name ASC",
  );
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const db = getDb();
  const row = await db.getFirstAsync<Customer>("SELECT * FROM customers WHERE id = ?", [id]);
  return row ?? null;
}

export interface CustomerInput {
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
}

export async function createCustomer(input: CustomerInput): Promise<string> {
  const db = getDb();
  const id = uuid();
  const now = nowIso();
  await db.runAsync(
    "INSERT INTO customers (id, name, phone, address, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, input.name.trim(), input.phone?.trim() || null, input.address?.trim() || null, input.note?.trim() || null, now, now],
  );
  return id;
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<void> {
  const db = getDb();
  await db.runAsync(
    "UPDATE customers SET name = ?, phone = ?, address = ?, note = ?, updated_at = ? WHERE id = ?",
    [input.name.trim(), input.phone?.trim() || null, input.address?.trim() || null, input.note?.trim() || null, nowIso(), id],
  );
}

export async function softDeleteCustomer(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync("UPDATE customers SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
}
