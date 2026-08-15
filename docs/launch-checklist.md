# Launch checklist

For sending the site to friends. Ordered by what breaks if you skip it,
checked against the live Vercel project and Stripe account on 15 August 2026.

The gallery itself works right now — anyone with the link can look at every
photograph, on any device. Everything below is about the things that involve
a person doing something other than looking.

---

## 1. Blocks a soft launch

### Verify a domain in Resend

**Nothing can email anyone.** The API key works, but `jomaendle.com` is not
verified, so Resend refuses every send except to the account's own address.
That silently breaks:

- signing in (contributors *and* members — the magic link never arrives)
- the subscribe confirmation, so nobody can ever join the list
- the "you're in" mail when you approve an applicant

Verify `thebeautyof.earth` at <https://resend.com/domains> — preferably that
rather than `jomaendle.com`, so the mail comes from the site people think
they are dealing with — then set `EMAIL_FROM` to an address on it.

### Set `EMAIL_FROM` on Vercel

It exists nowhere on the project. `RESEND_API_KEY` alone is not enough:
both are required, and **since the fail-closed change, production now
throws rather than pretending to send.** That is deliberate — the previous
behaviour wrote live sign-in tokens into the platform log and told people to
check an empty inbox — but it does mean sign-in is hard-down until this is
set.

```bash
vercel env add EMAIL_FROM production
```

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
without you pressing Send on `/contribute/admin`.

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
