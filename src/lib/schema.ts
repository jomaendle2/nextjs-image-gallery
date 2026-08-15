/**
 * Additive migrations for the contributor feature, safe to re-run.
 *
 * `image_views` predates this feature and is deliberately absent: photo ids
 * are nanoids that slot straight into its existing `image_id VARCHAR(255)`,
 * so no view data has to be migrated or touched.
 *
 * One statement per array entry, because the Neon HTTP driver sends a single
 * statement per round trip.
 */
export const MIGRATIONS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS contributors (
     id           TEXT PRIMARY KEY,
     email        TEXT NOT NULL UNIQUE,
     slug         TEXT NOT NULL UNIQUE,
     display_name TEXT NOT NULL,
     site_url     TEXT,
     role         TEXT NOT NULL DEFAULT 'contributor',
     revoked_at   TIMESTAMPTZ,
     created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
   );`,

  `CREATE TABLE IF NOT EXISTS photos (
     id            TEXT PRIMARY KEY,
     blob_url      TEXT NOT NULL,
     blob_pathname TEXT NOT NULL,
     width         INTEGER NOT NULL,
     height        INTEGER NOT NULL,
     blur_data_url TEXT NOT NULL,
     bg_color      TEXT NOT NULL,
     title         TEXT NOT NULL DEFAULT '',
     description   TEXT NOT NULL DEFAULT '',
     location      TEXT,
     exif          JSONB,
     author_id     TEXT NOT NULL REFERENCES contributors(id),
     published_at  TIMESTAMPTZ,
     is_opener     BOOLEAN NOT NULL DEFAULT FALSE,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
   );`,

  /*
   * Partial index: the feed only ever reads published rows, so drafts and
   * unpublished photos stay out of it entirely.
   */
  `CREATE INDEX IF NOT EXISTS photos_feed_idx
     ON photos (is_opener DESC, published_at DESC)
     WHERE published_at IS NOT NULL;`,

  "CREATE INDEX IF NOT EXISTS photos_author_idx ON photos (author_id);",

  /*
   * Added after the originals turned out to be 9-13 MB each: the optimizer
   * downloads the source for every width it serves, and fifteen concurrent
   * multi-megabyte fetches exceeded its timeout. The original stays in
   * `blob_url`; the gallery renders from this.
   */
  "ALTER TABLE photos ADD COLUMN IF NOT EXISTS display_url TEXT;",

  `CREATE TABLE IF NOT EXISTS applications (
     id           TEXT PRIMARY KEY,
     email        TEXT NOT NULL,
     display_name TEXT NOT NULL,
     site_url     TEXT NOT NULL,
     note         TEXT,
     status       TEXT NOT NULL DEFAULT 'pending',
     created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
     reviewed_at  TIMESTAMPTZ
   );`,

  /*
   * One open application per address. A resubmission while the first is still
   * pending is a double-click, not a second application; once reviewed, the
   * same person may apply again.
   */
  `CREATE UNIQUE INDEX IF NOT EXISTS applications_pending_email_idx
     ON applications (email) WHERE status = 'pending';`,

  /*
   * Photographs ingested before `exifParam` existed stored the JSON value
   * null in this column rather than SQL NULL, because `JSON.stringify(null)`
   * cast to jsonb is a populated cell containing null. `WHERE exif IS NULL`
   * matched none of them. Idempotent: after the first run the predicate finds
   * nothing, and correctly-null rows are excluded by `IS NULL` semantics on
   * the comparison itself.
   */
  "UPDATE photos SET exif = NULL WHERE exif::text = 'null';",

  `CREATE TABLE IF NOT EXISTS login_tokens (
     token_hash     TEXT PRIMARY KEY,
     contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
     expires_at     TIMESTAMPTZ NOT NULL,
     used_at        TIMESTAMPTZ
   );`,

  `CREATE TABLE IF NOT EXISTS sessions (
     id             TEXT PRIMARY KEY,
     contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
     expires_at     TIMESTAMPTZ NOT NULL
   );`,

  /*
   * Re-key both auth tables on email.
   *
   * A person is identified by their address; "contributor" is a capability
   * attached to it, not the identity itself. Keying tokens and sessions on
   * `contributor_id` made the two the same thing, so a second capability —
   * a paying member, who has an address but no contributors row — would have
   * needed a second login flow, a second cookie and a second set of tokens.
   * With email as the operative column, the same magic link and the same
   * session serve both, and each capability is one lookup off the address.
   *
   * `contributor_id` stays: still written, still cascading on delete, and
   * still the thing to fall back to if the cutover proves wrong. It is also
   * still NOT NULL, which is exactly the constraint that has to be dropped
   * before a non-contributor can hold a session — that belongs with the
   * change that introduces one, not here.
   */
  "ALTER TABLE login_tokens ADD COLUMN IF NOT EXISTS email TEXT;",
  "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS email TEXT;",

  `UPDATE login_tokens t SET email = c.email
     FROM contributors c
     WHERE c.id = t.contributor_id AND t.email IS NULL;`,

  `UPDATE sessions s SET email = c.email
     FROM contributors c
     WHERE c.id = s.contributor_id AND s.email IS NULL;`,

  /*
   * Sessions are looked up by primary key and joined to a contributor by
   * email on every /contribute request; revocation deletes by email.
   */
  "CREATE INDEX IF NOT EXISTS sessions_email_idx ON sessions (email);",

  /*
   * People who asked to hear when new work is published.
   *
   * Double opt-in, which is not a nicety here: an address is only ever added
   * by someone typing it, and anyone can type anyone's. `confirmed_at` stays
   * null until the person clicks a link sent to that address, so an
   * unconfirmed row is a request rather than a subscription and is never
   * mailed anything except its own confirmation.
   *
   * `confirm_token_hash` follows the same shape as `login_tokens`: the
   * secret goes in the URL, only its hash is stored, so a dump of this table
   * cannot be used to confirm anybody.
   *
   * `unsubscribe_token` is stored **in the clear**, and the difference is
   * the point. A login token grants a session, so hashing it means a leaked
   * database cannot be used to sign in as anyone. An unsubscribe token
   * grants exactly one thing — deleting its own row — and anybody holding
   * this table can already delete rows and already has the addresses.
   * Hashing it buys nothing and costs the feature: every message has to
   * carry an unsubscribe link, and a link cannot be built from a hash. The
   * first version of this table stored the hash and made that promise
   * unkeepable.
   *
   * It also does not expire. A footer link that stopped working after
   * fifteen minutes would be worse than useless — it is the one link in the
   * email that has to work whenever the person gets round to it.
   *
   * There is no `ALTER` accompanying the correction of that first version,
   * because this table has never been deployed: it and the fix arrived on
   * the same unreleased branch, so `CREATE TABLE IF NOT EXISTS` is the whole
   * story. A development database that ran the earlier shape needs
   * `DROP TABLE subscribers` once, by hand, and has nothing in it to lose.
   */
  `CREATE TABLE IF NOT EXISTS subscribers (
     email              TEXT PRIMARY KEY,
     confirm_token_hash TEXT,
     confirm_expires_at TIMESTAMPTZ,
     confirmed_at       TIMESTAMPTZ,
     unsubscribe_token  TEXT NOT NULL,
     created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
   );`,

  /* The send reads only confirmed rows, so it never scans the pending ones. */
  `CREATE INDEX IF NOT EXISTS subscribers_confirmed_idx
     ON subscribers (confirmed_at) WHERE confirmed_at IS NOT NULL;`,

  /*
   * When a photograph went out in an announcement.
   *
   * Separate from `published_at` because publishing and announcing are
   * different decisions made by different people at different times: a
   * photographer publishes whenever they like, and the owner chooses when
   * the list hears about it. This column is the only thing stopping the same
   * work being mailed twice.
   */
  "ALTER TABLE photos ADD COLUMN IF NOT EXISTS announced_at TIMESTAMPTZ;",

  /*
   * The constraint the re-keying note above said would have to go.
   *
   * Tokens and sessions are keyed on email so that "contributor" is a
   * capability attached to an address rather than the identity itself. A
   * paying member has an address and no `contributors` row, so this is the
   * one thing that stopped them holding a session. `contributor_id` stays
   * for contributors, still cascading on delete — it is simply no longer
   * required.
   */
  "ALTER TABLE login_tokens ALTER COLUMN contributor_id DROP NOT NULL;",
  "ALTER TABLE sessions ALTER COLUMN contributor_id DROP NOT NULL;",

  /*
   * Members.
   *
   * Keyed on email like everything else in the auth layer, so the same
   * magic link signs in a contributor, a member, or somebody who is both.
   * Stripe's ids are stored rather than derived: `stripe_customer_id` is
   * what a returning subscriber is matched on, and what the customer portal
   * is opened for.
   *
   * `status` and `current_period_end` together are the whole access
   * question. Both are written only by the webhook, because Stripe is the
   * authority on whether somebody has paid — a success page can be reached
   * by anyone who guesses the URL.
   */
  `CREATE TABLE IF NOT EXISTS members (
     email                  TEXT PRIMARY KEY,
     stripe_customer_id     TEXT NOT NULL,
     stripe_subscription_id TEXT,
     status                 TEXT NOT NULL DEFAULT 'incomplete',
     current_period_end     TIMESTAMPTZ,
     created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
   );`,

  /* Returning subscribers are matched on the Stripe id from the webhook. */
  `CREATE UNIQUE INDEX IF NOT EXISTS members_customer_idx
     ON members (stripe_customer_id);`,

  /*
   * What a photographer chooses to tell members, and only members.
   *
   * Neither is derived from the file. `derive.ts` still never reads GPS —
   * these are two text fields somebody types, which is a different act from
   * extracting coordinates out of an image, and the difference is the whole
   * promise this gallery makes.
   */
  "ALTER TABLE photos ADD COLUMN IF NOT EXISTS precise_location TEXT;",
  "ALTER TABLE photos ADD COLUMN IF NOT EXISTS technique TEXT;",

  /*
   * What members looked at, aggregated per photograph per day.
   *
   * Enough to divide a revenue pool fairly later, and deliberately not
   * enough to reconstruct one person's viewing history. A site whose
   * central promise is that it does not record where you were should not
   * quietly start recording what you looked at.
   */
  `CREATE TABLE IF NOT EXISTS photo_member_views (
     photo_id TEXT NOT NULL,
     day      DATE NOT NULL,
     views    INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (photo_id, day)
   );`,

  /*
   * The pathname of the display copy, which is the URL the public actually
   * sees.
   *
   * `blobIsClaimed` existed to stop one contributor posting another's blob
   * URL to the draft endpoint and receiving a row attributed to themselves.
   * It matched on `blob_pathname` — the *original* upload — while every
   * gallery page renders `COALESCE(display_url, blob_url)`, which is the
   * display copy. So the one URL an attacker could actually obtain was the
   * one the guard could never match, and the check had been inert since the
   * display copy was introduced.
   *
   * Storing the pathname rather than reusing `display_url` keeps the
   * comparison in the same units as `blob_pathname`, which is what `del()`
   * and the ownership check both speak.
   */
  "ALTER TABLE photos ADD COLUMN IF NOT EXISTS display_pathname TEXT;",

  /*
   * Backfill for every row uploaded before the column existed. Bounded by
   * `IS NULL`, so it rewrites nothing on the second run. The URL is
   * `https://<store>/<pathname>`, so stripping the scheme and host leaves
   * exactly the pathname.
   */
  `UPDATE photos
      SET display_pathname = regexp_replace(display_url, '^https?://[^/]+/', '')
    WHERE display_pathname IS NULL AND display_url IS NOT NULL;`,

  /*
   * Now that both pathnames are recorded, they must be unique across both
   * columns' worth of meaning: a blob may back at most one photograph.
   * Partial, because rows predating the display copy have NULL here.
   */
  `CREATE UNIQUE INDEX IF NOT EXISTS photos_display_pathname_idx
     ON photos (display_pathname) WHERE display_pathname IS NOT NULL;`,
];
