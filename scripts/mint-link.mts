/**
 * Prints a working sign-in link for a contributor, without going through the
 * email provider. Useful locally and as a break-glass for the owner.
 *
 * Usage: node --env-file=.env.local scripts/mint-link.mts you@example.com [origin]
 *
 * The hashing here is duplicated from src/lib/auth/secrets.ts rather than
 * imported, because these scripts run under plain Node, which does not
 * resolve the `@/` alias the app modules use.
 */
import { createHash, randomBytes } from "node:crypto";
import process from "node:process";
import { sql } from "../src/lib/database.ts";

const [, , emailArg, originArg] = process.argv;
if (!emailArg) {
  console.error("Usage: mint-link.mts <email> [origin]");
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const origin = originArg ?? "http://localhost:3000";

const rows = await sql`
  SELECT id, display_name FROM contributors
  WHERE email = ${email} AND revoked_at IS NULL;
`;
const contributor = rows[0];
if (!contributor) {
  console.error(`No active contributor with the address ${email}.`);
  process.exit(1);
}

const secret = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(secret).digest("hex");
const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

await sql`
  INSERT INTO login_tokens (token_hash, contributor_id, expires_at)
  VALUES (${tokenHash}, ${contributor["id"]}, ${expiresAt});
`;

console.log(`Sign-in link for ${contributor["display_name"]} (valid 15 min):`);
console.log(`${origin}/contribute/verify?token=${secret}`);
