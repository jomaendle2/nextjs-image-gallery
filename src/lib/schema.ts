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
   * `confirm_token_hash` and `unsubscribe_token` follow the same shape as
   * `login_tokens`: the secret goes in the URL, only its hash is stored, so
   * a dump of this table cannot be used to confirm or cancel anybody.
   *
   * The unsubscribe token does not expire. A footer link that stopped
   * working after fifteen minutes would be worse than useless — it is the
   * one link in the email that has to work whenever the person finds it.
   */
  `CREATE TABLE IF NOT EXISTS subscribers (
     email              TEXT PRIMARY KEY,
     confirm_token_hash TEXT,
     confirm_expires_at TIMESTAMPTZ,
     confirmed_at       TIMESTAMPTZ,
     unsubscribe_hash   TEXT NOT NULL,
     created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
   );`,

  /* The send reads only confirmed rows, so it never scans the pending ones. */
  `CREATE INDEX IF NOT EXISTS subscribers_confirmed_idx
     ON subscribers (confirmed_at) WHERE confirmed_at IS NOT NULL;`,
];
