import { getDb } from "../database";
import type { SqlDB } from "../sqlite-types";
import { nowIso, uuid } from "@/src/lib/uuid";

// ---------- CSV helpers ----------

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Minimal RFC-4180 CSV parser (handles quotes, escaped quotes and newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toInt(v: string | undefined): number {
  if (!v) return 0;
  const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

// ---------- Export: Sales ----------

/** Export all (non-deleted) sales to CSV for accounting / spreadsheets. */
export async function exportSalesCsv(): Promise<string> {
  const db = getDb();
  const sales = await db.getAllAsync<{
    invoice_no: string;
    created_at: string;
    cashier_name: string | null;
    customer_name: string | null;
    payment_method: string;
    payment_status: string;
    status: string;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    grand_total: number;
    paid_amount: number;
  }>("SELECT * FROM sales WHERE deleted_at IS NULL ORDER BY created_at DESC");

  const header = [
    "Invoice",
    "Tanggal",
    "Kasir",
    "Pelanggan",
    "Metode",
    "Status Bayar",
    "Status",
    "Subtotal",
    "Diskon",
    "Pajak",
    "Total",
    "Dibayar",
  ];
  const lines = [header.join(",")];
  for (const s of sales) {
    lines.push(
      [
        s.invoice_no,
        s.created_at,
        s.cashier_name ?? "",
        s.customer_name ?? "Umum",
        s.payment_method,
        s.payment_status,
        s.status,
        s.subtotal,
        s.discount_amount,
        s.tax_amount,
        s.grand_total,
        s.paid_amount,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

// ---------- Import: Products & Stock ----------

export const PRODUCTS_CSV_TEMPLATE =
  "nama,sku,barcode,kategori,unit,harga_modal,harga_jual,stok_minimal,stok\n" +
  "Contoh Produk,SKU001,8991234567890,Minuman,pcs,5000,8000,5,100\n";

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  rows: number;
}

async function setStock(db: SqlDB, productId: string, qty: number, userId: string, now: string): Promise<void> {
  const srow = await db.getFirstAsync<{ quantity: number }>("SELECT quantity FROM stock WHERE product_id = ?", [productId]);
  const before = srow?.quantity ?? 0;
  if (!srow) {
    await db.runAsync("INSERT INTO stock (id, product_id, quantity, updated_at) VALUES (?, ?, ?, ?)", [uuid(), productId, qty, now]);
  } else {
    await db.runAsync("UPDATE stock SET quantity = ?, updated_at = ? WHERE product_id = ?", [qty, now, productId]);
  }
  const change = qty - before;
  if (change !== 0) {
    await db.runAsync(
      `INSERT INTO stock_movements (id, product_id, type, qty_change, qty_before, qty_after, note, reference_id, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [uuid(), productId, change > 0 ? "in" : "out", Math.abs(change), before, qty, "Impor produk & stok", userId, now],
    );
  }
}

/** Count how many data rows a product CSV contains (excludes header & blanks). */
export function countProductCsvRows(csv: string): number {
  const rows = parseCsv(csv);
  if (rows.length < 2) return 0;
  return rows.slice(1).filter((r) => r.some((c) => c.trim() !== "")).length;
}

/**
 * Import products (and their stock) from a CSV. Matches existing products by
 * SKU, then by name; updates matches and inserts the rest. Categories are
 * created on the fly. Runs inside a single transaction.
 */
export async function importProductsCsv(csv: string, userId: string): Promise<ImportResult> {
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error("File CSV kosong atau tidak memiliki data");

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const cName = col(["nama", "name", "nama produk", "product"]);
  const cSku = col(["sku", "kode"]);
  const cBarcode = col(["barcode"]);
  const cCat = col(["kategori", "category"]);
  const cUnit = col(["unit", "satuan"]);
  const cCost = col(["harga_modal", "modal", "cost", "hpp"]);
  const cSell = col(["harga_jual", "jual", "harga", "price", "sell"]);
  const cMin = col(["stok_minimal", "min_stok", "minimum", "min_stock"]);
  const cStock = col(["stok", "stock", "qty", "jumlah"]);

  if (cName < 0 || cSell < 0) {
    throw new Error("Kolom wajib 'nama' dan 'harga_jual' tidak ditemukan");
  }

  const db = getDb();
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, rows: 0 };

  const cats = await db.getAllAsync<{ id: string; name: string }>("SELECT id, name FROM categories");
  const catMap = new Map(cats.map((c) => [c.name.trim().toLowerCase(), c.id]));

  await db.withTransactionAsync(async () => {
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.every((x) => x.trim() === "")) continue;
      result.rows++;

      const name = (row[cName] ?? "").trim();
      if (!name) {
        result.skipped++;
        continue;
      }
      const sku = cSku >= 0 ? (row[cSku] ?? "").trim() : "";
      const barcode = cBarcode >= 0 ? (row[cBarcode] ?? "").trim() || null : null;
      const unit = cUnit >= 0 ? (row[cUnit] ?? "").trim() || "pcs" : "pcs";
      const cost = cCost >= 0 ? toInt(row[cCost]) : 0;
      const sell = cSell >= 0 ? toInt(row[cSell]) : 0;
      const minStock = cMin >= 0 ? toInt(row[cMin]) : 0;
      const stockQty = cStock >= 0 ? toInt(row[cStock]) : 0;
      const now = nowIso();

      let categoryId: string | null = null;
      if (cCat >= 0) {
        const catName = (row[cCat] ?? "").trim();
        if (catName) {
          const key = catName.toLowerCase();
          categoryId = catMap.get(key) ?? null;
          if (!categoryId) {
            categoryId = uuid();
            await db.runAsync("INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", [categoryId, catName, now, now]);
            catMap.set(key, categoryId);
          }
        }
      }

      let existing: { id: string } | null = null;
      if (sku) existing = await db.getFirstAsync<{ id: string }>("SELECT id FROM products WHERE sku = ? AND deleted_at IS NULL", [sku]);
      if (!existing) existing = await db.getFirstAsync<{ id: string }>("SELECT id FROM products WHERE name = ? AND deleted_at IS NULL", [name]);

      if (existing) {
        await db.runAsync(
          `UPDATE products SET name = ?, sku = ?, barcode = ?, category_id = ?, unit = ?, cost_price = ?, sell_price = ?, min_stock = ?, active = 1, updated_at = ?
           WHERE id = ?`,
          [name, sku || `P${existing.id.slice(0, 6)}`, barcode, categoryId, unit, cost, sell, minStock, now, existing.id],
        );
        if (cStock >= 0) await setStock(db, existing.id, stockQty, userId, now);
        result.updated++;
      } else {
        const id = uuid();
        await db.runAsync(
          `INSERT INTO products (id, name, sku, barcode, category_id, unit, cost_price, sell_price, min_stock, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [id, name, sku || `P${id.slice(0, 6)}`, barcode, categoryId, unit, cost, sell, minStock, now, now],
        );
        await db.runAsync("INSERT INTO stock (id, product_id, quantity, updated_at) VALUES (?, ?, ?, ?)", [uuid(), id, cStock >= 0 ? stockQty : 0, now]);
        if (cStock >= 0 && stockQty > 0) {
          await db.runAsync(
            `INSERT INTO stock_movements (id, product_id, type, qty_change, qty_before, qty_after, note, reference_id, user_id, created_at)
             VALUES (?, ?, 'in', ?, 0, ?, ?, NULL, ?, ?)`,
            [uuid(), id, stockQty, stockQty, "Impor produk & stok", userId, now],
          );
        }
        result.created++;
      }
    }
  });

  return result;
}
