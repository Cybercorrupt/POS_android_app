import { getDb } from "../database";
import type { PaymentMethod } from "../types";

export interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  todayItemsSold: number;
  productCount: number;
  lowStockCount: number;
  paidTotal: number;
  paidCount: number;
  unpaidTotal: number;
  unpaidCount: number;
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getDb();
  const since = startOfTodayIso();

  const sales = await db.getFirstAsync<{ total: number; cnt: number }>(
    "SELECT COALESCE(SUM(grand_total), 0) AS total, COUNT(*) AS cnt FROM sales WHERE deleted_at IS NULL AND status != 'void' AND created_at >= ?",
    [since],
  );
  const items = await db.getFirstAsync<{ qty: number }>(
    `SELECT COALESCE(SUM(si.qty), 0) AS qty
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.deleted_at IS NULL AND s.status != 'void' AND s.created_at >= ?`,
    [since],
  );
  const products = await db.getFirstAsync<{ cnt: number }>(
    "SELECT COUNT(*) AS cnt FROM products WHERE deleted_at IS NULL",
  );
  const lowStock = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt
     FROM products p
     LEFT JOIN stock s ON s.product_id = p.id
     WHERE p.deleted_at IS NULL AND p.active = 1 AND p.min_stock > 0 AND COALESCE(s.quantity, 0) <= p.min_stock`,
  );

  const pay = await db.getFirstAsync<{ paid_total: number; paid_cnt: number; unpaid_total: number; unpaid_cnt: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN payment_status = 'lunas' THEN grand_total ELSE 0 END), 0) AS paid_total,
       COALESCE(SUM(CASE WHEN payment_status = 'lunas' THEN 1 ELSE 0 END), 0) AS paid_cnt,
       COALESCE(SUM(CASE WHEN payment_status = 'belum_lunas' THEN grand_total - paid_amount ELSE 0 END), 0) AS unpaid_total,
       COALESCE(SUM(CASE WHEN payment_status = 'belum_lunas' THEN 1 ELSE 0 END), 0) AS unpaid_cnt
     FROM sales WHERE deleted_at IS NULL AND status != 'void' AND created_at >= ?`,
    [since],
  );

  return {
    todaySales: sales?.total ?? 0,
    todayTransactions: sales?.cnt ?? 0,
    todayItemsSold: items?.qty ?? 0,
    productCount: products?.cnt ?? 0,
    lowStockCount: lowStock?.cnt ?? 0,
    paidTotal: pay?.paid_total ?? 0,
    paidCount: pay?.paid_cnt ?? 0,
    unpaidTotal: pay?.unpaid_total ?? 0,
    unpaidCount: pay?.unpaid_cnt ?? 0,
  };
}

export interface PaymentBreakdown {
  method: PaymentMethod;
  total: number;
  count: number;
}

export interface TopProduct {
  product_name: string;
  qty: number;
  total: number;
}

export interface DailyReport {
  date: string; // ISO of the report day
  totalSales: number;
  transactions: number;
  itemsSold: number;
  totalPaid: number;
  totalOutstanding: number;
  byMethod: PaymentBreakdown[];
  topProducts: TopProduct[];
}

function dayRange(input: string): { start: string; end: string } {
  const start = new Date(input);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Full sales summary for a single day: totals, payment-method split & top products. */
export async function getDailyReport(dateInput: string): Promise<DailyReport> {
  const { start, end } = dayRange(dateInput);
  return getRangeReport(start, end);
}

/** Sales summary for an arbitrary [start, end) ISO range. */
export async function getRangeReport(start: string, end: string): Promise<DailyReport> {
  const db = getDb();

  const summary = await db.getFirstAsync<{ total: number; cnt: number; paid: number }>(
    `SELECT COALESCE(SUM(grand_total), 0) AS total, COUNT(*) AS cnt, COALESCE(SUM(paid_amount), 0) AS paid
     FROM sales WHERE deleted_at IS NULL AND status != 'void' AND created_at >= ? AND created_at < ?`,
    [start, end],
  );
  const items = await db.getFirstAsync<{ qty: number }>(
    `SELECT COALESCE(SUM(si.qty), 0) AS qty FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.deleted_at IS NULL AND s.status != 'void' AND s.created_at >= ? AND s.created_at < ?`,
    [start, end],
  );
  const byMethod = await db.getAllAsync<PaymentBreakdown>(
    `SELECT payment_method AS method, COALESCE(SUM(grand_total), 0) AS total, COUNT(*) AS count
     FROM sales WHERE deleted_at IS NULL AND status != 'void' AND created_at >= ? AND created_at < ?
     GROUP BY payment_method ORDER BY total DESC`,
    [start, end],
  );
  const topProducts = await db.getAllAsync<TopProduct>(
    `SELECT si.product_name AS product_name, COALESCE(SUM(si.qty), 0) AS qty, COALESCE(SUM(si.line_total), 0) AS total
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.deleted_at IS NULL AND s.status != 'void' AND s.created_at >= ? AND s.created_at < ?
     GROUP BY si.product_name ORDER BY qty DESC, total DESC LIMIT 5`,
    [start, end],
  );

  const totalSales = summary?.total ?? 0;
  const totalPaid = summary?.paid ?? 0;
  return {
    date: start,
    totalSales,
    transactions: summary?.cnt ?? 0,
    itemsSold: items?.qty ?? 0,
    totalPaid,
    totalOutstanding: Math.max(0, totalSales - totalPaid),
    byMethod,
    topProducts,
  };
}

export interface PeriodTotals {
  today: number;
  week: number;
  month: number;
  year: number;
}

/** Total sales (excluding voided) for today / this week / this month / this year. */
export async function getPeriodTotals(): Promise<PeriodTotals> {
  const db = getDb();
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const week = new Date(today);
  week.setDate(week.getDate() - ((week.getDay() + 6) % 7)); // Monday as week start
  const month = new Date(today.getFullYear(), today.getMonth(), 1);
  const year = new Date(today.getFullYear(), 0, 1);

  const sumSince = async (since: Date): Promise<number> => {
    const r = await db.getFirstAsync<{ t: number }>(
      "SELECT COALESCE(SUM(grand_total), 0) AS t FROM sales WHERE deleted_at IS NULL AND status != 'void' AND created_at >= ?",
      [since.toISOString()],
    );
    return r?.t ?? 0;
  };

  return {
    today: await sumSince(today),
    week: await sumSince(week),
    month: await sumSince(month),
    year: await sumSince(year),
  };
}


export interface DaySalesPoint {
  date: string;
  label: string;
  total: number;
}

/** Daily sales totals for the last `days` days (oldest → newest), void excluded. */
export async function getDailySalesSeries(days: number): Promise<DaySalesPoint[]> {
  const db = getDb();
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const out: DaySalesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(base);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const r = await db.getFirstAsync<{ t: number }>(
      "SELECT COALESCE(SUM(grand_total), 0) AS t FROM sales WHERE deleted_at IS NULL AND status != 'void' AND created_at >= ? AND created_at < ?",
      [start.toISOString(), end.toISOString()],
    );
    out.push({
      date: start.toISOString(),
      label: start.toLocaleDateString("id-ID", { weekday: "short" }),
      total: r?.t ?? 0,
    });
  }
  return out;
}

