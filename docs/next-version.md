# The next version

What is deliberately not in the first release, why, and what would trigger
each one. Everything here was found by building or measuring the current
version rather than imagined in advance, so the ordering reflects what
actually bit rather than what sounds important.

Nothing on this list blocks five testers. That is the whole point of it
being a list rather than work.

---

## Ordered by what will hurt first

### 1. A separate database for preview — do this before the testers arrive

Preview, development and production all point at one Neon database. A
preview URL looks like a safe place to press things and is not: publishing,
unpublishing or deleting on one changes what the public sees. It cost two
real photographs during testing, and creating a test contributor put a real
row in the real `contributors` table.

The contributor pages now warn on any non-production deployment, which stops
the surprise being silent — but a warning is not isolation.

**And it was worse than a warning could cover: preview builds were migrating
the production schema.** `vercel-build` runs `scripts/migrate.mts` on every
build, and that script had no environment gate — `preflight.mts` has had one
since it was written, and the difference was not deliberate. So pushing a
branch that added a statement to `MIGRATIONS` executed it against live data
the moment Vercel built the preview: before review, before merge, and
including the statements that rewrite `exif` and backfill
`display_pathname`. There is also no migration ledger — the array is replayed
in full every build — and no down-migrations, so correctness rests entirely
on `schema.test.ts`'s idempotency assertion.

`migrate.mts` now refuses outside production unless
`ALLOW_PREVIEW_MIGRATIONS=1` is set. That is a mitigation, not the fix: a
preview branch needing a new column now renders a broken preview instead of
migrating production, which is the better of two bad outcomes and still a bad
one. **The gate should be deleted the day preview gets its own branch
database.**

Worth confirming while you are in the dashboard: what the Neon
point-in-time-recovery retention actually is. Nothing in this repo records a
backup or restore story for either the database or the blobs.

**Trigger: the moment somebody other than you opens a preview link.** A Neon
branch per preview is a dashboard setting, not code.

### 2. Windowing the *public* gallery — past roughly 300 photographs

The contributor dashboard is handled, and now measured rather than
asserted — `npm run probe:scale` inserts synthetic drafts, reads the real
page through a real session, and deletes them:

| rows | HTML | render |
| ---: | ---: | ---: |
| 50 | 216 KB | 84 ms |
| 150 | 283 KB | 87 ms |
| 300 | 384 KB | 99 ms |
| 600 | 585 KB | 117 ms |

**0.67 KB per row, linear** — eight times cheaper than a gallery
photograph, because the 30-row cap means only thirty thumbnails are ever
built and the rest is serialised props. At 600 rows the page is 585 KB and
renders in 117 ms, so the dashboard's own ceiling is somewhere past a
thousand, not the "few hundred" its source comment guesses. That comment
now points here.

Worth knowing *why* the props still cost something: `PhotoList` receives
every row so it can filter across the whole set rather than the visible
window. That is the right trade — a search that only finds what is already
on screen is the way paginated search usually goes wrong — but it is why
the cost is per row rather than per rendered row.

Measured, not guessed: 136 KB of HTML at 16 photographs, 676 KB at 116.
**5.4 KB and 5 DOM nodes per photograph, linear.** That projects to about
1.7 MB at 300 and 2.8 MB at 500.

It is not the metadata — descriptions average 47 characters. It is the
thumbnail markup for every photograph plus the flight data, both of which
scale with the whole set rather than with what is on screen. So there is no
trimming to do; the viewer has to stop holding the full list, which changes
how the dock and the keyboard navigation work.

Also fixes `/photo/[id]`, which serialises the entire gallery into a page
whose job is to show one photograph.

**Trigger: 300 published photographs.** Five photographers at a few dozen
each lands near 676 KB, which is less than one of the photographs on the
page.

**`/globe` must stay text-only, and this is the reason.** It renders a
grouped list of every photograph with a marked place, and the obvious next
idea is to put a thumbnail beside each one — which reproduces exactly the
cost above, on a second page, at the same 5.4 KB per photograph. The page is
affordable because it costs per *place* rather than per photograph:
`coarsen` collapses everything within about a hundred kilometres onto one
point, so 300 photographs are roughly 120 cells, and the canvas is handed
three numbers a cell rather than the photograph lists. If a picture is
wanted there, it is one picture per cell chosen server-side, not one per row.

**That escape hatch has now been taken, and `/api/globe` is where it went.**
Pointing at a place on the expanded globe shows a card with the place, the
count and one thumbnail — and none of it is in the page payload. The route is
fetched when the overlay opens, cached for the same hour as the page, and
returns one representative photograph per cell picked by `DISTINCT ON` in
`listGlobeThumbnails`. `/globe` itself is byte-for-byte what it was: the
canvas is still handed three numbers a cell, and the readers who never open
the globe pay nothing.

| photographs | `/globe` props | `/api/globe`, on open |
| ---: | ---: | ---: |
| 14 | ~0.4 KB | ~2 KB |
| 300 | ~4 KB | ~35 KB |
| 1000 | ~10 KB | ~90 KB |

**Trigger for splitting that route: ~800 photographs**, or a gzipped body
past about 25 KB. At that point the per-cell `photos` arrays are most of the
payload and belong in a per-cell route, leaving labels, counts and thumbnails
in the list. Same shape of decision as the windowing above, written down now
so it is crossed deliberately.

**And the index behind it.** `listGlobePoints` has no index; it is a
sequential scan over the same table the feed already scans, which at 14 rows
and at 300 is free. `photos_globe_idx` — partial, on `coarse_lat` where it
is not null — is the eventual answer, and it lands with the same
300-photograph trigger as the windowing above rather than before it. An
index added early is an index nobody can measure.

### 3. Turning the membership on

Deliberately off: `STRIPE_MEMBERSHIP_PRICE_ID` is unset in production, so
the page says "not open yet" and nothing misleads anybody. Switching it on
is a sequence, and missing any step means payments taken and not recorded:

1. Set the price id.
2. Register the webhook endpoint — **there are none registered today**.
3. Set `STRIPE_WEBHOOK_SECRET`.
4. Confirm the endpoint's API version matches `API_VERSION` in
   `src/lib/stripe.ts`. Two silent bugs lived on exactly that seam.
5. Swap to live keys, then re-run `scripts/setup-billing-portal.mts` — the
   portal is configured per mode and test-mode config does not carry over.

**Also required before real money:** Stripe Tax, which is a decision about
selling into the EU and US from Germany rather than a code change, and the
operator address in `src/lib/legal.ts`.

### 4. `CRON_SECRET`, or the weekly reminder never fires

`vercel.json` schedules `/api/cron/announce-reminder` every Monday at 09:00
unconditionally. Without the secret the route refuses to run, so the job
fires weekly and fails weekly, and nobody is reminded there is work to
announce.

Deliberately not in the build preflight: the harm is that *you* miss a
nudge, which you would notice, and Vercel logs the failed invocation.
Guards that fire on non-problems are the ones people learn to bypass.

---

## Worth doing, no deadline

- **Sign out everywhere.** `destroySession` kills the current cookie only,
  and nothing prunes sessions belonging to a device somebody has lost.
  Expired rows are now cleaned up alongside login tokens, but there is no
  "end all my other sessions".
- **`memberExists` enrols an address permanently.** Once an address appears
  in `members` it can request sign-in links forever, including after
  cancelling. An attacker gains nothing — links still only reach the real
  inbox — but the surface is wider than it needs to be.
- **Private storage for original uploads.** The published copy carries no
  metadata, but the untouched original keeps its GPS and sits in public blob
  storage behind an unguessable URL that is never linked. Nothing leaks; the
  guarantee currently rests on an unlisted URL rather than on access control.
- **Paying photographers.** `photo_member_views` has recorded attribution
  from day one, aggregate per photograph per day, with nothing that could
  reconstruct one person's viewing history. Dividing a pool by it needs
  Stripe Connect, thresholds and tax — a separate piece of work, and one that
  only makes sense once there is a pool.

- **`next-plausible` 3 → 4.** The only outdated dependency, and a major
  version. Deliberately not taken the week before inviting testers: a
  breaking change in analytics buys nothing now and costs a debugging
  session if it misbehaves. `npm audit` reports zero vulnerabilities across
  the tree, so there is no security pressure behind it.

---

## From the original brief, still unbuilt

- **AI-drafted descriptions** through the Vercel AI Gateway. Blocked only on
  a gateway key. The shape that fits this site: draft a description from the
  photograph, show it to the photographer, and let them edit or reject it —
  never publish generated text under somebody's name unreviewed.

---

## How to decide what is next

Every item above has a trigger rather than a priority, because priorities
drift and triggers do not. The pattern worth keeping from building this
version: **a claim about "many", "fast" or "fine" is a claim about a number,
and it is not verified until somebody has counted.** Three surfaces were
called scalable here; one was broken while it was believed fixed.
