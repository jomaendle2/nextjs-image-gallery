# Launch checklist

For sending the site to friends. Checked against the live Vercel project,
Stripe account and Resend domain — every claim here was verified rather than
assumed, and struck through once done.

**The short version:**

```bash
vercel env ls production                # SITE_URL, EMAIL_FROM, RESEND_API_KEY, AI_GATEWAY_API_KEY: all set
vercel env add MAPTILER_KEY production  # else both maps are an "unavailable" notice
gh pr merge 11                          # preflight checks config, build applies schema
```

Everything below is why each of those matters and what is deliberately not
on the list.

The gallery itself works right now — anyone with the link can look at every
photograph, on any device. Everything below is about the things that involve
a person doing something other than looking.

---

## 0. What has to happen, in order

**Production is not this product yet.** `main` has one page — the gallery
viewer. `/contribute`, `/membership`, `/photographers`, `/subscribe` and the
three legal pages exist only on `worktree-going-big`, and every one of them
404s on www.thebeautyof.earth right now. Checked against the live site, not
inferred: 1 route on main, 17 on the branch, 190 files changed.

So nothing below can be tested in production, and no tester can be invited,
until PR #11 is merged and deployed. Everything verified so far was verified
on localhost and on preview deployments, which run the branch.

**Set the variables in §1 before you merge, not after.** The production
build refuses to run without `SITE_URL`, `EMAIL_FROM` and `RESEND_API_KEY`,
naming each one and the command to set it. That is deliberate — it stops a
deploy that would succeed and then email people links to the wrong domain —
but it does mean merging first gives you a failed build rather than a live
site. Preview and local builds are unaffected.

The schema is applied by the build itself now (`vercel-build` runs
`scripts/migrate.mts` before `next build`), so merging brings the database
with it. It did not before: migrations only ever ran when somebody typed
`npm run db:migrate` locally, which meant a deploy could ship code ahead of
the columns it queries. Every statement is additive and idempotent — enforced
by `schema.test.ts` — so running them on every build is safe by construction.

---

## 1. Blocks a soft launch

### ~~Verify a domain in Resend~~ — done

`thebeautyof.earth` is **verified**. All eleven templates were sent through
it to a real inbox: sign-in link, invitation, application approved,
application declined, membership welcome, subscribe confirmation, subscribe
welcome, new-work announcement, the weekly reminder, and the two nudges to
photographers who have not published — the empty page and the stalled draft.

Re-run any time with:

```bash
node --import ./scripts/alias-loader.mjs --env-file=.env.local \
  scripts/smoke-email.mts you@example.com
```

### ~~Set `EMAIL_FROM` on Vercel~~ — done

Set on Preview and Production. Note that **env changes do not reach an
already-built deployment**: Vercel injects the variable set at build time,
so anything deployed before you added it still has the old environment.
Push or redeploy after changing one.

### ~~Set `SITE_URL` to the domain you tell people about~~ — done

Set on Production two days ago, confirmed with `vercel env ls production`.
The rest of this entry is why it mattered, and why it must not be removed.
Remember that **an already-built deployment keeps the environment it was
built with** — the value reaches the site on the next build, which the merge
provides.

**Not cosmetic — every link this site emails is built from it.** With it
unset, `siteOrigin()` falls back to `VERCEL_PROJECT_PRODUCTION_URL`, and
production currently resolves that to **`https://images.jomaendle.com`**.
Checked, not assumed: that is the `og:url` in the live page's metadata right
now.

So an invitation would tell a photographer to sign in at
`images.jomaendle.com/contribute` — a domain they have never heard you
mention, in an unsolicited email offering them an account. That is
indistinguishable from a phishing attempt, and the people most likely to
notice are the careful ones.

It also decides the canonical URLs, the sitemap, both feeds, and every
unsubscribe link.

The origin deliberately never comes from the request `Host` header — see the
comment in `src/lib/site-url.ts` — so this cannot be inferred at runtime. It
has to be configured.

### ~~Fill in the operator address~~ — done

`src/lib/legal.ts` carries `street: "Im Hirschmorgen 12"` and
`city: "69181 Leimen"`, both pushed. `legalComplete()` therefore returns
true and the amber "Unfinished" banner no longer renders on `/imprint`,
`/privacy` or `/terms`. The other two fields are as this list asked for:
`kleinunternehmer: true` (no VAT shown) and `vatId: ""`.

### ~~Set `AI_GATEWAY_API_KEY`~~ — done

Set on Production and Preview. Checked with `vercel env ls production`
against `jomaes-projects/beauty-of-earth`, not assumed.

Worth keeping the reason it is on this list. Without it
`aiSuggestionsConfigured()` falls back to `VERCEL_OIDC_TOKEN`, which a
deployment is given automatically and which expires after hours — and when it
does, the "Suggest details" button simply stops being rendered. No error, no
500, nothing a photographer can report beyond "it used to be there".
`src/lib/ai/offer.ts` now logs one line in production naming which of the
three states it is in, so if this variable is ever removed the failure is
greppable instead of invisible. It is still deliberately **not** in
`scripts/preflight.mts`: a missing feature must not be able to fail a deploy
the way a missing `SITE_URL` should.

It is a spending credential, and the route's rate limit is per-instance and
in-memory — it bounds requests per instance, not cost. **Set a budget on the
gateway itself**, which is the only place that can bound spend. Still
outstanding, and not something the repository can do for you.

### Set `MAPTILER_KEY` — outstanding

**Not set in production.** `vercel env ls production` lists no such variable,
so on the live site `src/lib/maptiler.ts` returns nothing and the location
picker in the members-only section renders a plain "no map here" line instead
of a map.

It degrades honestly rather than breaking — coordinates can still be typed by
hand — so this does not block a merge. The key is read on the server and
passed down as a prop, never as `NEXT_PUBLIC_*`, so setting it does not put
it in a client bundle.

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

- **Invite one or two photographers first.** The gallery reads as a
  community rather than a personal portfolio the moment a second name
  appears, and `/photographers` is the page that says so.
- **Check the announcement renders in a real client** —
  `scripts/smoke-email.mts` sends all eleven templates to an address you name.

---

## 4a. Before the five invitations — operator actions

Everything in this section is a dashboard or a shell, not code. The code side
of each is already done.

### Take one backup, and write down the retention

`docs/next-version.md` says outright that no backup or restore story exists,
and migrations now run on every production build. One `pg_dump` is a
known-good floor that costs a minute:

```
pg_dump "$DATABASE_URL" --no-owner --no-privileges -Fc -f beauty-$(date +%F).dump
```

Keep it somewhere that is not Neon and not this repository. Restore is
`pg_restore -d "$TARGET_URL" beauty-YYYY-MM-DD.dump` against a **branch**,
never against production, and the point of writing that down is that nobody
reads a restore command for the first time during an incident.

Then read the actual point-in-time-recovery window in the Neon dashboard and
record it here, replacing this sentence — "Neon has PITR" is not a retention
policy, a number of days is. **Blobs are not covered by any of this.** Vercel
Blob has no snapshot, so a deleted blob is gone; that is the argument for
`--apply` on every destructive script rather than for a backup.

### Run destructive scripts against a branch, not production

Every `db:*` and `smoke:*` script loads `.env.local`, which points at
production. They now print the host and refuse without `--apply`:

```
npm run smoke:invite                 # prints the target, refuses
npm run smoke:invite -- --apply      # runs
```

Create a Neon branch, put its connection string in `.env.local`, and run them
there. The guard makes the target visible; it cannot choose it for you.

### Erasing somebody

`npm run db:erase-contributor -- someone@example.com` lists what would go and
changes nothing. Adding `--apply` deletes their photographs, both stored files
per photograph, their sessions and tokens, and their row — and tells you if
they held the opening photograph, which nothing reassigns automatically.

### Environment variables

- **Remove `STRIPE_MCP_KEY`** from production. It is a live Stripe credential
  that no code in `src/` or `scripts/` reads.
- **Add `CRON_SECRET`.** Without it the Monday reminder is a hard 500 — it
  fails closed, correctly, and does nothing.
- **Add `MAPTILER_KEY`** (see §1), or both map surfaces stay a plain line
  saying there is no map.

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

**These claims are older than the code.** They were verified on 16 August and
nothing in this section has been re-run since; the branch has taken the AI
suggestion feature, the site and workspace navs, the unsaved-work guard and
the typeface fix in the meantime (the place-hint half of the suggestion
feature has since been removed again). Treat the list as evidence that these paths
worked once, not as a statement about what is on the branch today.

What *has* been verified since, on the current tree: 480 tests pass,
`tsc --noEmit` is clean, `biome check src/` is clean, and `next build`
completes with no warnings — `/globe` and `/photographers` still prerender as
static, so the new nav added no client JavaScript to them. None of that
exercises a browser or a real service, which is what the list below did.

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
- **Email** — all eleven templates delivered through Resend to a real inbox.
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
