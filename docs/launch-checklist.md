# Launch checklist

For sending the site to friends. Ordered by what breaks if you skip it,
checked against the live Vercel project and Stripe account on 15 August 2026.

The gallery itself works right now — anyone with the link can look at every
photograph, on any device. Everything below is about the things that involve
a person doing something other than looking.

---

## 0. Merge, before anything else

**Production is not this product yet.** `main` has one page — the gallery
viewer. `/contribute`, `/membership`, `/photographers`, `/subscribe` and the
three legal pages exist only on `worktree-going-big`, and every one of them
404s on www.thebeautyof.earth right now. Checked against the live site, not
inferred: 1 route on main, 17 on the branch, 190 files changed.

So nothing below can be tested in production, and no tester can be invited,
until PR #11 is merged and deployed. Everything verified so far was verified
on localhost and on preview deployments, which run the branch.

That is also the moment the environment variables start mattering: a preview
build reads its own set, and production has never run this code with them.
Merge first, then work down this list against the real site.

---

## 1. Blocks a soft launch

### Verify a domain in Resend

**Nothing can email anyone.** The API key works, but `jomaendle.com` is not
verified, so Resend refuses every send except to the account's own address.
That silently breaks:

- signing in (contributors *and* members — the magic link never arrives)
- the subscribe confirmation, so nobody can ever join the list
- the "you're in" mail when you approve an applicant

`thebeautyof.earth` has been added to Resend and is **pending** — the DKIM
record is still propagating through GoDaddy. Nothing can send until it
flips to Verified. Check at <https://resend.com/domains>; it usually takes
minutes rather than the hours the warning suggests, but it is DNS, so it
cannot be hurried.

The other domains on the account (`links.jomaendle.com`,
`immokaepsele.de`, `updates.mycvs.xyz`) are verified and would work today
if you needed to test sooner.

### ~~Set `EMAIL_FROM` on Vercel~~ — done

Set on Preview and Production. Note that **env changes do not reach an
already-built deployment**: Vercel injects the variable set at build time,
so anything deployed before you added it still has the old environment.
Push or redeploy after changing one.

### Fill in the operator address

`src/lib/legal.ts` — `street` and `city` are empty, so `/imprint`,
`/privacy` and `/terms` each render a visible amber "Unfinished" banner that
your friends will see. It is also required by §5 DDG before taking money.

Confirm two other fields while you are there: `kleinunternehmer: true` (no
VAT shown) and `vatId: ""`.

---

## 2. Blocks selling anything

Membership currently shows **"Not open yet"** in production, because
`STRIPE_MEMBERSHIP_PRICE_ID` is not set there. That is a reasonable state
for a soft launch — the gallery, the feeds and the mailing list are the
things worth kickstarting first, and nothing about the page misleads anyone
while it is off.

When you do want it on:

| Step | Why |
| --- | --- |
| `vercel env add STRIPE_MEMBERSHIP_PRICE_ID production` | Otherwise the page hides the offer |
| Register the webhook at `https://<domain>/api/stripe/webhook` | **Zero endpoints are registered today**, so no payment would ever be recorded |
| `vercel env add STRIPE_WEBHOOK_SECRET production` | Without it the route refuses every event, by design |
| Confirm the endpoint's API version matches `API_VERSION` in `src/lib/stripe.ts` | Payload shapes differ between versions; two silent bugs lived on this seam |
| Swap to live keys, then re-run `scripts/setup-billing-portal.mts` | The portal is configured per mode; test-mode config does not carry over |

Stripe is in **test mode** right now. Friends cannot really pay, and card
`4242 4242 4242 4242` will work for anyone who tries — so either finish this
list or leave the price id unset.

---

## 3. Blocks the weekly announcement

`CRON_SECRET` is not set on Vercel, so `/api/cron/announce-reminder` refuses
to run — correctly, since without it the route would be a public way to ring
your inbox. Generate one and add it to production; `vercel.json` already
schedules the Monday 09:00 call.

Note that the cron only *reminds* you. Nothing is ever mailed to the list
without you pressing the button on `/contribute/admin`.

**Your first announcement will contain all sixteen existing photographs.**
Nothing has ever been announced, so `announced_at` is null on every row and
the first send is a catch-up rather than a new-work notice. That is the
intended behaviour and probably what you want for a first mailing — but the
subject line will say sixteen, and the body lists twelve with "and four
more", so it is worth knowing before you press it rather than after. If you
would rather the first send only covered work published *after* launch, mark
the existing rows announced first:

```sql
UPDATE photos SET announced_at = now() WHERE published_at IS NOT NULL;
```

---

## 4. Worth doing before you share, not blocking

- **`SITE_URL`** — falls back to `VERCEL_PROJECT_PRODUCTION_URL`, which is
  correct but ugly in the links inside emails.
- **Invite one or two photographers first.** The gallery reads as a
  community rather than a personal portfolio the moment a second name
  appears, and `/photographers` is the page that says so.
- **Check the announcement renders in a real client** —
  `scripts/smoke-email.mts` sends all six templates to an address you name.

---

## 5. What to expect the first week

The parts most likely to surprise you, all deliberate:

- **Signing in takes an extra click.** The magic link opens a page with a
  "Sign in" button rather than signing you in on arrival. Corporate mail
  scanners follow every link in an inbound message; without the button they
  spend the single-use token before the recipient touches it, and the real
  click lands on "expired". The same is true of the unsubscribe link.
- **A new member has to sign in after paying.** Checkout takes an address,
  the webhook records the payment, and the link sent to that address is what
  unlocks it. `/membership?welcome=1` says so explicitly.
- **The first announcement is manual.** By design — see §3.


---

## 6. Verified working, as of 16 August

Driven end to end against the real database and the real services, not
inferred:

- **Sign in** — magic link minted, redeemed through the button, session
  established, lands on the dashboard. Single-use holds; a link scanner's
  GET no longer spends it.
- **Upload** — a real file through the real form: row created, both blobs
  written, thumbnail rendered, new photograph correctly badged *Draft*.
- **Membership** — 20 checks against real Stripe signatures covering
  forgery, replay, dunning, out-of-order delivery and row takeover; 7 more
  for the billing portal.
- **Email** — all six templates delivered through Resend to a real inbox.
- **Legal pages, navigation, mobile layout** — every route 200, no
  horizontal scroll at 390px, no console errors.

## 7. What five test users will actually hit

In the order they will hit it:

1. **An invitation email** — blocked on the domain above. Nothing else in
   the flow works until this does.
2. **Sign in** — works, and takes one extra button press by design.
3. **Upload and publish** — works. The dashboard now collapses each
   photograph to a scannable row with search and status filters, so it
   stays usable as they add more.
4. **Their public page** — `/by/<slug>`, linked from the dashboard.
5. **Membership** — deliberately off in production. Nothing misleads
   anybody while it is hidden.
