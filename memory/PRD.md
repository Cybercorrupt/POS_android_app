# Kasir POS — PRD

## Original Problem Statement
Fresh offline Android POS app (Expo + React Native + TypeScript + Expo Router + Expo SQLite). 100% offline — no Supabase/Firebase/backend/cloud/payment gateway. Clean modular DB foundation so Supabase + cloud sync can be added later without a rebuild. Local login (Admin/Kasir) with password hashing, local session, role-based access. Core modules: Dashboard, POS, Products, Inventory, Customers, Transactions, Settings, Receipt. Sales must be written in a single DB transaction (sale + items + payment + stock movement + stock decrement all commit or roll back together). Design system: Emerald Fresh. Budget < 50 credits.

## User Choices
- UI language: Bahasa Indonesia
- Currency: Rupiah (whole, no decimals)
- Default admin: admin / admin123 (changeable in Settings)
- Password hashing: local SHA-256 + salt (expo-crypto)
- Barcode: camera scan (expo-camera) + manual entry

## Architecture
- **Frontend-only** Expo app. No FastAPI/Mongo used (offline requirement).
- **DB adapter is platform-split** for the same SQL everywhere:
  - Native (Android/iOS, Expo Go/build): `src/db/sqlite.ts` → `expo-sqlite` (on-disk, persistent, offline).
  - Web preview only: `src/db/sqlite.web.ts` → `sql.js` (SQLite WASM, in-memory, for dev/testing; resets on full reload).
  - Shared interface: `src/db/sqlite-types.ts` (`SqlDB`).
- Schema: `src/db/schema.ts` (tables: roles, users, categories, products, stock, customers, sales, sale_items, payments, stock_movements, settings). UUID TEXT PKs, FKs, created_at/updated_at ISO, soft deletes (deleted_at) on products/customers/sales. Money = whole-rupiah INTEGER.
- Seed: `src/db/seed.ts` (roles admin/kasir, default admin, settings singleton, starter categories) — idempotent.
- Repositories: `src/db/repo/*` (users, categories, products, customers, inventory, sales, dashboard, settings). Parameterized SQL only.
- Atomic sale: `createSale()` in `src/db/repo/sales.ts` via `withTransactionAsync` — validates stock + payment, generates invoice no `INV-YYYYMMDD-NNNN`, writes sale/items/payment/movements and decrements stock together.
- Auth: `src/auth/hash.ts` (SHA-256+salt) + `src/auth/auth-context.tsx` (session in SecureStore, role gating). No secrets logged.
- State/data: `@tanstack/react-query` wraps all DB reads/mutations; `invalidateQueries` after writes. POS cart in `src/cart/cart-context.tsx`.
- UI: `src/theme.ts` Emerald Fresh tokens + `makeStyles`; reusable components in `src/components/ui`. Tabs: Dashboard / Kasir / Produk / Lainnya (secondary screens under Lainnya).

## User Personas
- **Admin**: full access — products, inventory adjustments, users, settings, POS, reports.
- **Kasir (Cashier)**: POS, customers, transactions, dashboard; product/inventory/settings are read-only/hidden.

## Core Requirements (static)
Offline reliability, DB integrity (atomic sales), POS stability, role-based access, UI consistency (Emerald Fresh, no horizontal scroll / clipped text), modular DB for future cloud sync.

## Implemented (2026-06)
- Local auth + roles + session + change password.
- Dashboard: today sales/transactions/items sold, product count, low stock, quick actions.
- POS: search, camera/manual barcode, cart qty, customer, discount (nominal/%), tax %, grand total, cash payment, change, auto invoice, atomic save, auto stock reduction.
- Products CRUD (+ categories), SKU/barcode/unit/prices/min stock/active, initial stock.
- Customers CRUD. Inventory stock in/out/adjustment + movement history + low stock.
- Transaction history + detail + simple receipt (store info/header/footer).
- Settings: store info, receipt header/footer, default tax. User management (admin).
- Verified end-to-end by testing agent (iteration_1): login, product create, POS sale w/ discount+tax math, change, invoice, stock reduction, inventory adjust, customer, settings — all pass.

## Update 2 (2026-06) — Payment & Units
- POS payment methods: Tunai, Transfer, QRIS, Debit/Kartu, E-wallet (recorded labels only — still 100% offline, no gateway).
- Payment status: Lunas / Belum Lunas (down payment allowed for belum lunas, shows Sisa Tagihan); cash still shows Jumlah Bayar + Kembalian.
- `keterangan` (note) saved on sale + payment; shown in transaction detail, receipt, and transactions list (method + status badge).
- Customer selection in Kasir with a "Pelanggan Baru" shortcut to the customer form.
- Unit is now a dropdown in product form, backed by a `units` table with CRUD (add/soft-delete) in Settings (admin).
- DB: added `units` table + `sales.payment_method/payment_status/note` + `payments.status/note`; idempotent column migrations in `src/db/migrations.ts` for existing native installs. Verified on web (sql.js) end-to-end: Transfer+Lunas sale with note renders correctly on receipt.

## Update 3 (2026-06) — Theme, Daily Report, Backup, Receipt Share/Print
- **New theme** (`src/theme.ts`): Ocean Blue brand `#205396` + Amber accent `#EF8D28` on white; replaces Emerald Fresh. Android adaptive-icon bg + Boot screen updated to `#205396`.
- **Laporan Harian** (`app/daily-report.tsx`, admin, via Lainnya): per-day summary with prev/next date nav (next disabled on today). Shows Total Penjualan, Transaksi, Item Terjual, Terbayar, Piutang, payment-method breakdown, and Produk Terlaris (top 5). Backed by `getDailyReport()` in `src/db/repo/dashboard.ts`.
- **Backup Data** (`app/backup.tsx`, admin, via Lainnya): `src/db/repo/backup.ts` exports all 12 tables to a `kasir-pos-backup-YYYY-MM-DD.json` file (expo-file-system/legacy + expo-sharing on native; Blob download on web) and imports/restores via expo-document-picker — wipe+reinsert inside one transaction (FK off during import, rolls back on error). Confirm sheet previews counts before overwrite.
- **Cetak Struk** (`app/receipt.tsx`): "Bagikan" captures the receipt (react-native-view-shot) and shares as PNG (expo-sharing); "Cetak" prints a monospace HTML receipt via expo-print (system print dialog → AirPrint/compatible printers). On web, share shows an info toast; print uses window.print.
- Packages added: expo-print, expo-sharing, expo-file-system, expo-document-picker, react-native-view-shot.
- `src/components/ui/card.tsx` now forwards an optional `testID`.
- Verified by testing agent (iteration_2): all 6 checkpoints pass — theme, daily report (with real sale data), backup export/import, receipt share/print, no crashes.
- NOTE: true Bluetooth thermal (ESC/POS) printing needs a native build + dedicated plugin and is not available in Expo Go; current print routes through the system print dialog.

## Update 4 (2026-10) — Rename, Modern Theme, Cloud Backup, Dashboard Charts, Void
- **Rename "Kasir" → "Penjualan"** in UI (POS tab + screen title). Roles now display as **Admin / User** (internal role value "kasir" shown as "User"; receipt/transaction operator label "Kasir" → "Petugas"). Files: `(tabs)/_layout.tsx`, `(tabs)/pos.tsx`, `(tabs)/more.tsx`, `users.tsx`, `user-form.tsx`, `settings.tsx`, `transactions.tsx`, `transaction-detail.tsx`, `receipt.tsx`, `product-form.tsx`.
- **Modern theme polish**: dashboard hero is now a LinearGradient (brandPrimary→brandSecondary, `#205396`→blue) with stat badges; login logo clean (gradient ring added then removed per user request — plain rounded icon). Palette already `#205396`/`#EF8D28`/white.
- **Cloud Backup (manual, cross-device)** — NEW backend usage (first non-offline feature):
  - Backend `server.py`: `POST /api/cloud/backup` {code?, store_name, data} upserts into Mongo `cloud_backups` (generates 8-char uppercase code if none); `GET /api/cloud/backup/{code}` returns stored backup or 404.
  - Frontend `src/db/repo/cloud.ts`: `pushCloudBackup`/`pullCloudBackup`/`restoreCloudBackup` + sync code persisted via `@/src/utils/storage` ("pos.cloud.syncCode"). UI section "Sinkronisasi Cloud" in `app/backup.tsx` (show/generate code, backup to cloud, restore-by-code with confirm sheet overwrite).
  - Verified by testing agent (iteration_4): 6/6 pytest pass (create, upsert, get, 404, case-insensitive, /api/ root).
- **Dashboard "Produk Terlaris (Bulan Ini)"** card added (admin) using `monthReport.topProducts`. Weekly bar chart ("Penjualan 7 Hari Terakhir") already existed.
- **Void/Pembatalan transaksi (admin)** already implemented (`voidSale` returns stock + status "void"); localized badge to "Dibatalkan" in list + detail.

## Deployment Note (health check 2026-10)
- Deployment agent flagged a BLOCKER: app persists business data in **client-side SQLite/sql.js** (`src/db/sqlite.ts`), which is outside the supported FastAPI+MongoDB datastore policy. The app's core is offline-by-design; only the new Cloud Backup uses MongoDB. User must decide whether to migrate the authoritative datastore to MongoDB before publishing, or keep offline (backup/restore via cloud code).
- Minor: add `microphonePermission:false`/`cameraPermission:false` to `expo-image-picker` plugin config; confirm `.env` files are provided at deploy.


## Backlog
- P1: Export/share receipt (image/print), daily sales summary report.
- P1: Edit/soft-void a transaction (currently create + view only).
- P2: Phase-2 cloud layer — add Supabase + sync on top of the existing repository layer (no rebuild).
- P2: Per-user cashier sales report; product import.

## Next Tasks
- (Optional polish) swap web-deprecated `shadow*`/`pointerEvents` props for `boxShadow`/`style.pointerEvents` in UI components (web console warnings only; native unaffected).
