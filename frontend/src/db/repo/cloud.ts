import { storage } from "@/src/utils/storage";
import {
  exportAllData,
  importAllData,
  isValidBackup,
  summarise,
  type BackupData,
  type BackupSummary,
} from "./backup";
import { getSettings } from "./settings";

// Manual cloud backup/restore across devices. Owner uploads the full local
// database to the backend and gets a short Sync Code; entering that same code
// on another device pulls the latest backup and restores it locally.

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const SYNC_CODE_KEY = "pos.cloud.syncCode";

export async function getSyncCode(): Promise<string> {
  return (await storage.getItem<string>(SYNC_CODE_KEY, "")) ?? "";
}

export async function setSyncCode(code: string): Promise<void> {
  await storage.setItem(SYNC_CODE_KEY, code);
}

export interface CloudPushResult {
  code: string;
  updatedAt: string;
}

/** Upload the entire local database to the cloud; reuses the existing code if any. */
export async function pushCloudBackup(): Promise<CloudPushResult> {
  const data = await exportAllData();
  const settings = await getSettings();
  const existing = await getSyncCode();
  const res = await fetch(`${BASE}/api/cloud/backup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: existing || null, store_name: settings?.store_name ?? "", data }),
  });
  if (!res.ok) throw new Error("Gagal mengunggah ke cloud");
  const json = (await res.json()) as { code: string; updated_at: string };
  await setSyncCode(json.code);
  return { code: json.code, updatedAt: json.updated_at };
}

export interface CloudBackupInfo {
  code: string;
  storeName: string;
  updatedAt: string | null;
  summary: BackupSummary;
  data: BackupData;
}

/** Fetch (but do not yet apply) the backup stored under a sync code. */
export async function pullCloudBackup(code: string): Promise<CloudBackupInfo> {
  const clean = code.trim().toUpperCase();
  if (!clean) throw new Error("Masukkan kode sinkronisasi");
  const res = await fetch(`${BASE}/api/cloud/backup/${encodeURIComponent(clean)}`);
  if (res.status === 404) throw new Error("Kode sinkronisasi tidak ditemukan");
  if (!res.ok) throw new Error("Gagal mengambil data cloud");
  const json = (await res.json()) as {
    code: string;
    store_name: string;
    data: unknown;
    updated_at: string | null;
  };
  if (!isValidBackup(json.data)) throw new Error("Data cloud tidak valid");
  return {
    code: json.code,
    storeName: json.store_name ?? "",
    updatedAt: json.updated_at ?? null,
    summary: summarise(json.data),
    data: json.data,
  };
}

/** Apply a previously fetched cloud backup, then link this device to the same code. */
export async function restoreCloudBackup(info: CloudBackupInfo): Promise<void> {
  await importAllData(info.data);
  await setSyncCode(info.code);
}
