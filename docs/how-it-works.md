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
- **Cron** also calls `/api/cron/nudge-contributors` at 09:00 every day. This
  one does mail photographers: whoever was invited and has published nothing.
  Two sequences — six messages over three months for an empty page, three for
  a stalled draft — and every stop condition is checked at send time, so
  uploading or publishing ends the sequence mid-flight. Each stage is claimed
  in `contributor_nudges` before it is sent, so a retried run sends nothing.
  Both routes want `CRON_SECRET`; without it they answer 500 rather than
  running unauthenticated.

  Read what it *would* do before it does it:

  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" \
    'https://<domain>/api/cron/nudge-contributors?dry=1'
  ```

  The dry run computes the identical plan and claims nothing.

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

Eleven templates in `src/lib/auth/email.ts`: sign-in link, invitation,
application approved, application declined, membership welcome, subscribe
confirmation, subscribe welcome, new-work announcement, the weekly reminder to
you, and the two nudges to photographers who were invited and have not
published — one for an empty page, one for a stalled draft. Every value
interpolated into one is HTML-escaped, because contributors type titles and
captions.

The transport itself is `src/lib/auth/mailer.ts`: the provider call, the
escaping, and the shell an HTML body is wrapped in. The templates say what
each message *is*; that file is how any of them leaves the building. Nudge
copy lives apart again, in `src/lib/auth/nudge-copy.ts`, so its wording can be
tested without a mail provider — the arrangement `src/lib/announcement.ts`
already uses.

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

The link works **once** and expires after an hour — but *opening* it
does not spend it. The page it lands on has a Sign in button, and only
pressing that redeems the token, so a mail scanner or a link preview cannot
burn it before you get there.

What the owner can do that a contributor cannot: see and moderate everybody's
photographs, invite contributors, review applications, and send the
announcement.

### Make somebody a contributor

Three doors, and all three end at `inviteContributor`/`claimInvite` in
`src/lib/auth/contributors.ts` — the only file in `src/` that inserts a
contributor, which is asserted by a test so it stays that way.

1. **You invite them.** `/contribute/admin` → invite by email address. No
   quota; you can invite as many people as you like.
2. **They apply.** `/contribute/apply` submissions appear on the same page,
   and approving one sends its own message.
3. **A photographer invites them.** Every contributor has **three
   invitations, ever**, spent from `/contribute/invite`. Whoever they bring
   in becomes a contributor immediately and gets three of their own.

All three send an invitation email automatically, telling the recipient
where to sign in and that nothing happens until they do. A peer invitation
names the photographer who sent it, because an unsolicited "you have been
chosen" from nobody in particular reads as spam. If a send fails the panel
says so, so you know to follow up by hand rather than assuming it went out.

**What to watch.** The People list on `/contribute/admin` shows who invited
whom and how many invitations each person has left. Nothing about this is
public — a photographer's page never says who brought them in. Revoke is
the control if an invitation turns out badly; it takes effect immediately
and deletes their sessions.

Invites compound: three each, and their invitees get three too. That is
deliberate, and it is the thing to keep an eye on as the gallery grows.

### Publish a photograph

`/contribute/photos` → upload → open a row → fill in the fields → publish.
Three of those are members-only: `precise_location`, `technique`, and the
exact point if the photographer marks one on the map. All are optional and
empty by default, and nothing is read from the file — a marked point is a
decision somebody makes afterwards, exactly like typing a sentence.

Marking a point stores it twice: the exact position, which only members see,
and the centre of a cell about 1 km across, which is public and is what
`/globe` draws. The picker shows both before the save. A photographer whose
subject should not be findable can publish the blurred dot only, which
discards the exact point rather than storing it.

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

With the dev server running:

```bash
npm run smoke
```

Four paths, with no setup and nothing left behind: every page renders,
ingest works, the attacker's side of the membership holds, and the member's
side works. Individually: `smoke:pages`, `smoke:upload`, `smoke:membership`,
`smoke:portal`.

`smoke:pages` is the shallow one and the one most likely to save you. Until
it existed nothing in the suite rendered a page at all, so a server
component that threw — a bad import, an unguarded null — left the tests
green and the site broken.

None of them needs `stripe listen`: the membership checks sign their own
events with `STRIPE_WEBHOOK_SECRET` and post straight to the local endpoint,
which is the same code path Stripe drives including the signature check. A
tunnel is only for the different job of clicking through a real checkout in
a browser and having Stripe's servers reach your machine.

```bash
# Once per Stripe mode — test now, live before launch.
npm run stripe:portal-setup

# Every email template, sent for real if a key is set. The address is
# required rather than defaulted, because this one really does send.
npm run smoke:email -- you@example.com
```

Prefer the `npm run` names over hand-written `node` lines: each script needs
a loader flag or two that are easy to omit, and whether omitting one breaks
depends on a transitive import several files away. `docs.test.ts` also
checks that every `npm run` name in this documentation exists, which it
cannot do for a command line typed into prose.

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
- **A real checkout in the browser needs `stripe listen` running.** Without
  it the payment completes, no event reaches your machine, and the member
  row is never written — which looks exactly like a bug in the code. The
  smoke tests do not need it; they sign their own events.
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
