import { getDb } from "../database";
import type { Product } from "../types";
import { nowIso, uuid } from "@/src/lib/uuid";

const SELECT_PRODUCT = `
  SELECT p.*, c.name AS category_name,
         COALESCE(s.quantity, 0) AS current_stock
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN stock s ON s.product_id = p.id
`;

export async function listProducts(search?: string): Promise<Product[]> {
  const db = getDb();
  const term = (search ?? "").trim();
  if (term) {
    const like = `%${term}%`;
    return db.getAllAsync<Product>(
      `${SELECT_PRODUCT} WHERE p.deleted_at IS NULL AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?) ORDER BY p.name ASC`,
      [like, like, like],
    );
  }
  return db.getAllAsync<Product>(`${SELECT_PRODUCT} WHERE p.deleted_at IS NULL ORDER BY p.name ASC`);
}

export async function listActiveProducts(search?: string): Promise<Product[]> {
  const db = getDb();
  const term = (search ?? "").trim();
  if (term) {
    const like = `%${term}%`;
    return db.getAllAsync<Product>(
      `${SELECT_PRODUCT} WHERE p.deleted_at IS NULL AND p.active = 1 AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?) ORDER BY p.name ASC`,
      [like, like, like],
    );
  }
  return db.getAllAsync<Product>(
    `${SELECT_PRODUCT} WHERE p.deleted_at IS NULL AND p.active = 1 ORDER BY p.name ASC`,
  );
}

export async function getProduct(id: string): Promise<Product | null> {
  const db = getDb();
  const row = await db.getFirstAsync<Product>(`${SELECT_PRODUCT} WHERE p.id = ?`, [id]);
  return row ?? null;
}

export async function findByCode(code: string): Promise<Product | null> {
  const db = getDb();
  const term = code.trim();
  const row = await db.getFirstAsync<Product>(
    `${SELECT_PRODUCT} WHERE p.deleted_at IS NULL AND p.active = 1 AND (p.sku = ? OR p.barcode = ?) LIMIT 1`,
    [term, term],
  );
  return row ?? null;
}

export interface ProductInput {
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  unit: string;
  brand: string | null;
  cost_price: number;
  sell_price: number;
  min_stock: number;
  active: boolean;
  initial_stock?: number;
}

export async function createProduct(input: ProductInput, userId: string): Promise<string> {
  const db = getDb();
  const id = uuid();
  const now = nowIso();
  const initial = Math.max(0, input.initial_stock ?? 0);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO products (id, name, sku, barcode, category_id, unit, brand, cost_price, sell_price, min_stock, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name.trim(),
        input.sku.trim(),
        input.barcode?.trim() || null,
        input.category_id,
        input.unit.trim() || "pcs",
        input.brand?.trim() || null,
        input.cost_price,
        input.sell_price,
        input.min_stock,
        input.active ? 1 : 0,
        now,
        now,
      ],
    );
    await db.runAsync("INSERT INTO stock (id, product_id, quantity, updated_at) VALUES (?, ?, ?, ?)", [
      uuid(),
      id,
      initial,
      now,
    ]);
    if (initial > 0) {
      await db.runAsync(
        `INSERT INTO stock_movements (id, product_id, type, qty_change, qty_before, qty_after, note, reference_id, user_id, created_at)
         VALUES (?, ?, 'in', ?, 0, ?, ?, NULL, ?, ?)`,
        [uuid(), id, initial, initial, "Stok awal produk", userId, now],
      );
    }
  });
  return id;
}

export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  const db = getDb();
  const now = nowIso();
  await db.runAsync(
    `UPDATE products SET name = ?, sku = ?, barcode = ?, category_id = ?, unit = ?, brand = ?, cost_price = ?, sell_price = ?, min_stock = ?, active = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.name.trim(),
      input.sku.trim(),
      input.barcode?.trim() || null,
      input.category_id,
      input.unit.trim() || "pcs",
      input.brand?.trim() || null,
      input.cost_price,
      input.sell_price,
      input.min_stock,
      input.active ? 1 : 0,
      now,
      id,
    ],
  );
}

export async function softDeleteProduct(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync("UPDATE products SET deleted_at = ?, active = 0, updated_at = ? WHERE id = ?", [
    nowIso(),
    nowIso(),
    id,
  ]);
}
