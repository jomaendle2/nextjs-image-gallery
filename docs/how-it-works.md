# How this site works

Five services, one repository. This is the map: what each part is
responsible for, where it is configured, and what to do when you need to
touch it. `README.md` covers installing and running; this covers operating.

---

## The five parts, in one paragraph each

### Next.js 16 — the site itself

Everything in `src/app`. Routes are folders; a `page.tsx` is a page and a
`route.ts` is an HTTP endpoint. Almost every page is a **server component**,
which means it runs on the server, talks to the database directly, and ships
no JavaScript for that work. The handful of `"use client"` files are the
ones that need a browser: the carousel, the upload form, the two buttons that
redirect to Stripe.

The important structural decision: **the gallery is statically cached and the
member gate is not part of it.** A photograph's page is the same HTML for
everybody, and the paid fields arrive later by a separate authenticated
request. This is why the site is fast for anonymous readers and why the paid
content cannot leak — it is never in the page to begin with.

### Vercel — hosting, files, and the clock

Three things:

- **Hosting.** Every push to `main` deploys. Branches get preview URLs.
- **Blob storage** (`BLOB_READ_WRITE_TOKEN`) holds the photographs. Each
  upload is stored twice: the untouched original, and a re-encoded display
  copy that the gallery actually serves. The display copy carries no
  metadata, which is what keeps camera GPS out of the public file.
- **Cron** (`vercel.json`) calls `/api/cron/announce-reminder` at 09:00 every
  Monday. It does not send anything to anybody — it emails *you* if there are
  published photographs the mailing list has not been told about.

### Neon — the database

Postgres. The connection string is `DATABASE_URL`.

Schema lives in `src/lib/schema.ts` as a **list of additive, idempotent
statements**, not a migration folder. Running `npm run db:migrate` applies
them all; running it again does nothing. **Every deployment applies them
too** — `vercel-build` runs the migration before the build, so shipping code
brings its schema with it rather than waiting for somebody to remember. There is a test
(`schema.test.ts`) that fails the build if you add a statement that is not
safely re-runnable, which is the thing standing between this project and a
migration that half-applies in production.

Tables worth knowing: `photos`, `contributors`, `sessions`, `login_tokens`,
`applications`, `subscribers`, `members`, `photo_member_views`.

### Stripe — payments

Test and live keys in `STRIPE_SECRET_KEY`. One product, one price
(`STRIPE_MEMBERSHIP_PRICE_ID`), €5/month.

Three routes, and the split between them is the whole security model:

| Route | Does | Trusts |
| --- | --- | --- |
| `/api/stripe/checkout` | Mints a hosted checkout URL | Nothing — it only creates a link |
| `/api/stripe/webhook` | **Writes the `members` table** | Only a valid Stripe signature |
| `/api/stripe/portal` | Mints a billing-portal URL | The session cookie, for the customer id |

**Membership is only ever written by the webhook.** Returning from checkout
proves nothing — that URL is guessable — so the success page never grants
anything. This is why a new member sometimes has to reload once: the browser
comes back before Stripe's event does.

Card details never touch this site. Both Stripe interactions are redirects to
Stripe's own pages, which is also why there is no Stripe JavaScript anywhere
in the gallery.

### Resend — email

`RESEND_API_KEY` plus `EMAIL_FROM` (a verified sender on your domain —
currently `contact@thebeautyof.earth`). **Both are required.** In development
a missing one prints the message to the terminal, which is how you read a
sign-in link locally. In production it *throws*: printing would put live
tokens in the platform log while telling somebody to check an empty inbox.

Seven templates in `src/lib/auth/email.ts`: sign-in link, invitation,
application approved, subscribe confirmation, subscribe welcome, new-work
announcement, and the weekly reminder to you. Every value interpolated into one is HTML-escaped,
because contributors type titles and captions.

---

## How to do things

### Sign in as admin

1. Go to `/contribute`.
2. Enter the address on your `contributors` row with `role = 'owner'` —
   currently `maendle.johannes@gmail.com`.
3. Open the link that arrives. **Locally, with no `RESEND_API_KEY`, it is
   printed to your `next dev` terminal** rather than emailed.
4. You land on `/contribute/photos`. `/contribute/admin` is linked from
   there, and has a breadcrumb back.

**If the email never arrives**, mint a link directly:

```bash
npm run mint-link -- maendle.johannes@gmail.com
```

That is the break-glass path, and it exists for the case you are most likely
to meet: a mail provider outage, a domain falling out of verification, or a
wrong `EMAIL_FROM` — all of which lock you out of the admin page you would
need in order to fix them. It goes through the same `mintLoginToken` the
form uses, so the same rules apply.

The link works **once** and expires after fifteen minutes — but *opening* it
does not spend it. The page it lands on has a Sign in button, and only
pressing that redeems the token, so a mail scanner or a link preview cannot
burn it before you get there.

What the owner can do that a contributor cannot: see and moderate everybody's
photographs, invite contributors, review applications, and send the
announcement.

### Make somebody a contributor

`/contribute/admin` → invite by email address. **They receive an invitation
email automatically**, telling them where to sign in and that nothing happens
until they do. If the send fails the panel says so, so you know to follow up
by hand rather than assuming it went out.

Applications from `/contribute/apply` appear on the same page, and approving
one sends its own message.

### Publish a photograph

`/contribute/photos` → upload → open a row → fill in the fields → publish.
Two of those fields are members-only: `precise_location` and `technique`.
Both are optional and empty by default; nothing is read from the file.

Each photograph is a row that opens into its form, so the list stays
readable as it grows. Past four photographs a search box and a status filter
appear, and the checkboxes publish or unpublish several at once. Bulk delete is behind a
confirmation listing the titles rather than a count, because deleting takes
the stored file with it and a number cannot be checked against intent.

### Send the weekly announcement

`/contribute/admin` shows a count of published-but-unannounced photographs
and a button reading "Announce N". It marks them announced *before* sending: if the send dies
halfway, some people miss an announcement rather than some people getting two,
and the second is the one that loses trust.

The Monday cron only reminds you. Nothing goes out without you pressing it.

### Refund or cancel somebody's membership

From the Stripe dashboard. The webhook will pick it up and their access ends
on its own — do not edit the `members` table by hand, because Stripe's copy is
the one that counts and the next event will overwrite yours.

Members can cancel themselves from `/membership`.

---

## Testing it end to end

```bash
# 1. Webhooks need a tunnel in development.
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 2. Once per Stripe mode — test now, live before launch.
node --env-file=.env.local scripts/setup-billing-portal.mts

# 3. The attacker's side: forgery, replay, dunning, cancellation.
node --env-file=.env.local scripts/smoke-membership.mts

# 4. The member's side: real customer, real session, real cookie.
node --env-file=.env.local scripts/smoke-portal.mts

# 5. Every email template, sent for real if a key is set.
node --import ./scripts/alias-loader.mjs --env-file=.env.local \
  scripts/smoke-email.mts you@example.com
```

To buy a membership by hand: `/membership` → Become a member → card
`4242 4242 4242 4242`, any future expiry, any CVC. You do **not** need to be
signed in first — Stripe collects the address, and you sign in with it
afterwards to unlock what you bought.

---

## Things that will bite you

- **`vercel env pull` overwrites `.env.local` wholesale.** It has already
  destroyed `CRON_SECRET` once. Pull to a different file and merge.
- **Variables marked "sensitive" in Vercel cannot be pulled back** — they
  come down empty. Keep a copy where you set them.
- **`vercel env pull` defaults to the development environment.** A variable
  added only to Production will silently not appear.
- **A sign-in link is single-use, but a preview cannot spend it.** The link
  opens a page with a button; only pressing it redeems the token. That extra
  press exists because mail gateways fetch every URL in an inbound message,
  and a link that signed you in on arrival was spent before you touched it.
  The same is true of the unsubscribe and subscribe-confirmation links.
- **Local webhooks need `stripe listen` running.** Without it a checkout
  completes, no event arrives, and the member row is never written — which
  looks exactly like a bug in the code.
- **`EMAIL_FROM` is as necessary as the API key**, and in production its
  absence now *throws* rather than printing to the log. It used to fail
  silently, which meant live sign-in tokens written into the platform logs
  while the person was told to check an empty inbox. The production build
  refuses to start without it for the same reason.

---

## Where the reasoning lives

- `docs/security-review.md` — the payment path, what was wrong, what is open.
- `docs/quality-audit.md` — the running record of every audit pass.
- `docs/CONTRIBUTING-PHOTOS.md` — for photographers.
- `src/lib/legal.ts` — operator details behind the three legal pages.
