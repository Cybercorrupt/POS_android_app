// Domain types. Mirror the SQLite schema so screens never touch raw rows.
// Money is stored as whole-rupiah INTEGERs.

export type RoleName = "admin" | "kasir";

export interface Role {
  id: string;
  name: RoleName;
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  password_hash: string;
  salt: string;
  role_id: string;
  role_name: RoleName;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  category_name: string | null;
  unit: string;
  brand: string | null;
  cost_price: number;
  sell_price: number;
  min_stock: number;
  current_stock: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type DiscountType = "nominal" | "percent";

export type PaymentMethod = "cash" | "transfer" | "qris" | "debit" | "ewallet";
export type PaymentStatus = "lunas" | "belum_lunas";

export interface Unit {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  invoice_no: string;
  customer_id: string | null;
  customer_name: string | null;
  user_id: string;
  cashier_name: string | null;
  subtotal: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  grand_total: number;
  paid_amount: number;
  change_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  note: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  sku: string | null;
  qty: number;
  price: number;
  line_total: number;
  created_at: string;
}

export interface Payment {
  id: string;
  sale_id: string;
  method: PaymentMethod;
  amount: number;
  paid_amount: number;
  change_amount: number;
  status: PaymentStatus;
  note: string | null;
  created_at: string;
}

export type MovementType = "in" | "out" | "adjustment" | "sale";

export interface StockMovement {
  id: string;
  product_id: string;
  product_name: string | null;
  type: MovementType;
  qty_change: number;
  qty_before: number;
  qty_after: number;
  note: string | null;
  reference_id: string | null;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
}

export interface Settings {
  id: string;
  store_name: string;
  store_address: string;
  store_phone: string;
  store_logo: string;
  receipt_header: string;
  receipt_footer: string;
  default_tax_percent: number;
  currency: string;
  updated_at: string;
}

export interface SaleWithDetails {
  sale: Sale;
  items: SaleItem[];
  payment: Payment | null;
  payments: Payment[];
}
