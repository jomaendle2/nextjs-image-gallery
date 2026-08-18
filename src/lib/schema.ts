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
  /*
   * View counts, which predate the contributor feature.
   *
   * This lived in `database.ts` as a memoized `CREATE TABLE IF NOT EXISTS`
   * that both `/api/views` handlers had to remember to await — schema DDL in
   * the request path, and the memo existed only to make that affordable. The
   * data needed no migration, which was never a reason for the table
   * definition to live somewhere else. Column types are exactly as they were.
   */
  `CREATE TABLE IF NOT EXISTS image_views (
     id         SERIAL PRIMARY KEY,
     image_id   VARCHAR(255) UNIQUE NOT NULL,
     view_count INTEGER DEFAULT 0,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );`,

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
   * attached to it. Keying tokens and sessions on `contributor_id` made the
   * two the same thing, so a member — an address with no contributors row —
   * would have needed a second login flow, cookie and token set. On email,
   * one magic link and one session serve both.
   *
   * `contributor_id` stays: still written, still cascading on delete.
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
   * Double opt-in: an address is only ever added by somebody typing it, and
   * anyone can type anyone's, so `confirmed_at` stays null until a link sent
   * to that address is clicked. An unconfirmed row is a request, not a
   * subscription, and is never mailed anything but its own confirmation.
   *
   * `confirm_token_hash` is hashed like `login_tokens`. `unsubscribe_token`
   * is deliberately **not**, and the asymmetry is the point: a login token
   * grants a session, an unsubscribe token grants deleting its own row, and
   * anybody holding this table can already delete rows. Hashing it would buy
   * nothing and cost the feature, because every message has to carry an
   * unsubscribe link and a link cannot be built from a hash.
   *
   * It also never expires. A footer link that stopped working after fifteen
   * minutes is the one link in the email that has to work whenever the
   * person gets round to it.
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
   * The NOT NULL that had to go before a member could hold a session.
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
   * Consent to be the example on `/membership`.
   *
   * The membership page sells two fields by showing one photograph's, in
   * full, to anybody who visits. Choosing that photograph by query — most
   * recently annotated, say — would mean a photographer's writing became
   * public because of when they typed it, which is not consent. This column
   * is the photographer saying yes.
   *
   * Defaults to false, so the page shows nothing until somebody offers one.
   * That is the right default even though it means the feature lies dormant
   * until a photographer opts in: silence has to mean no.
   */
  "ALTER TABLE photos ADD COLUMN IF NOT EXISTS is_specimen BOOLEAN NOT NULL DEFAULT FALSE;",

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
  /*
   * When the event that last wrote this membership was created by Stripe.
   *
   * Idempotency is not ordering. Stripe redelivers on any non-2xx for up to
   * three days, so a retried `customer.subscription.updated` can land after
   * the `deleted` that superseded it and rewrite `active` with a future
   * period end — serving paid content to somebody who cancelled. Comparing
   * this in the upsert's WHERE makes the write monotonic as well as
   * repeatable.
   */
  "ALTER TABLE members ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;",

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

  /*
   * Contributors can bring in photographers of their own.
   *
   * Every photographer used to arrive through one person's attention — the
   * owner invites, or somebody applies and the owner approves — which is a
   * ceiling on the thing this gallery says is scarce. Three each, and the
   * default applies to everyone who already exists, so an invitee can
   * invite in turn. That is the part that compounds.
   *
   * A plain counter rather than a table of invitations: there is no pending
   * state to model. The contributor row *is* the invitation here, exactly
   * as it is for the two older doors.
   */
  "ALTER TABLE contributors ADD COLUMN IF NOT EXISTS invites_remaining INTEGER NOT NULL DEFAULT 3;",

  /*
   * Who brought them in. Recorded, never rendered on a public page — it
   * tells the owner which invites led to good work, which is the only way
   * to know whether the mechanism is worth keeping, and it would rank
   * photographers against each other if it were shown.
   */
  "ALTER TABLE contributors ADD COLUMN IF NOT EXISTS invited_by TEXT REFERENCES contributors(id);",

  /*
   * Where a photographer marked the spot, at two precisions.
   *
   * The promise this gallery makes is that it never *reads* a coordinate out
   * of a file, and that is untouched — `derive.ts` still never opens the GPS
   * block. Somebody dropping a pin on a map is the same act as typing
   * `precise_location` in the row above: a deliberate decision to say where
   * they stood, made after the fact and revocable.
   *
   * Two precisions rather than one, because a public globe and a member-only
   * coordinate are otherwise incompatible. The member gate here works by the
   * public query never *selecting* the paid columns, so a coarse point
   * derived at read time would mean naming `precise_lat` in exactly the
   * query that must not name it. The coarse pair is therefore computed once
   * at publish time by `coarsen()` and stored — which also makes a published
   * dot stable, rather than something that moves when the arithmetic is
   * tuned.
   *
   * `DOUBLE PRECISION`, not `NUMERIC`. The Neon driver returns numeric as a
   * *string*, and these rows are cast `as PhotoRow` with no runtime parsing —
   * so a numeric column would put `"47.3769"` behind a field typed `number`,
   * typecheck cleanly, and break every projection silently.
   *
   * No `CHECK` constraint: Postgres has no `ADD CONSTRAINT IF NOT EXISTS`, so
   * one here would fail the idempotency test above and error on the second
   * deploy. Range validation lives in the server action, where a bad value
   * can be turned into a sentence a person reads.
   *
   * No index yet. At fourteen rows and at three hundred the globe query is a
   * sequential scan over a table the feed already scans; `docs/next-version.md`
   * records `photos_globe_idx` beside the existing 300-photograph trigger.
   */
  "ALTER TABLE photos ADD COLUMN IF NOT EXISTS precise_lat DOUBLE PRECISION;",
  "ALTER TABLE photos ADD COLUMN IF NOT EXISTS precise_lng DOUBLE PRECISION;",
  "ALTER TABLE photos ADD COLUMN IF NOT EXISTS coarse_lat DOUBLE PRECISION;",
  "ALTER TABLE photos ADD COLUMN IF NOT EXISTS coarse_lng DOUBLE PRECISION;",

  /*
   * Whether there is anything behind the paywall for this photograph — one
   * bit, derived, and the only thing about the paid columns a public page is
   * allowed to know.
   *
   * `MemberDetails` offered the membership under every photograph alike,
   * including all fourteen where the three paid fields were empty, because
   * the component had no way to tell one case from the other: the columns it
   * would need to check are the columns `FEED_COLUMNS` exists to withhold.
   * So it asked a stranger for money against a shelf that was bare. This is
   * the fact that makes the offer honest, and it is deliberately the *only*
   * fact that crosses — the existence of the fields, never a syllable of
   * their content.
   *
   * Generated and `STORED` rather than computed in the feed query, because
   * the alternative is `SELECT ... precise_location <> ''`, which puts the
   * paid column names into the one select list that must never name them.
   * The derivation happens once, inside the table, where Postgres keeps it
   * true; the query reads a boolean. That is also why this cannot drift the
   * way a flag maintained by `publishPhoto` would.
   *
   * `precise_lat` is in the expression, and it has to be: every published row
   * today has an exact pin and no prose, so a bit derived from the two text
   * columns alone would be false everywhere and would delete the offer from
   * the whole gallery — while members went on receiving a coordinate. The
   * question this column answers is "would a member see something here",
   * and `ExactPoint` is something.
   *
   * Only immutable functions are permitted in a generation expression:
   * `btrim`, `coalesce`, `<>` and `IS NOT NULL` all qualify, which is why
   * the emptiness test is spelled out rather than reaching for anything
   * fancier. `NOT NULL` is safe to declare because no branch can evaluate to
   * null — `coalesce` guarantees text, and `IS NOT NULL` is total.
   *
   * A whole-row reference (`to_jsonb(p)`) is *not* available here, which is
   * worth knowing before trying to make this tolerant of its own absence:
   * Postgres rejects it in a generation expression. The tolerance lives on
   * the read side, in `FEED_COLUMNS`.
   */
  `ALTER TABLE photos ADD COLUMN IF NOT EXISTS has_member_details BOOLEAN NOT NULL
     GENERATED ALWAYS AS (
       btrim(coalesce(precise_location, '')) <> ''
       OR btrim(coalesce(technique, '')) <> ''
       OR precise_lat IS NOT NULL
     ) STORED;`,
];
