// Native SQLite adapter — backed by expo-sqlite. Persists on-device, fully
// offline. Metro picks sqlite.web.ts instead when bundling for web.
import * as SQLite from "expo-sqlite";

import type { SqlDB } from "./sqlite-types";

export async function openDatabaseAsync(name: string): Promise<SqlDB> {
  const db = await SQLite.openDatabaseAsync(name);
  return db as unknown as SqlDB;
}
