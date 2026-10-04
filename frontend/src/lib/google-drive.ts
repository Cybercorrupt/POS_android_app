// Google Drive REST client (per-user, foreground access token).
// Uploads/lists/downloads JSON backups inside a visible "Sellix POS" folder in
// the signed-in user's My Drive. Only the `drive.file` scope is used, so the app
// can only see files it created.

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_NAME = "Sellix POS";
const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Thrown when Drive rejects the token (expired/revoked) so the UI can prompt re-connect. */
export class DriveAuthError extends Error {
  constructor(message = "Sesi Google Drive berakhir. Hubungkan ulang.") {
    super(message);
    this.name = "DriveAuthError";
  }
}

async function drive(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (r.status === 401) throw new DriveAuthError();
  if (!r.ok) throw new Error(`Drive ${r.status}: ${await r.text()}`);
  return r;
}

export interface DriveUser {
  email: string;
  name?: string;
}

export interface DriveAbout {
  email: string;
  name?: string;
  usedBytes?: number;
  limitBytes?: number;
}

/** Verify a token works and return the connected account + storage usage. */
export async function getDriveAbout(token: string): Promise<DriveAbout> {
  const res = await drive("/about?fields=user(displayName,emailAddress),storageQuota(usage,limit)", token);
  const j = (await res.json()) as {
    user?: { displayName?: string; emailAddress?: string };
    storageQuota?: { usage?: string; limit?: string };
  };
  return {
    email: j.user?.emailAddress ?? "",
    name: j.user?.displayName,
    usedBytes: j.storageQuota?.usage ? Number(j.storageQuota.usage) : undefined,
    limitBytes: j.storageQuota?.limit ? Number(j.storageQuota.limit) : undefined,
  };
}

/** Fetch the signed-in account's profile (to show which account is connected). */
export async function getDriveUser(token: string): Promise<DriveUser> {
  const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 401) throw new DriveAuthError();
  if (!r.ok) throw new Error("Gagal mengambil info akun Google");
  const j = (await r.json()) as { email: string; name?: string };
  return { email: j.email, name: j.name };
}

/** Get (or create) the visible "Sellix POS" folder under My Drive; returns its id. */
export async function getOrCreateFolder(token: string): Promise<string> {
  const q = encodeURIComponent(
    `name = '${FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`,
  );
  const res = await drive(`/files?q=${q}&spaces=drive&fields=files(id,name)`, token);
  const found = (await res.json()) as { files?: { id: string }[] };
  if (found.files?.[0]?.id) return found.files[0].id;

  const created = await drive("/files?fields=id", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME, parents: ["root"] }),
  });
  return ((await created.json()) as { id: string }).id;
}

export interface DriveFile {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime?: string;
  size?: string;
}

function backupFileName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `sellix-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
}

/** Upload a JSON backup object to the Sellix POS folder (multipart, small files). */
export async function uploadBackup(token: string, backup: unknown): Promise<DriveFile> {
  const folderId = await getOrCreateFolder(token);
  const boundary = `sellix-${Date.now()}`;
  const metadata = JSON.stringify({
    name: backupFileName(),
    mimeType: "application/json",
    parents: [folderId],
  });
  const content = JSON.stringify(backup);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--\r\n`;

  const r = await fetch(`${UPLOAD}/files?uploadType=multipart&fields=id,name,createdTime,size`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (r.status === 401) throw new DriveAuthError();
  if (!r.ok) throw new Error(`Gagal mengunggah ke Drive (${r.status})`);
  return (await r.json()) as DriveFile;
}

/** List JSON backups in the Sellix POS folder, newest first. */
export async function listBackups(token: string): Promise<DriveFile[]> {
  const folderId = await getOrCreateFolder(token);
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed = false and mimeType = 'application/json'`,
  );
  const r = await drive(
    `/files?q=${q}&spaces=drive&orderBy=createdTime desc&fields=files(id,name,createdTime,modifiedTime,size)`,
    token,
  );
  return ((await r.json()) as { files?: DriveFile[] }).files ?? [];
}

/** Download and parse a backup file (id must come from listBackups). */
export async function downloadBackup(token: string, fileId: string): Promise<unknown> {
  const r = await drive(`/files/${encodeURIComponent(fileId)}?alt=media`, token);
  return r.json();
}

/** Soft-delete (trash) a backup file. */
export async function trashBackup(token: string, fileId: string): Promise<void> {
  await drive(`/files/${encodeURIComponent(fileId)}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
}
