import { generateSecret, hashSecret } from "@/lib/auth/secrets";
import { normaliseEmail } from "@/lib/auth/slug";
import { sql } from "@/lib/database";

/** As long as a login token. Long enough to reach an inbox and act. */
const CONFIRM_TTL_MINUTES = 60 * 24;

export interface PendingSubscription {
  /** Goes in the confirmation URL. Never stored. */
  confirmSecret: string;
}

/**
 * Records a request to subscribe and returns the secret to email.
 *
 * Re-requesting is allowed and simply mints a fresh token — someone who lost
 * the first email should not be stuck, and the row is keyed on the address
 * so this cannot accumulate duplicates. An address that is *already*
 * confirmed returns null: there is nothing to confirm, and sending another
 * "please confirm" would be both confusing and a way to pester somebody.
 */
export async function requestSubscription(
  rawEmail: string,
): Promise<PendingSubscription | null> {
  const email = normaliseEmail(rawEmail);
  const confirmSecret = generateSecret();
  const expiresAt = new Date(
    Date.now() + CONFIRM_TTL_MINUTES * 60 * 1000,
  ).toISOString();

  /*
   * One statement. `DO UPDATE ... WHERE subscribers.confirmed_at IS NULL`
   * means an already-confirmed address updates zero rows, so the returning
   * clause is empty and the caller sends nothing — without a read first that
   * a second request could race.
   */
  const rows = await sql`
    INSERT INTO subscribers (email, confirm_token_hash, confirm_expires_at,
                             unsubscribe_token)
    VALUES (${email}, ${hashSecret(confirmSecret)}, ${expiresAt},
            ${generateSecret()})
    ON CONFLICT (email) DO UPDATE
      SET confirm_token_hash = EXCLUDED.confirm_token_hash,
          confirm_expires_at = EXCLUDED.confirm_expires_at
      WHERE subscribers.confirmed_at IS NULL
    RETURNING email;
  `;

  return rows.length > 0 ? { confirmSecret } : null;
}

/**
 * Confirms a subscription and returns the unsubscribe secret to put in the
 * welcome email, or null if the token was wrong, spent or expired.
 *
 * The unsubscribe token is replaced here rather than kept from the request,
 * so a confirmation link that was forwarded or logged somewhere cannot be
 * turned into a way to unsubscribe the person who did confirm.
 */
export async function confirmSubscription(
  secret: string,
): Promise<{ email: string; unsubscribeSecret: string } | null> {
  if (secret === "") {
    return null;
  }

  const unsubscribeSecret = generateSecret();

  // Single-use in the same statement as the check, so two clicks on the same
  // link cannot both succeed — the pattern `consumeLoginToken` uses.
  const rows = await sql`
    UPDATE subscribers
       SET confirmed_at = now(),
           confirm_token_hash = NULL,
           confirm_expires_at = NULL,
           unsubscribe_token = ${unsubscribeSecret}
     WHERE confirm_token_hash = ${hashSecret(secret)}
       AND confirmed_at IS NULL
       AND confirm_expires_at > now()
    RETURNING email;
  `;

  const email = rows[0]?.["email"] as string | undefined;
  return email === undefined ? null : { email, unsubscribeSecret };
}

/**
 * Removes a subscriber. Deletes the row rather than flagging it: keeping an
 * address after someone asked to be forgotten is the opposite of what they
 * asked for, and there is nothing here worth the record.
 */
export async function unsubscribe(secret: string): Promise<boolean> {
  if (secret === "") {
    return false;
  }
  const rows = await sql`
    DELETE FROM subscribers WHERE unsubscribe_token = ${secret}
    RETURNING email;
  `;
  return rows.length > 0;
}

/**
 * Everyone who has confirmed, with the token their unsubscribe link needs.
 *
 * The token comes back in the clear because building that link is the whole
 * reason this query exists — see the note on the table in `schema.ts` for
 * why hashing it would be security theatre that costs the feature.
 */
export async function listConfirmedSubscribers(): Promise<
  { email: string; unsubscribe_token: string }[]
> {
  const rows = await sql`
    SELECT email, unsubscribe_token FROM subscribers
    WHERE confirmed_at IS NOT NULL
    ORDER BY confirmed_at ASC;
  `;
  return rows as { email: string; unsubscribe_token: string }[];
}

/**
 * How many people are on the list, without the list.
 *
 * The one above returns a live unsubscribe token per subscriber, and two
 * callers wanted nothing but the count — so a page render and a cron tick
 * were each pulling every address and every token out of the database to
 * measure the length of the array.
 */
export async function countConfirmedSubscribers(): Promise<number> {
  const rows = await sql`
    SELECT count(*)::int AS n FROM subscribers WHERE confirmed_at IS NOT NULL;
  `;
  return Number(rows[0]?.["n"] ?? 0);
}

/** Housekeeping for requests nobody ever confirmed. */
export async function pruneUnconfirmed(): Promise<void> {
  await sql`
    DELETE FROM subscribers
    WHERE confirmed_at IS NULL AND confirm_expires_at < now();
  `;
}
