// Web SQLite adapter — backed by sql.js (SQLite compiled to WASM, in-memory).
// Used ONLY for the browser preview so the exact same SQL and schema run during
// development/testing. The shipped Android/iOS app uses the native expo-sqlite
// adapter (sqlite.ts) which persists on-device and is fully offline.
import initSqlJs from "sql.js";

import type { SqlDB } from "./sqlite-types";

const WASM_VERSION = "1.14.2";

let sqlPromise: Promise<any> | null = null;

function loadSql(): Promise<any> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/sql.js@${WASM_VERSION}/dist/${file}`,
    });
  }
  return sqlPromise;
}

export async function openDatabaseAsync(_name: string): Promise<SqlDB> {
  const SQL = await loadSql();
  const db = new SQL.Database();

  const all = <T>(sql: string, params: unknown[] = []): T[] => {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params as any);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  };

  return {
    async execAsync(sql: string) {
      db.run(sql);
    },
    async runAsync(sql: string, params: unknown[] = []) {
      db.run(sql, params as any);
    },
    async getFirstAsync<T>(sql: string, params: unknown[] = []) {
      const rows = all<T>(sql, params);
      return rows.length > 0 ? rows[0] : null;
    },
    async getAllAsync<T>(sql: string, params: unknown[] = []) {
      return all<T>(sql, params);
    },
    async withTransactionAsync(task: () => Promise<void>) {
      db.run("BEGIN");
      try {
        await task();
        db.run("COMMIT");
      } catch (e) {
        db.run("ROLLBACK");
        throw e;
      }
    },
  };
}
