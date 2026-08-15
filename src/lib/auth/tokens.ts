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
  const address = normaliseEmail(email);
  const rows = await sql`
    SELECT id FROM contributors
    WHERE email = ${address} AND revoked_at IS NULL;
  `;
  const contributorId = rows[0]?.["id"] as string | undefined;
  if (contributorId === undefined) {
    return null;
  }

  const secret = generateSecret();
  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_MINUTES * 60 * 1000,
  ).toISOString();

  /*
   * The token is issued to the *address*. `contributor_id` is still written
   * for the cascade and as a fallback, but `email` is what redeeming it
   * resolves through — so the same flow can one day issue a link to someone
   * who has bought a membership and has no contributors row at all.
   *
   * The normalised form is stored, so redemption matches whatever casing the
   * person typed into the sign-in form.
   */
  await sql`
    INSERT INTO login_tokens (token_hash, contributor_id, email, expires_at)
    VALUES (${hashSecret(secret)}, ${contributorId}, ${address}, ${expiresAt});
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
 *
 * The token resolves to an address, and the address to a contributor. A token
 * that somehow carries no address is spent and refused — failing closed costs
 * one sign-in retry, and the alternative is a token that redeems as nobody.
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
    RETURNING email;
  `;
  const address = consumed[0]?.["email"] as string | null | undefined;
  if (address === undefined || address === null) {
    return null;
  }

  const rows = await sql`
    SELECT id, email, slug, display_name, site_url, role
    FROM contributors
    WHERE email = ${address} AND revoked_at IS NULL;
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
