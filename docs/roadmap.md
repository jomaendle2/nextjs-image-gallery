# Roadmap

What is deliberately not built, why, and what would trigger each one.
Everything here was found by building or measuring the current version rather
than imagined in advance, so the ordering reflects what actually bit rather
than what sounds important.

Every item has a **trigger** rather than a priority, because priorities drift
and triggers do not. Nothing on this list blocks a small set of testers; that
is the whole point of it being a list rather than work.

The scaling numbers below were measured in August 2026 on the state of the
project at the time — the working is in
[the archived quality audit](archive/2026-08-quality-audit.md).

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
point-in-time-recovery retention actually is. The commands for a manual
`pg_dump` floor, and the note that blobs are covered by none of it, are in
[the archived launch checklist](archive/2026-08-launch-checklist.md); the retention number itself still has to be read
off the dashboard and written down there.

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
`coarsen` collapses everything within about a kilometre onto one
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

## Left at the wrong depth, deliberately

Four things the production-readiness branch fixed at a shallower level than
they deserve, each with the deeper version named. They are here rather than
in a review thread because a comment in a diff is read once.

- **`database.ts` throws at module scope.** `src/lib/database.ts` raises on
  import when `DATABASE_URL` is unset, so importing anything that touches it
  ties an unrelated module to a connection string — including a statically
  rendered legal page, and every unit test of a file that merely imports it.
  `src/lib/auth/ttl.ts` exists partly to dodge this once. The fix is a lazy
  `sql` that resolves the variable on first query rather than at import,
  moving the failure from load time to use time. **Trigger:** the next value
  that has to be extracted from a database-adjacent module to be readable
  elsewhere. Do that rather than extracting a third one.

- **The globe is one derivation cached twice.** `/globe/page.tsx` and
  `/api/globe/route.ts` both call `listGlobePoints()` and `groupIntoCells()`,
  and both declare `revalidate = 3600`. Publishing now clears both, but only
  because `revalidateFeeds` names both — the dots and the card that appears
  when you hover one are the same data behind two independent caches, and the
  bug that hid a new photograph's card for an hour was that list being one
  entry short. The fix is one cached function tagged `globe` and invalidated
  by `revalidateTag`. Nothing in this repo uses tags yet.
  **Trigger:** a third surface wanting the same data, or the list missing an
  entry a second time.

- **The destructive-script guard is opt-in.** `confirmDestructive()` has to
  be imported and called, so a new script that writes to production is
  unguarded until somebody remembers. Every one of them shares the same
  `node --import ./scripts/alias-loader.mjs … --env-file=.env.local` prefix
  in `package.json`; the host print belongs there, or in `harness.mts`, where
  forgetting is impossible. Note that `scripts/migrate.mts` must stay
  unguarded whatever happens — it runs on `vercel-build`, and a guard there
  refuses every production deploy. **Trigger:** the next destructive script.

- **`membershipConfigured()` is read across twelve files**, threaded
  as a prop into `SiteNav` and `GalleryTopBar`, provided as a context to the
  carousel, called directly by `SiteFooter`, and hardcoded to `true` on
  `/membership` to work around the prop's default. Four mechanisms for one
  boolean. `ImageCarousel` now requires the prop so it cannot be silently
  forgotten; `SiteNav` still defaults to false. The fix is one provider high
  enough to cover the pages that need it. **Trigger:** a fifth mechanism, or
  the next page that renders a nav without the flag.

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

- **Nothing detects an export used only in its own file.** About thirty are:
  mostly result and row types in `src/lib/*/repository.ts` and the three
  `NAV_*` constants in `field.ts`. Biome's unused-variable rules are per-file
  and never look at an `export`; there is no cross-file reachability check in
  the build at all. `knip` would find them, and it understands Next's
  convention-reached entry points — pages, routes, `sitemap.ts`,
  `instrumentation.ts` — which a naive tool reports as dead. The cost is a
  dependency and a configuration file full of exceptions, which is why it is
  here rather than in `package.json`. **Trigger:** the next time a deletion
  turns out to have left something behind, or a second reviewer asks whether
  a symbol is live.

- **CI does not build.** Vercel builds every push, so `next build` is covered.
  What is not is `scripts/preflight.mts` and `scripts/migrate.mts`, which
  `vercel-build` runs *before* the build — both are typechecked and
  `schema.test.ts` covers the data they act on, but neither driver has a
  behavioural test, and `vitest.config.mts` cannot pick one up because its
  `include` is `src/**`. **Trigger:** the first preflight or migration
  regression that reaches a deploy.

- **`next-plausible` 3 → 4.** The only outdated dependency, and a major
  version. Deliberately not taken the week before inviting testers: a
  breaking change in analytics buys nothing now and costs a debugging
  session if it misbehaves. `npm audit` reports zero vulnerabilities across
  the tree, so there is no security pressure behind it.

---

## Browsing by subject — the pages the tags are groundwork for

`photos.tags` exists and the editor fills it: a model proposes subjects from
the closed list in `src/lib/photos/tags.ts`, the photographer confirms them
with a click, and a GIN index is already on the column. **No page reads it
yet.**

All 28 photographs were tagged in one pass by `npm run recaption`, so the
distribution is known rather than guessed:

    mountains 11   ocean 10   coast 9   clouds 8   beach 7   waves 6
    palms 4   sunset 4   desert 3   cliffs 3   city 3   fog 3   blossom 3
    architecture 2   glacier 2   ice 2   lake 2   flowers 2   road 2
    volcano 1   sunrise 1   ruins 1   jungle 1   river 1   waterfall 1

Which fired two of the triggers below immediately — six tags already carry
six or more photographs. That is a useful reminder that a trigger is a
measurement and not a delay: these were written expecting to wait, and the
answer was already yes. **The remaining reason not to build is ordering, not
evidence**: the tags have been confirmed by nobody. A model proposed all of
them in a batch and no photographer has yet pressed a chip. Before a page
groups photographs by these strings in public, somebody should look down the
list and disagree with a few — the whole design of the feature is that the
person who took the photograph decides, and a batch run is the one path that
bypasses them.

**There is no way to add a tag without asking the model.** The chips are
built from a run's suggestions, so a deployment with no gateway key — or a
photographer who never presses the button — can remove subjects but never add
one. Places do not have this problem, because the Location field can always
be typed into. Worth fixing when somebody hits it; the honest fix is probably
the full vocabulary behind a "show all" rather than thirty chips by default.

Five of the vocabulary's thirty entries went unused (`canyon`, `forest`,
`night`, `snow`, `wildlife`), which is the deletion trigger at the bottom of
this section, not yet met.

- **`/tag/<slug>`, a page per subject.** The tag *is* the slug — the
  vocabulary is lowercase and hyphen-free so the URL needs no mapping table.
  One query with `WHERE tags @@ ...`, the existing grid, and the existing
  feed columns. **Trigger:** any single tag carried by six or more published
  photographs. Below that the page is a shorter version of the gallery.
  **Met**: six tags qualify. Waiting on confirmation by a person, above.

- **A filter on the gallery.** Chips above the grid narrowing it in place,
  rather than a separate page — closer to how somebody actually browses, and
  it reuses `PhotoFilters` from the dashboard. **Trigger:** three or more
  tags each carrying six or more photographs, so there is something to
  choose *between*. One busy tag wants a page, not a filter. **Met**: six
  tags qualify. Same caveat.

- **Related photographs under the viewer.** "More like this", ranked by
  shared tags and then by recency. The cheapest of the three and the one
  most likely to be used, because it needs no navigation — but the most
  embarrassing when the answer is thin. **Trigger:** the median published
  photograph carries three tags, so a shared-tag ranking has something to
  rank. **Met**: the median is three.

- **A place index.** Explicitly *not* triggered by tags at all; it waits on
  locations repeating. **Trigger:** ten locations carried by two or more
  photographs each. Until then `/globe` is the place-shaped view and it is
  the better one, because a dot on a map says "one photograph, here"
  honestly where a directory entry says "a category" and lies.

The tags themselves have a trigger too: **if, after fifty photographs, some
entry in `PHOTO_TAGS` has never been picked, delete it.** An unused tag is a
chip in the way of the ones that work.

---

## From the original brief

Nothing is left on it. **AI-drafted descriptions** were the last entry and
they shipped: `src/lib/ai/suggest.ts` and
`src/app/api/photos/[id]/suggest/route.ts`, behind `AI_GATEWAY_API_KEY`, in
the shape this section asked for — draft from the photograph, show it to the
photographer, let them edit or reject it, never publish generated text under
somebody's name unreviewed.

Kept as a heading rather than deleted because the entry sat here for weeks
after the feature existed, describing it as "blocked only on a gateway key"
while the key was set and the button was on screen. A roadmap that does not
get things struck off is read as a list of what is missing, and starts lying
in the most expensive direction.

---

## How to decide what is next

Every item above has a trigger rather than a priority, because priorities
drift and triggers do not. The pattern worth keeping from building this
version: **a claim about "many", "fast" or "fine" is a claim about a number,
and it is not verified until somebody has counted.** Three surfaces were
called scalable here; one was broken while it was believed fixed.
