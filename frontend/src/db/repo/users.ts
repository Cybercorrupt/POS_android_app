import { getDb } from "../database";
import type { User } from "../types";
import { generateSalt, hashPassword, verifyPassword } from "@/src/auth/hash";
import { nowIso, uuid } from "@/src/lib/uuid";

const SELECT_USER = `
  SELECT u.*, r.name AS role_name
  FROM users u
  JOIN roles r ON r.id = u.role_id
`;

export async function findUserByUsername(username: string): Promise<User | null> {
  const db = getDb();
  const row = await db.getFirstAsync<User>(
    `${SELECT_USER} WHERE u.username = ? AND u.active = 1`,
    [username.trim().toLowerCase()],
  );
  return row ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const db = getDb();
  const row = await db.getFirstAsync<User>(`${SELECT_USER} WHERE u.id = ?`, [id]);
  return row ?? null;
}

export async function authenticate(username: string, password: string): Promise<User | null> {
  const user = await findUserByUsername(username);
  if (!user) return null;
  const ok = await verifyPassword(password, user.salt, user.password_hash);
  return ok ? user : null;
}

export async function listUsers(): Promise<User[]> {
  const db = getDb();
  return db.getAllAsync<User>(`${SELECT_USER} ORDER BY u.created_at ASC`);
}

export async function createUser(input: {
  username: string;
  name: string;
  password: string;
  roleName: "admin" | "kasir";
}): Promise<void> {
  const db = getDb();
  const role = await db.getFirstAsync<{ id: string }>("SELECT id FROM roles WHERE name = ?", [input.roleName]);
  if (!role) throw new Error("Role tidak ditemukan");
  const salt = generateSalt();
  const hash = await hashPassword(input.password, salt);
  const now = nowIso();
  await db.runAsync(
    "INSERT INTO users (id, username, name, password_hash, salt, role_id, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
    [uuid(), input.username.trim().toLowerCase(), input.name.trim(), hash, salt, role.id, now, now],
  );
}

export async function changePassword(userId: string, newPassword: string): Promise<void> {
  const db = getDb();
  const salt = generateSalt();
  const hash = await hashPassword(newPassword, salt);
  await db.runAsync("UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?", [
    hash,
    salt,
    nowIso(),
    userId,
  ]);
}

export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;
  return verifyPassword(password, user.salt, user.password_hash);
}
