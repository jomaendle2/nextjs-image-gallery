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

### Contributor value said out loud — `fed93a6`

Four things that were already true and never stated: their own page, a
credit linking to their site, GPS stripped from every upload, and direct
publishing with full control. Written specifically enough to become wrong if
the behaviour changes.

### A URL per photograph — `cc239ac`

`/photo/[id]`, with the photograph's own OG image, plus a share control.
Sitemap went from 6 URLs to 24. Two things learned by testing: the share
rule has to key on pointer type rather than `navigator.share` existing
(desktop Chrome exposes it, so feature-detection left the button dead), and
the control has to be icon-only or its label changes width inside the bar
that was just made immovable.

### Alt text — `8aa97cd`

Every photograph used its title as alt text, and titles are places. A screen
reader user got a gazetteer. Now description-then-place, from a tested
helper. Notable because this was the obvious "let a model do it" candidate
and the contributors had already written the text.

### Safe areas — `fc04dd6`

`viewport-fit: cover` plus three `safe-*` utilities that take the larger of
the design's padding and the device inset. No change where insets are zero,
verified. **Wants confirmation on real notched hardware.**

### One near-black instead of three — `acbb6ae`

`--ground` for the viewer, `--color-surface` for documents, and the literal
that had been retyped in three files is gone. The global error boundary
keeps a hand-written copy because it renders when the stylesheet may not
have loaded, and says so.

### Manifest and icons — `6a8d232`

`public/site.webmanifest` had an empty name, white colours on a near-black
site, and no link to it from anywhere. Replaced with a typed `manifest.ts`.
The icons in `public/` were undeclared; the Apple touch icon — the one a
home-screen bookmark uses — was never referenced.

### Focus trapped in the viewer — `77994ed`

`aria-modal` does nothing to the tab order. Measured: nine of twelve tab
stops were outside the dialog, the fourth press landing on a navigation link
behind a blurred backdrop. The first fix was wrong in an instructive way —
`[tabindex]:not([tabindex="-1"])` does not exclude a `<button>` given
`tabIndex={-1}`, because it still matches `button:not([disabled])`. The real
filter is the `tabIndex >= 0` property.

### `main` landmarks on the gallery pages — `cf6a915`

`EmptyGallery` and `StatusPage` had one; the three pages that actually show
photographs did not.

### Multi-file upload — `8e53153`

See contributor value above. Verified against the real ingest path, and the
test rows deleted through the interface afterwards.

### Grid view measured
CLS is exactly 0 on mobile and desktop, including a full scroll to trigger
lazy loading — `aspect-square` plus blur placeholders. Grid → slideshow hash
navigation confirmed: clicking the seventh tile opens the slideshow on the
seventh photograph.

### Structured data — `76027bf`

There was none. Now `ImageGallery`, `ProfilePage` and `ImageObject`, written
as pure functions taking an origin so they are testable and every URL is
absolute. The photographer's own site goes out as `sameAs`. The gallery
schema is capped at 24 so a crawler never reads a megabyte of JSON-LD before
the first photograph paints — every photograph has its own page that
describes itself in full.

`StructuredData` writes the `</script>` escape once. There is a test that
tries to break out through a photograph's title.

### The social card — `8fc429a`

The OG image was the one surface designed by somebody else — flat black,
96pt extra-bold, drop shadow, emoji — sharing no colour, weight or spacing
with the gallery it advertised. Rebuilt in the site's language, with the
title bounded at 70 characters because it comes from a query parameter and
a long one simply ran out of frame. Contributor pages now get their own card
and a canonical URL; previously the one link a photographer shares about
their own work previewed as the generic gallery image.

### Landmarks finished — `cf6a915`, `5db6054`

All five page types now have exactly one `main`.

### Admin actions fail on their own row — `7daff09`

`useServerAction` never caught the action, so a throw inside the transition
reached the error boundary and one failed "Revoke" replaced the whole admin
page with "That didn't load". Verified by aborting the action's POST at the
network layer: the row now reports it, the page keeps its heading and all
33 buttons, and letting the request through clears the error.

### Moderation shows the photograph — `f5be40c`

Sixteen rows identified by title alone, two of them reading "Böblingen,
Germany", each beside an Unpublish button.

### Auth flows exercised

Never tested before this pass. The magic link signs in and lands on the
contributor's own page; replaying a spent token from a clean session is
refused with "That link has expired or was already used", which is the
atomic single-use `UPDATE` doing its job. A signed-in non-owner still gets a
404 at `/contribute/admin` rather than a 403.

### Reduced motion, everywhere — `a31e4ca`

The block named three class names — the viewer's entrance — and everything
else kept moving, including the viewer's own exit animations. Now a blanket
rule with one deliberate exception. Durations are zeroed rather than motion
removed, because the dock's magnification is information: under `reduce` the
selected tile is still 1.45×, it just arrives there.

### Pinch to zoom — `a226e91`

The viewer had zoom buttons and double-tap and nothing for the gesture
everyone actually uses on a phone. Scale derives from the ratio since the
gesture began rather than accumulating, so a round trip returns to exactly
1.000. The photograph needs `touch-action: none` or the browser claims the
two-finger touch for page zoom before any `pointermove` arrives.

---

## Open

Ordered by value, not effort.

### Contributor value — largely done
`fed93a6` says what a photographer gets, which was four true things the page
had never said. `cc239ac` adds the one that did not exist: a URL per
photograph they can send to anyone. `8e53153` lets them upload a shoot
rather than a photograph — several files at once, by picker or drop, with
per-file status.

What remains of the friction: every photograph still needs a title and a
description typed from nothing. That is the AI Gateway candidate below, and
it is now the largest thing left between a photographer and publishing.

### Mobile — mostly done, one thing needs hardware
Safe areas landed in `fc04dd6` but want a real notched device. Speed was
measured and is not a problem: mobile LCP 848ms, FCP 180ms, TTFB 113ms, and
all ten AVIF images on first load total 26KB. Still unchecked: behaviour on
a genuinely slow connection, and interaction latency under CPU throttling.

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

### The unbounded feed query
`listPublishedPhotos()` still has no `LIMIT`, and the home page mounts every
published photograph. The dock, the grid and the JSON-LD each handle this
now, but the query itself does not. Left alone deliberately: adding a `LIMIT`
would silently drop photographs out of a photographer's gallery, which is a
product decision rather than a tidy-up. It wants pagination or a "load more",
not a cap.

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

## Where to go next

Written after seven passes over the code, so it is grounded in what is
actually here rather than in what a photo gallery usually does.

### The read

The scarce asset is curation and trust — a small invited set, real credit,
and a privacy stance most galleries cannot claim (GPS is never read, and
there are tests that prove it). Those are the things worth compounding.

The current bottleneck is **not** revenue. It is two photographers and
sixteen photographs. Building a paid tier now would optimise a funnel with
almost nothing in it. Supply and audience come first, and they feed each
other: photographers join where work is seen and credited, audiences arrive
where the work is good.

The demand-side foundation now exists — a page per photograph, real OG
cards, a sitemap, structured data. What is missing is the other half.

### 1. A way to follow the gallery — feed done, email list open

`1a5bcaf` adds `/feed.xml`; `c9d09c9` adds one per photographer at
`/by/<slug>/feed.xml`, with a visible "follow" beside the link to their own
site. Per-photographer is the half that matters to a contributor —
"people can subscribe to you" is the argument for publishing here.

The email half is built in `190a6fa`: `/subscribe`, double opt-in, one-click
unsubscribe that deletes rather than flags, reachable from the photographers
page since `218c5f9`.

**The send is built** — `5011d14`. A button on `/contribute/admin`, and a
Monday-morning cron at `/api/cron/announce-reminder` that emails *the owner*
that something is waiting rather than mailing the list itself. That is the
whole difference between a schedule and an automation: a wrong title reaches
one person who can still stop it.

`markAnnounced` runs before the first message, not after. If the send dies
halfway the choice is between some subscribers getting a second copy and
some photographs never being announced, and the duplicate is worse — the
photograph is still on the site, in both feeds and in the sitemap.

The body is a pure function in `lib/announcement.ts`, tested like `feed.ts`:
every value in it was typed by a contributor and lands inside HTML in
somebody else's mail client, so the escaping is the risk and it is tested
directly. Twelve photographs listed, the rest counted.

One flaw found by driving it rather than designing it: the panel was first
rendered by the page on `pending > 0`, so sending dropped the count to zero,
the section unmounted, and the "sent to N" confirmation went with it. The
component owns its own visibility now, so the result outlives what produced
it.

Needs `CRON_SECRET` set in production; without it the route refuses to run
rather than becoming a public way to ring the owner's inbox.

There is currently no reason to return and no way to subscribe. Every
visitor is a one-time arrival from a link. That is the single largest gap,
it is cheap, and it is the **precondition for everything below**: a
membership cannot be sold to an audience you have no way to reach.

Concretely: an RSS/JSON feed, and an email list that sends when new work is
published. Nothing more.

It also strengthens the contributor pitch, which is the supply side of the
same loop — "your work goes out to N people who asked to see it" is a much
better sentence than "your work appears in a gallery".

### 2. Lower the cost of contributing — the supply side

Batch upload (`8e53153`) removed most of the friction. What remains is that
every photograph needs a title and a description typed from nothing.

This reframes the AI Gateway question. Drafting a description at upload is
not a nice-to-have feature; it is the remaining tax on the scarce resource,
which is photographers' willingness to publish their fortieth image rather
than their fourth. The constraint stands: the model proposes a description,
never a place — it cannot know where a photograph was taken, and a
confident wrong location on someone else's work is worse than a blank field.

### 3a. What a membership should sell

Exact locations are decided. The question is what sits beside them, and the
test each candidate has to pass is: **does a photographer want it to exist?**
This gallery's supply problem is photographers, so anything that makes
publishing here feel worse is expensive however well it converts.

**Strong — build these with locations:**

- **The location itself, per photograph, opt-in.** Nothing is disclosed that
  a photographer did not type. This is the one thing only this community can
  supply, and it fits the privacy stance rather than contradicting it: EXIF
  still never leaks a coordinate; the photographer *chooses* to say where
  they stood.
- **How the photograph was made.** The exposure line is already shown; the
  approach is not — time of day, what they waited for, what they would do
  differently. It costs a photographer a paragraph they usually enjoy
  writing, and it is the thing other photographers actually pay for. It also
  makes the member's relationship with the photographer rather than with us.
- **The full archive.** This is the honest answer to a problem already open
  in this document: `listPublishedPhotos` has no `LIMIT`, and the fix has
  been deferred because a cap silently drops photographs out of a
  photographer's gallery. If the free gallery shows recent work and members
  see everything, the cap becomes a product boundary instead of a
  regression — one decision solving a technical problem and a commercial one.

**Worth considering, with a caveat each:**

- **A share of revenue to photographers, by view.** Strategically the
  strongest thing on this list — "your work earns here" is the best
  recruitment sentence available, and it makes the membership something a
  photographer wants to sell. The caveat is operational: payouts, tax,
  thresholds, and a number that will be small at first and visible.
- **Full-resolution viewing.** Not downloads, which invite the licensing
  question before there is an answer to it. Simply seeing the original where
  the gallery serves a capped copy.

**Rejected, and why, so they do not come back around:**

- **Early access.** Withholding new work from the audience you are trying to
  grow, and from the feed and the email list just built to reach them.
- **Ad-free.** There are no ads.
- **Members-only photographs.** It splits the gallery in two and gives a
  photographer a reason to wonder which half their best work landed in.
- **A members' comment section.** A moderation obligation, not a feature.

### 3b. Membership, when there is an audience to sell to

The architecture is already waiting for it, deliberately. Sessions and
login tokens were re-keyed onto email precisely so a paying member with no
`contributors` row could hold a session — see the migration note in
`schema.ts`, the `getCurrentMember` named in `session.ts`, and the comment
in `tokens.ts`.

Exactly three things block it, and they are small:

- `login_tokens.contributor_id` is `NOT NULL` (`schema.ts`)
- `sessions.contributor_id` is `NOT NULL` (same)
- `mintLoginToken` returns null for an address with no contributors row

**What a membership should sell** matters more than the plumbing. The
strongest candidate is the one already sketched: precise locations. It is
genuinely valuable to the people who look at landscape photography, only
this community can supply it, and it fits the privacy stance rather than
contradicting it — the photographer *chooses* to disclose a spot, which is
categorically different from EXIF leaking it. It must stay per-photograph
and opt-in, and the money has to reach the photographer, or it converts the
site's central promise into a thing it sells out.

Weaker candidates, for the record: ad-free (there are no ads), downloads
(commoditised), early access (annoys the audience you are trying to grow).

### 4. Prints and licensing — later

Money flowing to photographers is the strongest recruitment argument there
is, and it is operationally heavy: fulfilment, tax, returns, disputes. Worth
wanting, not worth starting before 1–3.

---

## Also done

- **Security headers** — `4dc5320`. The app sent none. Six now, including a
  `Permissions-Policy` denying geolocation, which is the browser-facing
  version of the promise the site makes to photographers. A script CSP is
  deliberately absent and the config says why: nonces need middleware, and
  middleware ahead of the cache is the cost this codebase already declined
  to pay for auth.
- **Touch targets** — `7c8c69c`, `53d74fc`. Eighteen route/viewport
  combinations, nothing under 44px.

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
