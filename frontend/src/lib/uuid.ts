import * as Crypto from "expo-crypto";

/** Generate a RFC4122 v4 UUID (used as primary keys across all tables). */
export const uuid = (): string => Crypto.randomUUID();

/** Current timestamp as ISO-8601 string for created_at / updated_at columns. */
export const nowIso = (): string => new Date().toISOString();
