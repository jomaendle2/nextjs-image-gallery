# How this site is put together

One repository, one Next.js application, and a short list of third parties.
This is what each part is responsible for and where it is configured.
[Setup](../operations/setup.md) covers installing and running it;
[the runbook](../operations/runbook.md) covers operating it.

---

## The application

Everything in `src/app`. Routes are folders; a `page.tsx` is a page and a
`route.ts` is an HTTP endpoint. Almost every page is a **server component**,
which means it runs on the server, talks to the database directly, and ships
no JavaScript for that work. The `"use client"` files are the ones that need
a browser: the carousel, the upload form, the globe, the two buttons that
redirect to Stripe.

The important structural decision: **the gallery is statically cached and the
member gate is not part of it.** A photograph's page is the same HTML for
everybody, and the paid fields arrive later by a separate authenticated
request. This is why the site is fast for anonymous readers and why the paid
content cannot leak — it is never in the page to begin with. Invariant I6 in
[security.md](security.md) is that rule, as a test.

## The services

### Vercel — hosting, files, and the clock

- **Hosting.** Every push to `main` deploys. Branches get preview URLs.
- **Blob storage** (`BLOB_READ_WRITE_TOKEN`) holds the photographs. Each
  upload is stored twice: the untouched original, and a re-encoded display
  copy that the gallery actually serves. The display copy carries no
  metadata, which is what keeps camera GPS out of the public file.
- **Cron** (`vercel.json`) calls `/api/cron/announce-reminder` at 09:00 every
  Monday. It sends nothing to anybody — it emails *you* if there are
  published photographs the mailing list has not been told about.

### Neon — the database

Postgres. The connection string is `DATABASE_URL`.

Schema lives in `src/lib/schema.ts` as a **list of additive, idempotent
statements**, not a migration folder. `npm run db:migrate` applies them all;
running it again does nothing. **Every deployment applies them too** —
`vercel-build` runs the migration before the build, so shipping code brings
its schema with it rather than waiting for somebody to remember.
`src/lib/schema.test.ts` fails the build if you add a statement that is not
safely re-runnable, which is the thing standing between this project and a
migration that half-applies in production.

The nine tables and what each holds are in [data-model.md](data-model.md).

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

`RESEND_API_KEY` plus `EMAIL_FROM` (a verified sender on your domain).
**Both are required.** In development a missing one prints the message to the
terminal, which is how you read a sign-in link locally. In production it
*throws*: printing would put live tokens in the platform log while telling
somebody to check an empty inbox.

Every template is in `src/lib/auth/email.ts`, and every value interpolated
into one is HTML-escaped, because contributors type titles and captions.

| Function | Sent when |
| --- | --- |
| `sendLoginEmail` | Somebody asks for a sign-in link |
| `sendInvitation` | You or a contributor invites a photographer |
| `sendApplicationApproved` | An application on `/contribute/apply` is accepted |
| `sendApplicationDeclined` | …or declined |
| `sendMembershipWelcome` | Stripe confirms a first payment |
| `sendSubscribeConfirmation` | Somebody asks to join the mailing list |
| `sendSubscribeWelcome` | …and confirms it |
| `sendNewWorkAnnouncement` | You press Announce |
| `sendAnnouncementReminder` | The Monday cron finds unannounced work |

`docs.test.ts` holds this list to `email.ts`: adding a template and not the
row fails the suite.

### The rest

Three more third parties, none of which the gallery could not run without.
`PROCESSORS` in `src/lib/legal.ts` is the authoritative list — the privacy
page renders from it, so it is the one place worth changing.

- **MapTiler** serves the tiles behind the location picker, on the
  photographer's upload page only. Invariant I14 keeps it there.
- **The Vercel AI Gateway** (Anthropic, then Google) answers "Suggest
  details" on a draft. It is sent the display copy, the camera settings and
  the location the photographer typed — never the original file, never a
  coordinate.
- **Plausible** counts page views. No cookies, nothing that identifies
  anybody.

---

## One reading of the environment

`VERCEL_ENV` is read in exactly one module, `src/lib/deployment.ts`, and
`src/lib/deployment.test.ts` asserts that it stays that way. It reports
`"production"` only on the live deployment; a preview reports `"preview"`,
`vercel dev` reports `"development"`, and anything else — `npm run dev`, a
test, an operational script — reports nothing at all.

That last distinction is load-bearing rather than pedantic: `scripts/migrate.mts`
runs the schema on a local machine (nothing) and on production, and refuses on
a preview, so collapsing "no Vercel" into "development" would start migrating
from `vercel dev`.

## Things that will bite you

- **View counts do not move outside production, and that is deliberate.** A
  photograph you keep reloading locally will show the real total and never
  increase it. See `image_views` in [data-model.md](data-model.md).
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
- **A real checkout in the browser needs `stripe listen` running.** Without
  it the payment completes, no event reaches your machine, and the member
  row is never written — which looks exactly like a bug in the code. The
  smoke tests do not need it; they sign their own events.
- **`EMAIL_FROM` is as necessary as the API key**, and in production its
  absence *throws* rather than printing to the log. It used to fail
  silently, which meant live sign-in tokens written into the platform logs
  while the person was told to check an empty inbox. The production build
  refuses to start without it for the same reason.

---

## Where the reasoning lives

- [security.md](security.md) — the invariants, each traced to a real defect.
- [data-model.md](data-model.md) — the tables, and what guards each.
- [toolchain.md](toolchain.md) — why the linter is configured the way it is.
- [../../DESIGN.md](../../DESIGN.md) — the design system.
- `src/lib/legal.ts` — operator details behind the three legal pages.
- The commit history, for anything older than this tree. Each invariant in
  [security.md](security.md) names the defect that produced it, which is the
  half worth keeping.
