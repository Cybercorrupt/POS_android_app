import { getDb } from "../database";
import type { Settings } from "../types";
import { nowIso } from "@/src/lib/uuid";

export async function getSettings(): Promise<Settings> {
  const db = getDb();
  const row = await db.getFirstAsync<Settings>("SELECT * FROM settings WHERE id = 'app'");
  return row!;
}

export interface SettingsInput {
  store_name: string;
  store_address: string;
  store_phone: string;
  receipt_header: string;
  receipt_footer: string;
  default_tax_percent: number;
}

export async function updateSettings(input: SettingsInput): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `UPDATE settings SET store_name = ?, store_address = ?, store_phone = ?, receipt_header = ?, receipt_footer = ?, default_tax_percent = ?, updated_at = ?
     WHERE id = 'app'`,
    [
      input.store_name.trim(),
      input.store_address.trim(),
      input.store_phone.trim(),
      input.receipt_header.trim(),
      input.receipt_footer.trim(),
      Math.max(0, input.default_tax_percent),
      nowIso(),
    ],
  );
}

/** Store the shop logo as a base64 data URI (offline). Pass null to remove it. */
export async function updateStoreLogo(logo: string | null): Promise<void> {
  const db = getDb();
  await db.runAsync("UPDATE settings SET store_logo = ?, updated_at = ? WHERE id = 'app'", [logo ?? "", nowIso()]);
}
