# Security architecture

Written after two review rounds found fifteen defects in code that had
already been reviewed once. The individual fixes are in the git history and
in `security-review.md`; this is the part worth keeping — what the system
trusts, what it must never trust, and the rules that would have caught those
defects before they were written.

Every invariant below is numbered, and every one of them is here because
something violated it. None is hypothetical.

---

## 1. What this system actually protects

Three assets, in order of how much damage losing them does:

| Asset | Why it matters | Worst case |
| --- | --- | --- |
| **A photographer's identity and work** | Their name is on every image; the site's promise is that where they stood is nobody's business | Their photograph republished under another name, or their location disclosed |
| **A member's money and billing data** | Cards, invoices, addresses — held by Stripe, but reachable through a portal link we mint | Someone else's card and invoices shown to the wrong person |
| **An inbox** | The only identity this system has | Someone signs in as someone else |

Note what is *not* on that list. The photographs themselves are public.
Membership content is worth €5 and is not worth building a fortress around.
The order matters, because it decides what gets a hard guarantee and what
gets a reasonable effort.

---

## 2. Trust boundaries

**The browser is never trusted.** Not form fields, not query parameters, not
JSON bodies, not headers, and specifically **not URLs the user was shown**.
A blob URL rendered in the markup of a public page is attacker-supplied data
the moment it comes back in a request — this is exactly how `blobIsClaimed`
was defeated.

**The session cookie is an opaque lookup key and nothing more.** It carries
no claims. Everything about the bearer — their address, whether they are a
contributor, whether they are an owner, whether they are a member — is read
from the database on each use. A cookie that carried a role would be a
signed assertion we would then have to keep honest.

**Stripe is trusted about money, not about people.** After signature
verification, a webhook is authoritative on *what was paid and by which
Stripe customer*. It is **not** authoritative on *who that is*, because in
an anonymous checkout the email is typed by whoever is at the keyboard. This
distinction is the whole of §4.

**Email delivery is the identity boundary.** Control of an inbox is the only
proof of identity this system has or wants. There are no passwords, so there
is nothing to steal, phish, or reuse. Everything follows from this: if a
capability can be reached without a link sent to the address, it is a hole.

**The database is the authority on authorization.** Not the caller, not the
UI, not a prior check.

---

## 3. Invariants

### I1 — State changes on POST, never on GET

*Violated by: unsubscribe, sign-in verification.*

A GET must be safe to repeat and safe for a machine to perform. Corporate
mail gateways (SafeLinks, Proofpoint, Barracuda) fetch every URL in an
inbound message. Any single-use token spent by a GET is spent before its
recipient sees it.

This cost us the two worst *reliability* bugs on the site: subscribers
silently unsubscribed by their own employer's scanner, and magic links that
could not work at all behind a corporate gateway — failing identically to a
stale link, so nobody could report it.

**Rule:** if a handler writes, it is a POST. A link in an email opens a page
with a button; the button does the work. This is one extra press and is not
negotiable.

### I2 — Authorization lives in the WHERE clause

*Held throughout. Documented so it keeps holding.*

`UPDATE … WHERE id = $1 AND author_id = $2` is a check that cannot be
forgotten, skipped by a new caller, or defeated by a forged id — it updates
zero rows instead of someone else's. A check in the caller is a check the
next caller will not do.

The owner's branch omits `author_id` deliberately and is the only place that
may.

### I3 — Anything the interface refuses, the server refuses

*Violated by: revoking an owner.*

A server action is a public endpoint. "The button is hidden" is not a
control. Revoking an owner was prevented only in `ContributorRowActions`,
and doing it anyway 404s the admin page for everybody and needs database
access to undo.

**Rule:** every rule expressed in a component must have a twin in the action
it guards. If writing the twin feels redundant, that is the feeling of the
control being real for the first time.

### I4 — Identity is proven by inbox control, never asserted

*Violated by: anonymous checkout writing a membership row.*

Anyone may *claim* an address. Only a link sent there proves it. Therefore:

- Claiming an address may grant **nothing** until the link is followed.
- A claim may never **overwrite** anything belonging to that address.

The second half is the one that was missed. Anonymous checkout was justified
on the grounds that buying for someone else's inbox grants the buyer no
access — true, and irrelevant, because the *write* repointed the victim's
row at the attacker's Stripe customer and their own billing portal then
opened the attacker's invoices.

**Rule:** when reasoning about self-asserted identity, ask both questions —
what does this let them *read*, and what does this let them *overwrite*.

### I5 — A record belongs to the principal already in it

*Violated by: `upsertMember`'s unconditional `DO UPDATE`.*

An upsert keyed on a user-supplied value must not silently change the row's
owner. `ON CONFLICT (email) DO UPDATE … WHERE members.stripe_customer_id =
EXCLUDED.stripe_customer_id` turns a takeover into a no-op — and a no-op
rather than an error, so a replay still returns 200 and Stripe is not made
to retry an attacker's event for three days.

### I6 — Paid content is never in a cacheable payload

*Held. The load-bearing decision of the membership.*

`precise_location`, `technique` and the exact pin (`precise_lat`,
`precise_lng`) are absent from `FEED_COLUMNS`, so they are not in any page's
payload and cannot leak by being rendered conditionally. They are reachable
only through one authenticated route which sets `private, no-store` and is
rate limited.

The test of this design: deleting the client component that displays them
would not expose anything.

**Why the pin is stored twice.** A public globe and a member-only coordinate
are otherwise incompatible, because the gate here *is* the select list — a
coarse point derived at read time would mean naming `precise_lat` in exactly
the query that must never name it. So `coarsen()` runs once at write time
and both precisions are stored: `coarse_lat`/`coarse_lng` are public and in
`FEED_COLUMNS`, the exact pair is not. Stored rather than derived also makes
a published dot stable, instead of something that moves when somebody tunes
the arithmetic.

The exact point is guarded *harder* than the prose, not the same. Prose is
vague and deniable; a coordinate is machine-actionable, republishable in
bulk, and names a private place precisely — which is why I11 now covers this
route as well.

### I7 — A guard must check the value an attacker can actually obtain

*Violated by: `blobIsClaimed`.*

The guard matched `blob_pathname` (the original upload, whose URL is never
rendered) while every page renders `COALESCE(display_url, blob_url)` — the
display copy. The one URL obtainable from view-source was the one URL the
check could not recognise. A correct fifteen-line comment sat above it.

**Rule:** when writing a check, name the exact value the attacker holds and
confirm the query compares against *that*. A guard and its comment can agree
with each other while both disagree with the code.

### I8 — Third-party shape changes must fail loudly

*Violated twice, in one file: `current_period_end` and
`invoice.subscription`.*

Both moved in Stripe's API. Both were read through `as unknown as`, which
compiled, returned `undefined`, and did nothing — one wrote NULL for every
member, the other made dunning a no-op. `tsc` passed throughout.

**Rule:** `as unknown as` around a third-party type is a runtime assumption
wearing a compile-time disguise. It is sometimes necessary — the runtime
shape genuinely varies by account API version — but then:

1. Read the current location first, fall back second.
2. Unit-test both shapes.
3. Pin `apiVersion` so the next move is a visible break.
4. **If one such cast turns out to hide a moved field, audit every other
   cast in that file the same day.** Not doing this is why the second bug
   survived the review that found the first.

### I9 — Missing security-relevant configuration fails closed

*Violated by: email.*

With no provider configured, `send()` printed the message and returned
success. In production that meant magic-link tokens — each a valid
credential for the life of the link — written into the platform log, while the
person was told to check an inbox nothing had been sent to.

**Rule:** a development convenience must be gated on being in development.

### I10 — Events arrive late, duplicated, and out of order

*Partly held (idempotent), partly violated (ordering).*

Stripe redelivers on any non-2xx for up to three days. Handlers are
idempotent, which covers duplication. Ordering is not covered: a retried
older `updated` can land after a `deleted` and rewrite `active` with a
future period end, serving paid content to a cancelled subscriber.

**Rule:** an idempotent write is not a monotonic one. Where a later event
supersedes an earlier one, compare timestamps in the `WHERE`.

### I11 — Endpoints that spend money or send mail are rate limited

*Violated by: checkout, portal.*

`signInLimiter` guards sign-in and applications. `/api/stripe/checkout` is
unauthenticated and creates a live Stripe object per call; `/api/stripe/portal`
is session-gated but unlimited.

**Rule:** anything that costs money, sends mail, or calls a metered third
party gets a limiter, whether or not it is authenticated.

### I12 — Responses must not reveal whether an address is known

*Violated by: sign-in response timing.*

`requestSignIn` returns the same words either way, which the code comments
at length about. But an unknown address does two SELECTs and returns, while
a known one additionally does an INSERT and an **awaited HTTPS round trip to
Resend**. A stopwatch reads the difference. The form is an enumeration
oracle for the list it exists to protect.

**Rule:** identical words are not enough; the observable work must be
comparable. Move the send off the request path.

### I14 — The map library never reaches a public page

*Held by construction, and pinned by a test.*

MapTiler is the sixth processor in `PROCESSORS`, and the only one a *visitor*
never reaches. The location picker lives on `/contribute/photos`, behind a
session; nothing on a public page contacts MapTiler, no cookie is set, and no
consent banner is triggered. That claim is what `/privacy` says, so it has to
be enforced rather than remembered.

Four checks in `src/lib/security-location.test.ts`: exactly one file in the
codebase mentions the map library and it is `LocationPicker.tsx`; nothing
under `src/components/gallery` mentions it; no `route.ts` matches
`/maptiler|\btiles?\b/i`; and no file names a `NEXT_PUBLIC_*MAP*` variable.

**No tile proxy**, deliberately, recorded as the third of those checks. A
`/api/tiles` route would be a public endpoint spending metered third-party
money — the exact thing I11 exists to stop — and would multiply function
invocations by every tile of every pan, to buy no privacy at all: the page is
behind a session, so the only addresses MapTiler would stop seeing belong to
the handful of photographers already signed in.

`MAPTILER_KEY` is read on the server and passed to the picker as a prop.
`NEXT_PUBLIC_MAPTILER_KEY` would have been one word shorter and would have
compiled the key into every client bundle on the site.

### I15 — A public payload carries only coarsened points

*Held by construction, and pinned by a test.*

`coarsen()` is called from exactly two files: `photos/repository.ts`, which
stores the public point at publish time, and `LocationPicker.tsx`, which
shows a photographer what will be stored before they agree to it. A third
caller is how the stored dot and the drawn one would come to disagree, and a
component recomputing at render time would need the exact point in its
payload to do it.

`publishPhoto` *derives* the coarse pair rather than accepting one — a
browser that sent both could otherwise put the public dot anywhere it liked
while keeping a real exact point behind the paywall.

`photos/map.ts`, the one crossing point between rows and payloads, names no
`precise_` column at all.

### I16 — retired with the feature it guarded

*Was: a coordinate reaches a third party only blunted, and only on purpose.*

The photographer's hint — a typed phrase and an optionally pointed-at area
sent alongside "Suggest details" — was the one place a coordinate travelled
*outward*, and I16 held it to two conditions: blunted inside `readHint`, the
only path from a request body to a prompt; and existing only when somebody
typed or clicked one. The feature is gone (it read as a second location field
on a form that already had one, and confused the first real user), and with
it went the request body itself: the suggest route no longer parses input at
all, so the prompt is built entirely from the stored display copy and EXIF.

That is a strictly smaller surface than the invariant used to defend. If a
hint-shaped feature ever returns, I16 returns with it — the retired tests sat
at the end of `security-location.test.ts`, where a note now points back to
the commit that removed both.

## 4. What follows from all this

Two habits, which matter more than the individual rules:

**When a class of bug is found, sweep for its siblings immediately.** Both
repeats in this codebase — the second Stripe cast, the second GET-mutation —
were found by someone else, days later, after the first was fixed. The cost
of asking "where else?" is minutes.

**A comment describing a control is not the control.** Three of the worst
defects sat directly beneath accurate prose explaining the attack they were
supposed to prevent. Prose is not executable and does not fail.

**A test that has never failed is indistinguishable from one that cannot.**
Write it, then break the thing it protects and watch it go red. This is the
cheapest habit here and it caught the most: two checks written this evening
were structurally incapable of failing, and both were written carefully by
somebody paying attention. One matched `.ts`, `.tsx` and `.mjs` while every
script it was meant to guard is `.mts`, so it covered nothing and reported
success. Being careful does not detect this. Breaking it on purpose does, in
about thirty seconds.

The same habit is why the invariants below can be trusted: each was verified
by reinstating the original bug — the old `blobIsClaimed`, a leaked paid
column, a bulk write with its authorization removed — and confirming the
suite went red before putting it back.

**A rule enforced over part of its domain reads as enforced, which is worse
than no rule — because it stops you looking.** This is the one that cost the
most. I1 was written as a test, went green, and a third GET-mutation lived in
`/subscribe/confirm` for the whole time it was passing: the check only read
`route.ts` files, and a page render is a GET too. The test existed, named the
right rule, and could not see the violation.

Auditing the rest of the file for that shape found two more. I11 says
endpoints that spend money *or send mail* are limited and only checked the
two Stripe routes. I6 checked one query constant, so a new public query
naming the paid columns would have passed in silence. Neither was violated
at the time — but nothing was holding them.

The check on a new invariant is therefore not "does it pass" but **"what
does it not look at, and is that the same thing the rule claims to cover?"**
Writing the widened I6 immediately caught a file I had missed while
listing them by hand, which is the whole argument for enforcing a rule over
its stated domain rather than the part you happened to think of.

---

## 5. Remaining work

Tracked against the invariants above. Status is updated as each lands.

| # | Item | Invariant | Status |
| --- | --- | --- | --- |
| 1 | Stripe event ordering guard | I10 | **done** — `last_event_at`, monotonic `WHERE` on both writers |
| 2 | Pin `apiVersion` | I8 | **done** |
| 3 | Rate limit checkout and portal | I11 | **done** — `stripeLimiter`, 429 |
| 4 | Move sign-in email off the request path | I12 | **done** — `after()` |
| 5 | Anonymous duplicate subscriptions, uncancellable | I4 | **done** — a refused payment is cancelled, not kept |
| 6 | `paused` missing from `LIVE_STATUSES` | — | **done** |
| 7 | Refunds and disputes unhandled | — | **done** — `charge.dispute.created` ends access now |
| 8 | `memberExists` enrols an address permanently | I4 | open — low value to an attacker; links still go to the real inbox |
| 9 | Swallowed query errors cache 404s for an hour | — | **done** — `listGalleryImages` throws, `getGalleryImages` forgives |
| 10 | Member view counting is fire-and-forget | — | **done** — `after()` |
| 11 | `/photo/[id]` serialises the whole gallery | — | open — inherent to a shared link opening a browsable viewer; fine at this size, revisit past ~200 photographs |
| 12 | Sitemap counts drafts | — | **done** — separate `published_count` |
| 13 | No session pruning | — | **done** — pruned alongside login tokens |
| 14 | `/api/photo/[id]/details` unlimited | I11 | **done** — `memberDetailsLimiter`, 120 per 15 min, keyed by member. Tolerable while the response was prose; a coordinate set is worth collecting |
| 15 | No index behind the globe query | — | open — `photos_globe_idx` when the table justifies it; see `next-version.md` |

## 6. How these are enforced

`src/lib/security.test.ts`, `src/lib/security-interface.test.ts` and
`src/lib/security-location.test.ts` assert the invariants against the source,
in the same spirit as `schema.test.ts` — properties about *shape* ("this column is
never selected here", "this handler is not a GET") that a behavioural test
could not check without a database, a Stripe account and a mail provider.

Each one was verified to fail when its invariant is violated, by
reintroducing the original bug and watching the test go red. A test that has
never failed is not yet a test.

Behaviour is covered where it can be: `stripe.test.ts` pins both shapes of
each moved Stripe field, and `scripts/smoke-membership.mts` drives the real
webhook through forgery, replay, dunning, takeover and out-of-order
delivery — twenty checks against real signatures.
