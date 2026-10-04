import { getDb } from "../database";
import type { MovementType, Product, StockMovement } from "../types";
import { nowIso, uuid } from "@/src/lib/uuid";

async function getQuantity(productId: string): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ quantity: number }>(
    "SELECT quantity FROM stock WHERE product_id = ?",
    [productId],
  );
  return row?.quantity ?? 0;
}

/**
 * Apply a stock change atomically: recompute quantity, update the stock row and
 * record a stock_movement — all within one transaction so they succeed or roll
 * back together. `targetQty` drives adjustments; otherwise `delta` is used.
 */
async function applyMovement(params: {
  productId: string;
  type: MovementType;
  delta?: number;
  targetQty?: number;
  note: string | null;
  referenceId?: string | null;
  userId: string | null;
}): Promise<void> {
  const db = getDb();
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    const before = await getQuantity(params.productId);
    const after = params.targetQty !== undefined ? params.targetQty : before + (params.delta ?? 0);
    if (after < 0) {
      throw new Error("Stok tidak mencukupi");
    }
    const change = after - before;
    await db.runAsync("UPDATE stock SET quantity = ?, updated_at = ? WHERE product_id = ?", [
      after,
      now,
      params.productId,
    ]);
    await db.runAsync(
      `INSERT INTO stock_movements (id, product_id, type, qty_change, qty_before, qty_after, note, reference_id, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), params.productId, params.type, change, before, after, params.note, params.referenceId ?? null, params.userId, now],
    );
  });
}

export async function stockIn(productId: string, qty: number, note: string | null, userId: string): Promise<void> {
  if (qty <= 0) throw new Error("Jumlah harus lebih dari 0");
  await applyMovement({ productId, type: "in", delta: qty, note, userId });
}

export async function stockOut(productId: string, qty: number, note: string | null, userId: string): Promise<void> {
  if (qty <= 0) throw new Error("Jumlah harus lebih dari 0");
  await applyMovement({ productId, type: "out", delta: -qty, note, userId });
}

export async function stockAdjust(productId: string, newQty: number, note: string | null, userId: string): Promise<void> {
  if (newQty < 0) throw new Error("Stok tidak boleh negatif");
  await applyMovement({ productId, type: "adjustment", targetQty: newQty, note, userId });
}

export async function listMovements(limit = 100): Promise<StockMovement[]> {
  const db = getDb();
  return db.getAllAsync<StockMovement>(
    `SELECT m.*, p.name AS product_name, u.name AS user_name
     FROM stock_movements m
     LEFT JOIN products p ON p.id = m.product_id
     LEFT JOIN users u ON u.id = m.user_id
     ORDER BY m.created_at DESC
     LIMIT ?`,
    [limit],
  );
}

export async function lowStockProducts(): Promise<Product[]> {
  const db = getDb();
  return db.getAllAsync<Product>(
    `SELECT p.*, c.name AS category_name, COALESCE(s.quantity, 0) AS current_stock
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN stock s ON s.product_id = p.id
     WHERE p.deleted_at IS NULL AND p.active = 1 AND p.min_stock > 0 AND COALESCE(s.quantity, 0) <= p.min_stock
     ORDER BY current_stock ASC`,
  );
}
