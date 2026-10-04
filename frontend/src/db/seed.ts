import { generateSalt, hashPassword } from "@/src/auth/hash";
import { nowIso, uuid } from "@/src/lib/uuid";
import type { SqlDB } from "./sqlite-types";

// Seed baseline rows exactly once (guarded by existence checks so it is safe to
// run on every launch). Creates roles, a default admin, settings and a few
// starter categories.

export async function seedDatabase(db: SqlDB): Promise<void> {
  const now = nowIso();

  // Roles
  const roleCount = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM roles");
  let adminRoleId: string;
  let kasirRoleId: string;
  if (!roleCount || roleCount.c === 0) {
    adminRoleId = uuid();
    kasirRoleId = uuid();
    await db.runAsync("INSERT INTO roles (id, name, created_at) VALUES (?, ?, ?)", [adminRoleId, "admin", now]);
    await db.runAsync("INSERT INTO roles (id, name, created_at) VALUES (?, ?, ?)", [kasirRoleId, "kasir", now]);
  } else {
    const admin = await db.getFirstAsync<{ id: string }>("SELECT id FROM roles WHERE name = 'admin'");
    adminRoleId = admin!.id;
  }

  // Default admin user
  const userCount = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM users");
  if (!userCount || userCount.c === 0) {
    const salt = generateSalt();
    const passwordHash = await hashPassword("admin123", salt);
    await db.runAsync(
      "INSERT INTO users (id, username, name, password_hash, salt, role_id, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
      [uuid(), "admin", "Administrator", passwordHash, salt, adminRoleId, now, now],
    );
  }

  // Settings singleton
  const settingsCount = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM settings");
  if (!settingsCount || settingsCount.c === 0) {
    await db.runAsync(
      "INSERT INTO settings (id, store_name, store_address, store_phone, receipt_header, receipt_footer, default_tax_percent, currency, updated_at) VALUES ('app', ?, ?, ?, ?, ?, ?, 'IDR', ?)",
      ["Toko Saya", "", "", "", "Terima kasih telah berbelanja!", 0, now],
    );
  }

  // Starter categories
  const catCount = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM categories");
  if (!catCount || catCount.c === 0) {
    for (const name of ["Makanan", "Minuman", "Umum"]) {
      await db.runAsync("INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", [uuid(), name, now, now]);
    }
  }

  // Starter units
  const unitCount = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM units");
  if (!unitCount || unitCount.c === 0) {
    for (const name of ["pcs", "box", "pack", "kg", "liter", "lusin"]) {
      await db.runAsync("INSERT INTO units (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", [uuid(), name, now, now]);
    }
  }
}
