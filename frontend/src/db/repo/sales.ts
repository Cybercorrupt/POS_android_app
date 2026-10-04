import { getDb } from "../database";
import type { DiscountType, Payment, PaymentMethod, PaymentStatus, Sale, SaleItem, SaleWithDetails } from "../types";
import { nowIso, uuid } from "@/src/lib/uuid";

export interface CartLine {
  product_id: string;
  product_name: string;
  sku: string | null;
  qty: number;
  price: number;
}

export interface CreateSaleInput {
  customerId: string | null;
  userId: string;
  items: CartLine[];
  discountType: DiscountType;
  discountValue: number;
  taxPercent: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  note: string | null;
}

export interface SaleTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
}

/** Pure total calculation, reused by the POS screen preview and by createSale. */
export function computeTotals(
  items: CartLine[],
  discountType: DiscountType,
  discountValue: number,
  taxPercent: number,
): SaleTotals {
  const subtotal = items.reduce((sum, it) => sum + it.qty * it.price, 0);
  let discountAmount = discountType === "percent"
    ? Math.round((subtotal * discountValue) / 100)
    : discountValue;
  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = Math.round((afterDiscount * taxPercent) / 100);
  const grandTotal = afterDiscount + taxAmount;
  return { subtotal, discountAmount, taxAmount, grandTotal };
}

async function generateInvoiceNo(db: ReturnType<typeof getDb>): Promise<string> {
  const d = new Date();
  const prefix = `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-`;
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM sales WHERE invoice_no LIKE ?",
    [`${prefix}%`],
  );
  const seq = (row?.c ?? 0) + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * Create a complete sale in ONE database transaction: sale header, sale_items,
 * payment, stock_movements and the stock decrement all commit together or roll
 * back entirely. Validates stock and payment before writing anything.
 */
export async function createSale(input: CreateSaleInput): Promise<string> {
  const db = getDb();
  if (input.items.length === 0) throw new Error("Keranjang masih kosong");

  const totals = computeTotals(input.items, input.discountType, input.discountValue, input.taxPercent);

  // Resolve paid amount & change based on method + status.
  let paid = input.paidAmount;
  let change = 0;
  if (input.paymentStatus === "lunas") {
    if (input.paymentMethod === "cash") {
      if (paid < totals.grandTotal) throw new Error("Jumlah bayar kurang dari total");
      change = paid - totals.grandTotal;
    } else {
      // Non-cash paid in full: no change.
      paid = totals.grandTotal;
      change = 0;
    }
  } else {
    // Belum lunas: down payment (or 0) allowed, never more than total, no change.
    paid = Math.max(0, Math.min(paid, totals.grandTotal));
    change = 0;
  }

  const saleId = uuid();
  const now = nowIso();

  await db.withTransactionAsync(async () => {
    // 1. Validate stock for every line.
    for (const line of input.items) {
      const stockRow = await db.getFirstAsync<{ quantity: number }>(
        "SELECT quantity FROM stock WHERE product_id = ?",
        [line.product_id],
      );
      const available = stockRow?.quantity ?? 0;
      if (available < line.qty) {
        throw new Error(`Stok "${line.product_name}" tidak mencukupi (tersisa ${available})`);
      }
    }

    // 2. Sale header.
    const invoiceNo = await generateInvoiceNo(db);
    await db.runAsync(
      `INSERT INTO sales (id, invoice_no, customer_id, user_id, subtotal, discount_type, discount_value, discount_amount, tax_percent, tax_amount, grand_total, paid_amount, change_amount, payment_method, payment_status, note, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
      [
        saleId,
        invoiceNo,
        input.customerId,
        input.userId,
        totals.subtotal,
        input.discountType,
        input.discountValue,
        totals.discountAmount,
        input.taxPercent,
        totals.taxAmount,
        totals.grandTotal,
        paid,
        change,
        input.paymentMethod,
        input.paymentStatus,
        input.note,
        now,
        now,
      ],
    );

    // 3. Items + 4. stock decrement + movement per line.
    for (const line of input.items) {
      const lineTotal = line.qty * line.price;
      await db.runAsync(
        `INSERT INTO sale_items (id, sale_id, product_id, product_name, sku, qty, price, line_total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), saleId, line.product_id, line.product_name, line.sku, line.qty, line.price, lineTotal, now],
      );

      const stockRow = await db.getFirstAsync<{ quantity: number }>(
        "SELECT quantity FROM stock WHERE product_id = ?",
        [line.product_id],
      );
      const before = stockRow?.quantity ?? 0;
      const after = before - line.qty;
      await db.runAsync("UPDATE stock SET quantity = ?, updated_at = ? WHERE product_id = ?", [after, now, line.product_id]);
      await db.runAsync(
        `INSERT INTO stock_movements (id, product_id, type, qty_change, qty_before, qty_after, note, reference_id, user_id, created_at)
         VALUES (?, ?, 'sale', ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), line.product_id, -line.qty, before, after, `Penjualan ${invoiceNo}`, saleId, input.userId, now],
      );
    }

    // 5. Payment.
    await db.runAsync(
      `INSERT INTO payments (id, sale_id, method, amount, paid_amount, change_amount, status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), saleId, input.paymentMethod, totals.grandTotal, paid, change, input.paymentStatus, input.note, now],
    );
  });

  return saleId;
}

export async function listSales(search?: string): Promise<Sale[]> {
  const db = getDb();
  const base = `
    SELECT s.*, c.name AS customer_name, u.name AS cashier_name
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.deleted_at IS NULL
  `;
  const term = (search ?? "").trim();
  if (term) {
    const like = `%${term}%`;
    return db.getAllAsync<Sale>(
      `${base} AND (s.invoice_no LIKE ? OR c.name LIKE ?) ORDER BY s.created_at DESC`,
      [like, like],
    );
  }
  return db.getAllAsync<Sale>(`${base} ORDER BY s.created_at DESC`);
}

export async function getSaleDetails(id: string): Promise<SaleWithDetails | null> {
  const db = getDb();
  const sale = await db.getFirstAsync<Sale>(
    `SELECT s.*, c.name AS customer_name, u.name AS cashier_name
     FROM sales s
     LEFT JOIN customers c ON c.id = s.customer_id
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
    [id],
  );
  if (!sale) return null;
  const items = await db.getAllAsync<SaleItem>(
    "SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC",
    [id],
  );
  const payments = await db.getAllAsync<Payment>(
    "SELECT * FROM payments WHERE sale_id = ? ORDER BY created_at ASC",
    [id],
  );
  return { sale, items, payment: payments[0] ?? null, payments };
}

/**
 * Void (cancel) a completed sale: marks the sale status as 'void' and returns
 * every sold unit back to stock with a reversing 'in' stock movement, all in a
 * single transaction. The sale row is kept (soft) so history stays auditable.
 */
export async function voidSale(saleId: string, userId: string): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    const sale = await db.getFirstAsync<{ status: string; invoice_no: string }>(
      "SELECT status, invoice_no FROM sales WHERE id = ?",
      [saleId],
    );
    if (!sale) throw new Error("Transaksi tidak ditemukan");
    if (sale.status === "void") throw new Error("Transaksi sudah dibatalkan");

    const items = await db.getAllAsync<{ product_id: string | null; qty: number }>(
      "SELECT product_id, qty FROM sale_items WHERE sale_id = ?",
      [saleId],
    );
    const now = nowIso();
    for (const it of items) {
      if (!it.product_id) continue;
      const stockRow = await db.getFirstAsync<{ quantity: number }>(
        "SELECT quantity FROM stock WHERE product_id = ?",
        [it.product_id],
      );
      const before = stockRow?.quantity ?? 0;
      const after = before + it.qty;
      await db.runAsync("UPDATE stock SET quantity = ?, updated_at = ? WHERE product_id = ?", [after, now, it.product_id]);
      await db.runAsync(
        `INSERT INTO stock_movements (id, product_id, type, qty_change, qty_before, qty_after, note, reference_id, user_id, created_at)
         VALUES (?, ?, 'in', ?, ?, ?, ?, ?, ?, ?)`,
        [uuid(), it.product_id, it.qty, before, after, `Void ${sale.invoice_no}`, saleId, userId, now],
      );
    }

    await db.runAsync("UPDATE sales SET status = 'void', updated_at = ? WHERE id = ?", [now, saleId]);
  });
}

/**
 * Settle an outstanding (belum_lunas) sale — mark it fully paid. Sets paid_amount
 * to grand_total and payment_status to 'lunas' on both the sale header and its
 * payment row. Optionally records the payment method used to settle.
 */
export async function settleSale(saleId: string, method?: PaymentMethod): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    const sale = await db.getFirstAsync<{ status: string; payment_status: string; grand_total: number }>(
      "SELECT status, payment_status, grand_total FROM sales WHERE id = ?",
      [saleId],
    );
    if (!sale) throw new Error("Transaksi tidak ditemukan");
    if (sale.status === "void") throw new Error("Transaksi sudah dibatalkan");
    if (sale.payment_status === "lunas") throw new Error("Transaksi sudah lunas");

    const now = nowIso();
    const total = sale.grand_total;
    if (method) {
      await db.runAsync(
        "UPDATE sales SET payment_status = 'lunas', paid_amount = ?, change_amount = 0, payment_method = ?, updated_at = ? WHERE id = ?",
        [total, method, now, saleId],
      );
      await db.runAsync(
        "UPDATE payments SET status = 'lunas', amount = ?, paid_amount = ?, change_amount = 0, method = ? WHERE sale_id = ?",
        [total, total, method, saleId],
      );
    } else {
      await db.runAsync(
        "UPDATE sales SET payment_status = 'lunas', paid_amount = ?, change_amount = 0, updated_at = ? WHERE id = ?",
        [total, now, saleId],
      );
      await db.runAsync(
        "UPDATE payments SET status = 'lunas', amount = ?, paid_amount = ?, change_amount = 0 WHERE sale_id = ?",
        [total, total, saleId],
      );
    }
  });
}

/**
 * Record a partial (installment) payment against an outstanding (belum_lunas)
 * sale. Adds the amount to the sale's paid_amount, inserts a payment history
 * row, and automatically flips the sale to 'lunas' once the running paid amount
 * reaches the grand total. Any amount over the outstanding balance is clamped.
 * Returns whether the sale is now fully paid and the remaining balance.
 */
export async function recordPayment(
  saleId: string,
  amount: number,
  method: PaymentMethod,
): Promise<{ lunas: boolean; outstanding: number; applied: number }> {
  const db = getDb();
  let result = { lunas: false, outstanding: 0, applied: 0 };
  await db.withTransactionAsync(async () => {
    const sale = await db.getFirstAsync<{
      status: string;
      payment_status: string;
      grand_total: number;
      paid_amount: number;
    }>(
      "SELECT status, payment_status, grand_total, paid_amount FROM sales WHERE id = ?",
      [saleId],
    );
    if (!sale) throw new Error("Transaksi tidak ditemukan");
    if (sale.status === "void") throw new Error("Transaksi sudah dibatalkan");
    if (sale.payment_status === "lunas") throw new Error("Transaksi sudah lunas");

    const outstandingBefore = sale.grand_total - sale.paid_amount;
    if (outstandingBefore <= 0) throw new Error("Tidak ada sisa tagihan");

    const pay = Math.floor(amount);
    if (!Number.isFinite(pay) || pay <= 0) throw new Error("Nominal pembayaran tidak valid");

    const applied = Math.min(pay, outstandingBefore);
    const newPaid = sale.paid_amount + applied;
    const becomesLunas = newPaid >= sale.grand_total;
    const newStatus: PaymentStatus = becomesLunas ? "lunas" : "belum_lunas";
    const now = nowIso();

    await db.runAsync(
      `INSERT INTO payments (id, sale_id, method, amount, paid_amount, change_amount, status, note, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [uuid(), saleId, method, applied, applied, newStatus, "Pembayaran angsuran", now],
    );

    await db.runAsync(
      "UPDATE sales SET paid_amount = ?, payment_status = ?, payment_method = ?, change_amount = 0, updated_at = ? WHERE id = ?",
      [newPaid, newStatus, method, now, saleId],
    );

    result = { lunas: becomesLunas, outstanding: sale.grand_total - newPaid, applied };
  });
  return result;
}
