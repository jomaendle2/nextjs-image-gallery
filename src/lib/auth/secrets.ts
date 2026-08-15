import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Pure crypto helpers, kept free of any database import so they can be tested
 * without a connection.
 *
 * Both magic-link tokens and session cookies use the same pair: a secret goes
 * to the user, only its hash is stored. A dump of `login_tokens` or
 * `sessions` therefore contains nothing that can be replayed.
 */

/** 256 bits. base64url so it survives a URL and an email client untouched. */
const SECRET_BYTES = 32;

export function generateSecret(): string {
  return randomBytes(SECRET_BYTES).toString("base64url");
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * Constant-time comparison of two hex digests. Lookups are by primary key, so
 * this is only needed where a value is compared in application code.
 */
export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length || left.length === 0) {
    return false;
  }
  return timingSafeEqual(left, right);
}
