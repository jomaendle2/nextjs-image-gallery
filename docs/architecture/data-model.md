# The data model

Nine tables. `src/lib/schema.ts` is the source of truth — a list of additive,
idempotent statements rather than a migration folder, so the columns a table
has now are its `CREATE TABLE` plus every `ALTER TABLE … ADD COLUMN IF NOT
EXISTS` below it. Read the file for the exact shape; this says what each
table is for and what guards it.

`src/lib/schema.test.ts` holds the mechanical rules: every statement
re-runnable, no `DROP TABLE`, no `ALTER` on `image_views`, backfills bounded
by a predicate, a table declared before anything references it, and
coordinates `double precision` rather than `NUMERIC`.

---

## `image_views`

View counts, keyed by the string id a photograph has had since before there
was a `photos` table. **The one table nothing may alter** — `schema.test.ts`
asserts it, because this is live data that predates everything else here and
an `ALTER` on it is how a migration would take the counts with it.

## `contributors`

One row per photographer. `slug` is what `/by/[slug]` resolves;
`role = 'owner'` is the single admin. `revoked_at` is how access ends —
nothing is deleted, and the public feed joins on `revoked_at IS NULL`, so
revoking removes the work and restoring brings it back.

`invites_remaining` (default 3) and `invited_by` carry the peer-invitation
chain. `src/lib/auth/contributors.ts` is the only file in `src/` that inserts
into this table, which a test asserts.

## `photos`

The gallery. Beyond the obvious columns:

- **Two stored files.** `blob_url`/`blob_pathname` is the untouched original;
  `display_url`/`display_pathname` is the re-encode the gallery serves, which
  carries no metadata. The public read path selects the display copy.
- **Two stored points.** `precise_lat`/`precise_lng` is what the photographer
  marked and only members see; `coarse_lat`/`coarse_lng` is the centre of a
  `CELL_KM` cell and is the only pair that reaches a public payload.
  Invariants I6 and I15 in [security.md](security.md) are that rule.
  Coarsening is stored rather than derived so a published dot cannot move
  because somebody later tuned the arithmetic — which is why changing
  `CELL_KM` is a migration, described in
  [the runbook](../operations/runbook.md).
- **Three members-only fields.** `precise_location`, `technique`, and the
  precise pair. `has_member_details` is the cheap public flag that says
  whether there is anything behind the gate, so the offer can be shown
  without the content being in the page.
- `published_at` null means draft. `announced_at` null means the mailing list
  has not been told. `is_opener` pins the photograph the gallery opens on;
  setting it clears the others in the same statement.
- `tags` is a `text[]` with a GIN index, filled by the suggestion model and
  edited by the photographer. Nothing reads it publicly yet — see
  [the roadmap](../roadmap.md).

## `applications`

The public form at `/contribute/apply`. `status` moves pending → approved or
declined, and approving is what creates the `contributors` row.

## `login_tokens` and `sessions`

Both key on a hash, never the token itself. Both carry `contributor_id`
**and** `email`, and both allow the former to be null — a member who has paid
but is not a photographer holds a session with no contributor row.
`expires_at` is set from `LOGIN_TTL_MINUTES` (`src/lib/auth/ttl.ts`), which
is interpolated into the prose that quotes it rather than retyped;
`security-copy.test.ts` enforces that.

`used_at` on a token is what makes a sign-in link single-use. Opening the
link does not set it — only pressing the button on the page it lands on does,
so a mail scanner cannot spend it.

## `subscribers`

The mailing list, double opt-in: a row exists from the first request, but
`confirmed_at` is what a send checks. `unsubscribe_token` is a stable
per-address secret, so the link in every message keeps working.

## `members`

Written only by the Stripe webhook. `stripe_customer_id` is UNIQUE, which is
what makes an account takeover by re-registering an address fail rather than
overwrite. `current_period_end` is what access is actually checked against,
so a cancellation mid-period keeps working until it expires.

## `photo_member_views`

Attribution, aggregate per photograph per day. Deliberately holds nothing
that could reconstruct one person's viewing history — the shape is the
privacy guarantee, and it is recorded from day one so that paying
photographers later is a decision rather than an archaeology problem.
