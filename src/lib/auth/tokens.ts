import { sql } from "@/lib/database";
import { memberExists } from "@/lib/members/repository";
import { siteOrigin } from "@/lib/site-url";
import { generateSecret, hashSecret } from "./secrets";
import { normaliseEmail } from "./slug";
import type { Contributor, ContributorRole } from "./types";

/**
 * Long enough to walk to the inbox, short enough to be worthless if leaked.
 *
 * The default, and the right one for "email me a link": the person is at the
 * keyboard, waiting, and the link is worth a session the moment it arrives.
 */
export const LOGIN_TTL_MINUTES = 60;

/**
 * How long a link mailed to somebody who is not expecting it stays good.
 *
 * An invitation is not a magic link. Nobody is waiting at a keyboard for it —
 * it arrives in the middle of somebody's week and gets opened the next
 * morning, or after lunch, or on the train. Fifteen minutes was the reason the
 * invitation could not carry a token at all, and the argument recorded against
 * doing so was precisely this: *a token mailed today would sit in an inbox for
 * days.*
 *
 * That argument is about expiry, not about tokens. Seven days is the answer to
 * it. The link is still single-use, still 256 bits, still hashed at rest, and
 * still only worth what the address behind it is worth — which for a fresh
 * invitation is one contributor account with nothing in it yet.
 */
export const INVITE_TTL_MINUTES = 7 * 24 * 60;

/**
 * Issues a single-use login secret for an invited contributor.
 *
 * Returns null for an address that is not invited or has been revoked. The
 * caller must respond identically either way — the sign-in form is not
 * allowed to become an oracle for who is on the list.
 *
 * `ttlMinutes` is the caller's, because the three things that mail a link want
 * three different answers and used to get one. The sign-in form wants an hour;
 * an invitation wants a week (`INVITE_TTL_MINUTES`); and the membership
 * welcome — which is mailed by a Stripe webhook, not by somebody waiting —
 * wanted an hour and was silently getting fifteen minutes, so a member who
 * opened it over lunch had just paid for a link that no longer worked.
 */
export async function mintLoginToken(
  email: string,
  ttlMinutes: number = LOGIN_TTL_MINUTES,
): Promise<string | null> {
  const address = normaliseEmail(email);

  /*
   * A contributor, a member, or nobody.
   *
   * This used to require a live `contributors` row, which is what kept a
   * paying member from ever signing in — they have an address and nothing
   * else. Both capabilities hang off the address now, so either one earns a
   * link and neither is told about the other. An address with neither still
   * returns null, and the caller still answers identically, because the
   * sign-in form must not become a way to ask who is on the list.
   */
  const rows = await sql`
    SELECT id FROM contributors
    WHERE email = ${address} AND revoked_at IS NULL;
  `;
  const contributorId = (rows[0]?.["id"] as string | undefined) ?? null;

  if (contributorId === null && !(await memberExists(address))) {
    return null;
  }

  const secret = generateSecret();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  /*
   * The token is issued to the *address*. `contributor_id` is written when
   * there is one, for the cascade and as a fallback, and left null for a
   * member who has no contributors row — which is the case this was built
   * for and which is now real. `email` is what redeeming it resolves
   * through either way.
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

/** What redeeming a link established: an address, and what it can do. */
export interface RedeemedLogin {
  email: string;
  /** Null for somebody whose only capability is a membership. */
  contributor: Contributor | null;
}

/**
 * Consumes a login secret and returns who it belonged to.
 *
 * The single-use check lives inside the UPDATE, not in a read followed by a
 * write: `WHERE used_at IS NULL` and the write happen in one statement, so
 * two simultaneous clicks on the same link cannot both succeed.
 *
 * The token resolves to an address, and the address to whatever capabilities
 * it holds. Returning null means "this link is worthless" and covers three
 * cases the caller must not be able to tell apart: the token was wrong,
 * spent or expired; or it was valid but the address has since lost every
 * capability — a revoked contributor who never subscribed lands here, which
 * is how revocation keeps working now that a link no longer implies a
 * contributors row.
 */
export async function consumeLoginToken(
  secret: string,
): Promise<RedeemedLogin | null> {
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
    // No contributor. A member may still sign in; anybody else may not.
    return (await memberExists(address))
      ? { email: address, contributor: null }
      : null;
  }

  return {
    email: address,
    contributor: {
      id: row["id"] as string,
      email: row["email"] as string,
      slug: row["slug"] as string,
      display_name: row["display_name"] as string,
      site_url: (row["site_url"] as string | null) ?? null,
      role: row["role"] as ContributorRole,
    },
  };
}

/** Housekeeping for spent and expired tokens. Safe to call at any time. */
export async function pruneLoginTokens(): Promise<void> {
  await sql`
    DELETE FROM login_tokens
    WHERE expires_at < now() - INTERVAL '1 day' OR used_at IS NOT NULL;
  `;

  /*
   * Expired sessions go the same way, on the same rare path.
   *
   * There was no equivalent for `sessions`, so the table gained a row per
   * sign-in and kept it forever — including rows long past `expires_at`,
   * which every lookup then had to skip over. Nothing was insecure about it
   * (`getSessionEmail` compares `expires_at > now()`), but a table that only
   * grows is a slow leak, and this is the one place in the codebase that
   * already runs occasional housekeeping.
   */
  await sql`DELETE FROM sessions WHERE expires_at < now();`;
}

/**
 * The link that goes in an invitation, or the form's URL if minting failed.
 *
 * Shared by the two doors that create a contributor — the owner's invite and a
 * photographer's peer invite — so both mail the same thing. It was worth
 * extracting rather than repeating because the fallback is the interesting
 * half: `mintLoginToken` returns null for an address it cannot place, and an
 * invitation with no usable link at all would be worse than one pointing at
 * the form.
 */
export async function invitationUrl(email: string): Promise<string> {
  const secret = await mintLoginToken(email, INVITE_TTL_MINUTES);
  return secret === null
    ? `${siteOrigin()}/contribute`
    : `${siteOrigin()}/contribute/verify?token=${secret}`;
}
