import { sql } from "@/lib/database";
import { generateSecret, hashSecret } from "./secrets";
import { normaliseEmail } from "./slug";
import type { Contributor, ContributorRole } from "./types";

/** Long enough to walk to the inbox, short enough to be worthless if leaked. */
const TOKEN_TTL_MINUTES = 15;

/**
 * Issues a single-use login secret for an invited contributor.
 *
 * Returns null for an address that is not invited or has been revoked. The
 * caller must respond identically either way — the sign-in form is not
 * allowed to become an oracle for who is on the list.
 */
export async function mintLoginToken(email: string): Promise<string | null> {
  const rows = await sql`
    SELECT id FROM contributors
    WHERE email = ${normaliseEmail(email)} AND revoked_at IS NULL;
  `;
  const contributorId = rows[0]?.["id"] as string | undefined;
  if (contributorId === undefined) {
    return null;
  }

  const secret = generateSecret();
  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_MINUTES * 60 * 1000,
  ).toISOString();

  await sql`
    INSERT INTO login_tokens (token_hash, contributor_id, expires_at)
    VALUES (${hashSecret(secret)}, ${contributorId}, ${expiresAt});
  `;

  return secret;
}

/**
 * Consumes a login secret and returns the contributor it belonged to.
 *
 * The single-use check lives inside the UPDATE, not in a read followed by a
 * write: `WHERE used_at IS NULL` and the write happen in one statement, so
 * two simultaneous clicks on the same link cannot both succeed. A revoked
 * contributor is rejected even holding an unexpired token.
 */
export async function consumeLoginToken(
  secret: string,
): Promise<Contributor | null> {
  if (secret === "") {
    return null;
  }

  const consumed = await sql`
    UPDATE login_tokens SET used_at = now()
    WHERE token_hash = ${hashSecret(secret)}
      AND used_at IS NULL
      AND expires_at > now()
    RETURNING contributor_id;
  `;
  const contributorId = consumed[0]?.["contributor_id"] as string | undefined;
  if (contributorId === undefined) {
    return null;
  }

  const rows = await sql`
    SELECT id, email, slug, display_name, site_url, role
    FROM contributors
    WHERE id = ${contributorId} AND revoked_at IS NULL;
  `;
  const [row] = rows;
  if (!row) {
    return null;
  }

  return {
    id: row["id"] as string,
    email: row["email"] as string,
    slug: row["slug"] as string,
    display_name: row["display_name"] as string,
    site_url: (row["site_url"] as string | null) ?? null,
    role: row["role"] as ContributorRole,
  };
}

/** Housekeeping for spent and expired tokens. Safe to call at any time. */
export async function pruneLoginTokens(): Promise<void> {
  await sql`
    DELETE FROM login_tokens
    WHERE expires_at < now() - INTERVAL '1 day' OR used_at IS NOT NULL;
  `;
}
