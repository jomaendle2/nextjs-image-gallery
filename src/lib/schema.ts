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
];
