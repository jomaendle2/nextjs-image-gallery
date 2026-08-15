# Security review — payments, membership and the paid content

Reviewed 15 August 2026, against the state of `worktree-going-big` at the
commit this document lands in. Scope: everything that decides who has paid,
what paying buys, and who may spend money. The wider site (uploads, magic-link
auth, headers, feeds) was reviewed in earlier passes and is recorded in
`quality-audit.md`; this covers the membership built on top of it.

The review was done by reading every route that touches Stripe or member
content, and by running `scripts/smoke-membership.mts`, which drives the real
webhook with real signatures. Findings that could be turned into a test were.

## The threat model, briefly

Three things are worth attacking here:

1. **Granting yourself a membership** without paying.
2. **Reading paid content** — precise locations — without a membership.
3. **Spending or reading someone else's money**: their card, their invoices,
   their subscription.

Everything below is organised around those.

## What holds

**Membership is only ever written by a signed Stripe event.**
`src/app/api/stripe/webhook/route.ts` verifies the signature against the raw
request bytes before anything parses them, and returns 400 otherwise. No
success page, redirect, or client call writes the `members` table — checked by
grep, and asserted by the smoke test, which posts a forged event and then
confirms nothing was written. This is the answer to attack (1): the redirect
target `/membership?welcome=1` is guessable, and guessing it grants nothing.

**Paid content is never sent to a non-member.** `precise_location` and
`technique` are absent from `FEED_COLUMNS`, so they are not in the payload of
any page — there is nothing to reveal by opening view-source or disabling
JavaScript. The single reader is `getMemberDetails`, called only by
`/api/photo/[id]/details`, which checks `getCurrentMember()` first and returns
403 with no photograph data. The smoke test asserts both the refusal and that
the refusal body leaks neither field. This is attack (2), and the gate is
server-side by construction rather than by discipline: deleting the client
component would not expose anything.

**Checkout cannot be pointed at another address.** The email comes from the
session, never the request, and is passed to Stripe as fixed. An anonymous
POST gets 401.

**The webhook is idempotent and order-independent.** `upsertMember` is an
`ON CONFLICT ... DO UPDATE`, so redelivery — which Stripe does on every
non-2xx — writes the same row. Asserted by replaying an event and counting
rows. Handler failures return 500 so Stripe retries rather than silently
dropping somebody's access.

**Dunning follows Stripe's rules, not invented ones.** `invoice.payment_failed`
re-reads the subscription and stores the status Stripe derived, so access
tracks the real dunning state.

## What was wrong, and is now fixed

### 1. The period end was never recorded — silently

`current_period_end` moved off `Stripe.Subscription` and onto its items. The
code read it from the subscription through an `as unknown as` cast, which
compiles, returns `undefined` at runtime, and stored **NULL for every member
that has ever existed**.

Nothing looked broken, because `isActive` treats a null period end as "no
expiry recorded" and falls back to the status — which is correct in the
ordinary case, since a lapsed subscription gets a `deleted` event. But the
period end was documented as the honest boundary and was in fact never
populated, so a single missed or mishandled `customer.subscription.deleted`
would have meant **access with no end date at all**.

Fixed by `subscriptionPeriodEnd()` in `src/lib/stripe.ts`, which reads the
items and keeps the old top-level read as a fallback for accounts pinned to an
earlier API version. Covered by unit tests and by a smoke-test assertion
driving a correctly-shaped webhook.

The general lesson, worth remembering: **`as unknown as` around a third-party
type is a runtime assumption wearing a compile-time disguise.** It was used
here precisely because the type no longer had the field — which was the
library telling us the truth, and being overruled.

### 2. A trialing or past-due member could be charged twice

Checkout refused a second subscription only when `status === "active"`. But
`isActive` also grants access to `trialing`, and — more expensively —
`past_due` means Stripe is still retrying a card that will eventually clear.
Either could start a second subscription and be billed twice for the same
month.

Fixed by `hasLiveSubscription`, which is deliberately **wider** than
`isActive`. The two now ask different questions on purpose: *are they
entitled to content* and *are they already being billed*. `past_due` answers
no and yes. There is a test asserting exactly that divergence, because a
future reader's instinct will be to collapse them into one predicate.

### 3. Paid content had no cache directive

`/api/photo/[id]/details` returned member content with no `Cache-Control`.
Vercel does not cache route handlers by default, so nothing was leaking — but
the correctness of the gate depended on a platform default rather than on
anything stated in the response. Now `private, no-store`.

### 4. Access rules could not be tested without a database

`isActive` lived in a module that opens a Postgres connection at import, so
the rule deciding who sees paid content could only be exercised with a live
database — which is why it had no unit tests. Moved to
`src/lib/members/status.ts`, which imports nothing. Ten tests followed
immediately, and they caught nothing, which is the point: they are there for
the next change.

## Second pass: what a fresh reviewer found

A later independent review found eight more, which says something about the
first pass: I reviewed the code I had just written, and the two worst
findings were in the parts I was most confident about.

**The same mistake twice, in the same file.** `invoice.subscription` no
longer exists — it is `invoice.parent.subscription_details.subscription` —
and an `as unknown as` cast let the old read compile. Both invoice branches
resolved `undefined` and did nothing, so a failed renewal never reached the
member row. This is exactly the `current_period_end` bug found an hour
earlier, in the same file, and I did not go looking for siblings after
fixing the first one. **The lesson worth keeping: when a cast around a
third-party type turns out to hide a moved field, every other cast in that
file is a suspect.** Both are now in `src/lib/stripe.ts` with unit tests.

**My own smoke test was reassuring rather than useful.** It asserted "a
failed payment is recorded as past_due" and passed throughout — because it
sent a `customer.subscription.updated`, and real dunning sends an invoice
event. A test that never exercises the shape production sends is not
covering the thing its name claims.

Also fixed: `incomplete` in `LIVE_STATUSES` locked a declined buyer out of
retrying for a day; deletion revalidated the actor's page rather than the
author's; deletion orphaned the display blob permanently; the image
optimizer accepted any tenant's blob store; the OG endpoint bounded its
title but not its subtitle.

Two that were about people rather than code:

- **The unsubscribe link deleted on GET.** Corporate link scanners fetch
  every URL in inbound mail, so the first announcement to anybody behind
  SafeLinks would have unsubscribed them before they read it, with the token
  spent. Now a POST, which scanners do not issue — and still one click,
  because a confirmation step would be a dark pattern with a polite face.
- **Missing mail config failed open in production**, printing live
  magic-link tokens into the platform log — each a valid credential for
  fifteen minutes — while telling people to check an inbox nothing had been
  sent to. Now a hard failure outside development.

## Added: the customer portal

`/api/stripe/portal` mints a Stripe-hosted billing session. Two properties
matter for attack (3):

- **The customer id comes from our row for the signed-in address, never from
  the request.** Accepting a `cus_` id from the client would let any member
  read any other member's invoices and cards by guessing. This is the whole
  security surface of the route, and the smoke test asserts the anonymous
  case returns 401 with no URL.
- **The route never cancels anything itself.** It hands out a scoped link and
  stops; the resulting cancellation comes back as a signed webhook like any
  other. There is still exactly one writer of `members`.

The portal is offered to anyone with a billing row rather than only to active
members — someone whose card is failing has no access and the most urgent
reason of anyone to reach it.

## Open, with reasons

**Rate limiting on `/api/stripe/checkout` and `/api/stripe/portal`.** Both
require a session, and each call creates a Stripe object. A signed-in user
could loop them and litter the account. Not exploitable for money or data,
and `src/lib/rate-limit.ts` already exists — this is a small piece of work
rather than a decision, and it is the first thing I would add next.

**`members_customer_idx` is UNIQUE on `stripe_customer_id`.** If a customer id
were ever associated with a second email — an address changed in the Stripe
dashboard, say — the upsert would violate the constraint, return 500, and
Stripe would retry that event forever. Correct as a data-integrity rule, but
it converts an unusual admin action into a stuck webhook. Worth a deliberate
`ON CONFLICT` on that index if the membership grows.

**No API version pinned on the Stripe client.** `new Stripe(key)` uses the
account's default version. Finding (1) is exactly what that costs: a field
moved and the code kept compiling. Pinning an explicit `apiVersion` would turn
the next such move into a visible break instead of a silent null.

**~~There is no privacy policy, terms, or Impressum.~~** Written — `/imprint`,
`/privacy`, `/terms`, linked from the footer of every page that scrolls and
so two clicks from any viewer. **Still incomplete**: the operator's postal
address is blank in `src/lib/legal.ts`, and until it is filled in the pages
render a visible warning and §5 DDG is not met. An invented address would be
a false statement of identity on a legal notice, so the gap is loud rather
than papered over.

**Original uploads keep their GPS, in public blob storage.** The *displayed*
image is a fresh sharp re-encode with no metadata, and the GPS block is never
parsed into the database, so nothing on the site reveals a location. But the
untouched original is stored with `access: "public"`, and it still contains
whatever the camera wrote. Its URL carries a random suffix and is never sent
to a client — `FEED_COLUMNS` selects `COALESCE(display_url, blob_url)`, so
the original is only reachable by someone who already knows the URL. Low risk
and worth closing anyway: private blob storage for originals would remove the
question entirely, on a site whose central promise is that it does not record
where anybody stood.

**Stripe Tax is not enabled.** Selling a digital subscription from Germany
into the EU and the US has VAT/OSS consequences that are not mine to assume.
This is a decision for the account owner, not a code change, and it is the one
item on this list that has a legal rather than a technical deadline.

## Reproducing this

```bash
# Once per Stripe mode — test today, live before launch.
node --env-file=.env.local scripts/setup-billing-portal.mts

stripe listen --forward-to localhost:3000/api/stripe/webhook
node --env-file=.env.local scripts/smoke-membership.mts   # the attacker's side
node --env-file=.env.local scripts/smoke-portal.mts       # the member's side
```

Twenty-three checks across the two. `smoke-membership` covers signature
forgery, replay, dunning, cancellation, the anonymous refusal of all three
protected routes, and the period-end regression. `smoke-portal` drives a real
Stripe customer through a real session cookie and covers the paid content
being served, the no-store header, the refusal of a second subscription, and
the case the two predicates exist for: a past-due member losing the content
while keeping the portal. All passing at the time of writing.
