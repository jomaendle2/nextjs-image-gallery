# Quality audit — the beauty of earth.

Running record of the production-readiness pass. Kept in the repo rather
than in a session, because the work spans many sittings and the reasoning is
worth more than the checklist.

Scope, from the brief: interface quality and design consistency; unfinished
work and inconsistency; end-to-end correctness; SEO and growth; security;
mobile polish, speed and layout stability; Next 16 / React 19 practice; and
making contribution worth someone's while.

---

## Done

### Thumbnail dock rebuilt — `9358f8c`

`scale-*` in Tailwind v4 emits the standalone `scale` property, not
`transform`. Six components paired a scale utility with a
`transition-[transform,…]` list, naming a property that never changed, so
none of those scales had ever animated. The `@media (hover: none)` block
meant to cancel hover-grow on touch was dead for the same reason — and three
of its four selectors matched nothing in the codebase.

The dock now uses fixed slots (52px, 60px from `sm`) with the tile scaling
inside them (measured: 0 of 14 slots shift on selection, at 390/834/1440),
`useDockScroll` for always-centre behaviour with rAF coalescing and
`scrollIntoView` clamping, and a `dock-fade` mask for the overflow hint —
a mask rather than a gradient because the strip sits on an ambient field
sampled from the photograph, so there is no fixed colour to fade to.

### SEO foundation and failure states — `aa26e54`

The canonical origin was defined twice and disagreed with itself: a
hardcoded `https://images.jomaendle.com` in `layout.tsx` against
`siteOrigin()` everywhere else. Now one origin, configuration-driven.

Added `sitemap.ts` (generated from the contributor table, revoked and
empty contributors filtered out), `robots.ts` (`/api/` disallowed as much
for cost as tidiness — `/api/og` renders per unique `title`), and the three
missing boundaries `not-found.tsx`, `error.tsx`, `global-error.tsx` with a
shared `StatusPage`.

### Biome rule set completed — `aa26e54`

The config was already near-maximal. Diffing it against Biome 2.5.8's schema
found the only unlisted applicable rules were the six test-hygiene ones;
everything else missing was Vue, Qwik or Solid. `noFocusedTests` matters:
unlisted rules fall back to the recommended preset, so a stray `.only` could
have kept CI green while running one test.

**`suspicious/noUnnecessaryConditions` stays off, deliberately.** Enabling
it flags 13 `if (!ref.current) return` guards as "always truthy". Biome's
type inference does not resolve React 19's `useRef` overloads, and those
guards are genuinely required — the ref is null before mount. Do not enable
it without re-checking that.

### Caption bar stopped resizing — `55431c4`

The bar sits below the photograph, so its height comes out of the image's.
Three things in it changed height per photograph — the description wrapping
to a second line, the EXIF line existing only when there was EXIF, and the
view counter changing width as NumberFlow animated past a digit boundary.
All three are reserved now. Measured across all fourteen photographs: one
unique layout per breakpoint, where before there were two on tablet and four
on desktop. Load CLS was already ~0 and still is.

### Two authorisation holes closed — `1e1425c`

`/api/photos/draft` checked that a blob URL was ours but not whose it was,
and published blob URLs are public in the page markup — so one contributor
could claim another's photograph. `POST /api/views` was unauthenticated,
unvalidated and unlimited, and would create a row for any string, while the
read had no `LIMIT` and is fetched by every visitor.

The near-miss worth remembering: the obvious fix for the second was a strict
nanoid regex on the id. Testing against the real table showed the fourteen
imported photographs kept numeric ids (`"1"`–`"14"`) and hold every view
this site has counted — the tight regex would have switched view counting
off for the whole gallery. The `WHERE EXISTS` gate is the guarantee; the
regex is only a cheap bound.

### End-to-end pass over every public route

All eight routes render, no console errors, no horizontal overflow. This
found that **the database had not been migrated**: `getCurrentContributor`
joins on `sessions.email`, added in `0636edc`, and every `/contribute` route
was answering 500 with `column s.email does not exist`. `npm run db:migrate`
fixed it. Worth knowing that the code and the schema are coupled this way at
deploy time — shipping that commit without running migrations takes the
whole contributor flow down.

The new `error.tsx` caught it and showed "That didn't load" rather than a
stack trace, which is exactly the day it was written for.

---

## Open

Ordered by value, not effort.

### Contributor value — partly done
`fed93a6` says what a photographer gets, which was four true things the page
had never said. `cc239ac` adds the one that did not exist: a URL per
photograph they can send to anyone.

Still open, and the biggest remaining one: **uploading is work.** Every
photograph needs a title and a description typed from nothing. See the AI
Gateway note below — this is the friction worth removing.

### Mobile polish and speed
Real-device-shaped checks: touch targets, safe areas, scroll behaviour,
image weight on a slow connection, interaction latency.

### Vercel AI Gateway — evaluated, one candidate worth building

Assessed against what the site actually needs rather than what the
technology can do. Four candidates, in order of how well they hold up:

**1. Drafting a title and description at upload — worth building.** This is
the only one that removes friction a contributor actually feels. Uploading
currently means writing a title and a description from scratch for every
photograph, which is exactly where a photographer with forty good images
stops at four. A model that proposes both from the image, with the
photographer editing before publishing, keeps a human author on every word
while turning a blank field into a correction. The AI Gateway fits: one
provider-agnostic call, failure is a non-event because the fields simply
stay empty, and the cost is bounded by uploads rather than by traffic.

The honesty problem is real but avoidable — the model must not name places.
It cannot know where a photograph was taken, and a confidently wrong
"Amalfi Coast, Italy" on someone else's work is worse than an empty field.
Propose the description; leave the title and the location to the person who
was standing there.

**2. Alt text — not needed, and the reason matters.** This looked like the
obvious candidate and it was wrong. The descriptions were already written
by the contributors and were simply not being used for alt text; `8aa97cd`
fixed that with a pure function and no model. Worth generating only as a
fallback for photographs whose description is empty, which is a case the
upload assist above would mostly prevent from arising.

**3. Search by description — not yet.** Sixteen photographs do not need
embeddings. Revisit when the feed is large enough that scrolling it is the
problem; the `LIMIT`-less `listPublishedPhotos` will need attention first
regardless.

**4. Automatic tagging for discovery — no.** It would generate a taxonomy
nobody asked for, and the gallery's whole posture is a small curated set
rather than a browsable index.

### Marketing surfaces
Per-photograph pages and sharing landed in `cc239ac`, which was the
foundational gap — there was no unit to share. Still missing: a feed
(RSS/JSON) so the gallery can be followed, and any reason for a visitor to
return. Neither should be built before deciding whether this site wants
recurring visitors or is a place people arrive at once, by link.

---

### A unique index on `photos.blob_pathname`
`1e1425c` closes the attribution hole in application code. The database
should enforce it too, but `CREATE UNIQUE INDEX` fails if duplicates already
exist, and the migration list is documented as safe to re-run — so check
first, then add:

```sql
SELECT blob_pathname, count(*) FROM photos
GROUP BY blob_pathname HAVING count(*) > 1;
```

---

---

## Notes and constraints

- `listPublishedPhotos()` has no `LIMIT`. Everything downstream must survive
  an unbounded feed; the dock now does. The grid and the carousel have not
  been checked against this.
- Plausible's domain (`thebeautyof.earth`) is hardcoded in `layout.tsx` and
  is *not* the same as the configured origin. Left alone — analytics domain
  and serving origin can legitimately differ — but noted in case it is a
  second copy of the bug fixed in `aa26e54`.
- The Next.js dev-tools indicator renders in a shadow root at bottom-left.
  It shows up in screenshots and is not app UI.
- The fourteen imported photographs have numeric ids (`"1"`–`"14"`); only
  newer ones are nanoids. Anything that validates a photo id has to accept
  both — this has already caused one near-miss.
- A contributor's description contains a typo, "Aerial view of tale waves".
  Content rather than code, so left alone, but it now appears in alt text
  and in the `/photo/1` metadata where it is more visible than it was.
