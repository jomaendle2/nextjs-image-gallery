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

**Trigger: the moment somebody other than you opens a preview link.** A Neon
branch per preview is a dashboard setting, not code.

### 2. Windowing the *public* gallery — past roughly 300 photographs

(The contributor dashboard is handled: rows are capped at 30 with a reveal
control, and filtering searches the whole set rather than the visible
window.)

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
