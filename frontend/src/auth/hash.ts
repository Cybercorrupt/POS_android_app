import * as Crypto from "expo-crypto";

// Local-only password hashing (SHA-256 over "salt:password"). No plaintext or
// hashes are ever logged. Verification is a constant-shape string compare.

export function generateSalt(): string {
  return Crypto.randomUUID().replace(/-/g, "");
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`,
  );
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const hash = await hashPassword(password, salt);
  return hash === expectedHash;
}
