// Minimal async SQLite surface shared by the native (expo-sqlite) and web
// (sql.js) adapters. Repositories depend only on this interface so the exact
// same SQL runs on every platform.

export interface SqlDB {
  execAsync(sql: string): Promise<unknown>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
