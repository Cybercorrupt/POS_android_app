// SQLite schema. Every table uses a UUID TEXT primary key, created_at /
// updated_at ISO strings, parameterized access only, and foreign keys so the
// shape maps cleanly onto Postgres/Supabase later. Money columns are whole
// rupiah INTEGERs. Soft deletes via deleted_at where destructive edits happen.

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT,
  category_id TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs',
  brand TEXT,
  cost_price INTEGER NOT NULL DEFAULT 0,
  sell_price INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS stock (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_no TEXT NOT NULL UNIQUE,
  customer_id TEXT,
  user_id TEXT NOT NULL,
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount_type TEXT NOT NULL DEFAULT 'nominal',
  discount_value INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  tax_percent INTEGER NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  grand_total INTEGER NOT NULL DEFAULT 0,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  change_amount INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_status TEXT NOT NULL DEFAULT 'lunas',
  note TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY NOT NULL,
  sale_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  sku TEXT,
  qty INTEGER NOT NULL,
  price INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY NOT NULL,
  sale_id TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  amount INTEGER NOT NULL,
  paid_amount INTEGER NOT NULL,
  change_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'lunas',
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL,
  type TEXT NOT NULL,
  qty_change INTEGER NOT NULL,
  qty_before INTEGER NOT NULL,
  qty_after INTEGER NOT NULL,
  note TEXT,
  reference_id TEXT,
  user_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY NOT NULL,
  store_name TEXT NOT NULL DEFAULT '',
  store_address TEXT NOT NULL DEFAULT '',
  store_phone TEXT NOT NULL DEFAULT '',
  store_logo TEXT NOT NULL DEFAULT '',
  receipt_header TEXT NOT NULL DEFAULT '',
  receipt_footer TEXT NOT NULL DEFAULT '',
  default_tax_percent INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
`;
