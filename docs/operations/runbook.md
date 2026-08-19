# Runbook

What to do, and in what order, for the things an operator actually has to do.
[Overview](../architecture/overview.md) says what each part is;
[scripts.md](scripts.md) is the catalogue of commands.

---

## Sign in as admin

1. Go to `/contribute`.
2. Enter the address on your `contributors` row with `role = 'owner'`.
3. Open the link that arrives. **Locally, with no `RESEND_API_KEY`, it is
   printed to your `next dev` terminal** rather than emailed.
4. You land on `/contribute/photos`. `/contribute/admin` is linked from
   there, and has a breadcrumb back.

**If the email never arrives**, mint a link directly:

```bash
npm run mint-link -- you@example.com
```

That is the break-glass path, and it exists for the case you are most likely
to meet: a mail provider outage, a domain falling out of verification, or a
wrong `EMAIL_FROM` — all of which lock you out of the admin page you would
need in order to fix them. It goes through the same `mintLoginToken` the form
uses, so the same rules apply.

The link works **once** and expires after `LOGIN_TTL_MINUTES`
(`src/lib/auth/ttl.ts`) — but *opening* it does not spend it. The page it
lands on has a Sign in button, and only pressing that redeems the token, so a
mail scanner or a link preview cannot burn it before you get there.

What the owner can do that a contributor cannot: see and moderate everybody's
photographs, invite contributors, review applications, and send the
announcement.

## Make somebody a contributor

Three doors, and all three end at `inviteContributor`/`claimInvite` in
`src/lib/auth/contributors.ts` — the only file in `src/` that inserts a
contributor, which is asserted by a test so it stays that way.

1. **You invite them.** `/contribute/admin` → invite by email address. No
   quota; you can invite as many people as you like.
2. **They apply.** `/contribute/apply` submissions appear on the same page,
   and approving or declining one sends its own message.
3. **A photographer invites them.** Every contributor has **three
   invitations, ever**, spent from `/contribute/invite`. Whoever they bring
   in becomes a contributor immediately and gets three of their own.

All three send an invitation email automatically, telling the recipient where
to sign in and that nothing happens until they do. A peer invitation names
the photographer who sent it, because an unsolicited "you have been chosen"
from nobody in particular reads as spam. If a send fails the panel says so,
so you know to follow up by hand rather than assuming it went out.

**What to watch.** The People list on `/contribute/admin` shows who invited
whom and how many invitations each person has left. Nothing about this is
public — a photographer's page never says who brought them in. Revoke is the
control if an invitation turns out badly; it takes effect immediately and
deletes their sessions.

Invites compound: three each, and their invitees get three too. That is
deliberate, and it is the thing to keep an eye on as the gallery grows.

## Publish a photograph

`/contribute/photos` → upload → open a row → fill in the fields → publish.
Three of those are members-only: `precise_location`, `technique`, and the
exact point if the photographer marks one on the map. All are optional and
empty by default, and nothing is read from the file — a marked point is a
decision somebody makes afterwards, exactly like typing a sentence.

Marking a point stores it twice: the exact position, which only members see,
and the centre of a cell about `CELL_KM` across
(`src/lib/photos/coarsen.ts`), which is public and is what `/globe` draws.
The picker shows both before the save. A photographer whose subject should
not be findable can publish the blurred dot only, which discards the exact
point rather than storing it.

Each photograph is a row that opens into its form, so the list stays readable
as it grows. Past four photographs a search box and a status filter appear,
and the checkboxes publish or unpublish several at once. Bulk delete is
behind a confirmation listing the titles rather than a count, because
deleting takes the stored file with it and a number cannot be checked against
intent.

## Send the weekly announcement

`/contribute/admin` shows a count of published-but-unannounced photographs
and a button reading "Announce N". It marks them announced *before* sending:
if the send dies halfway, some people miss an announcement rather than some
people getting two, and the second is the one that loses trust.

The Monday cron only reminds you. Nothing goes out without you pressing it.

## Refund or cancel somebody's membership

From the Stripe dashboard. The webhook will pick it up and their access ends
on its own — do not edit the `members` table by hand, because Stripe's copy
is the one that counts and the next event will overwrite yours.

Members can cancel themselves from `/membership`.

---

## Destructive work

### Run destructive scripts against a branch, not production

Every `db:*` and `smoke:*` script loads `.env.local`, which points at
production. They print the host and refuse without `--apply`:

```bash
npm run smoke:invite                 # prints the target, refuses
npm run smoke:invite -- --apply      # runs
```

Create a Neon branch, put its connection string in `.env.local`, and run them
there. The guard makes the target visible; it cannot choose it for you.

### Take a backup, and write down the retention

Migrations run on every production build, and there is no restore story. One
`pg_dump` is a known-good floor that costs a minute:

```bash
pg_dump "$DATABASE_URL" --no-owner --no-privileges -Fc -f beauty-$(date +%F).dump
```

Keep it somewhere that is not Neon and not this repository. Restore is
`pg_restore -d "$TARGET_URL" beauty-YYYY-MM-DD.dump` against a **branch**,
never against production, and the point of writing that down is that nobody
reads a restore command for the first time during an incident.

Read the actual point-in-time-recovery window in the Neon dashboard and
record it — "Neon has PITR" is not a retention policy, a number of days is.
**Blobs are not covered by any of this.** Vercel Blob has no snapshot, so a
deleted blob is gone; that is the argument for `--apply` on every destructive
script rather than for a backup.

### Re-coarsen the stored dots in the same deploy that changes `CELL_KM`

A published dot is stored rather than derived, deliberately, so that it
cannot move because somebody later tuned the arithmetic. The cost of that
decision is a migration: change `CELL_KM` and every sentence quoting it — the
privacy page, the picker's guarantee, the alt text under each dot — starts
describing an accuracy the stored `coarse_lat`/`coarse_lng` do not have. The
dots come out blunter than the page claims rather than sharper, so the error
is on the safe side, but it is still a claim that is not true yet.

So the two go out together:

```bash
npm run db:backfill-pins         # first: holds the originals for rows that
                                 # predate the picker
npm run db:recoarsen             # prints the plan
npm run db:recoarsen -- --apply  # writes it
```

Order matters. `recoarsen` rewrites only from a surviving exact point — it
will not re-coarsen an already-coarse one, because a 100 km cell centre put
through a 1 km grid yields a tidy 1 km cell still 71 km from the truth,
precise-looking and exactly as wrong. `backfill-pins` is what supplies an
exact point for rows that have none, re-deriving it from the place name the
photographer published. Anything with neither is listed rather than touched,
and stays on the old grid until somebody gives it a point by hand.

`/globe` is statically rendered with `revalidate = 3600`, so corrected dots
reach readers on the next deploy or within the hour, not immediately.
`coarsen.test.ts` pins the constant, so moving it is a decision somebody
makes on purpose and reads this first. The procedure was last run for the
100 km → 1 km change on 2026-08-19; the record is in
[the archived launch checklist](../archive/2026-08-launch-checklist.md).

### Erasing somebody

```bash
npm run db:erase-contributor -- someone@example.com
```

Lists what would go and changes nothing. Adding `--apply` deletes their
photographs, both stored files per photograph, their sessions and tokens, and
their row — and tells you if they held the opening photograph, which nothing
reassigns automatically.

---

## Testing it end to end

With the dev server running:

```bash
npm run smoke
```

Five paths, with no setup and nothing left behind: the invite quota holds,
every page renders, ingest works, the attacker's side of the membership
holds, and the member's side works. Individually: `smoke:invite`,
`smoke:pages`, `smoke:upload`, `smoke:membership`, `smoke:portal` — and each
of those refuses without `--apply` when run on its own, which the composite
supplies for you.

`smoke:pages` is the shallow one and the one most likely to save you. Until
it existed nothing in the suite rendered a page at all, so a server component
that threw — a bad import, an unguarded null — left the tests green and the
site broken.

None of them needs `stripe listen`: the membership checks sign their own
events with `STRIPE_WEBHOOK_SECRET` and post straight to the local endpoint,
which is the same code path Stripe drives including the signature check. A
tunnel is only for the different job of clicking through a real checkout in a
browser and having Stripe's servers reach your machine.

```bash
# Once per Stripe mode — test now, live before launch.
npm run stripe:portal-setup

# Every email template, sent for real if a key is set. The address is
# required rather than defaulted, because this one really does send.
npm run smoke:email -- you@example.com
```

Prefer the `npm run` names over hand-written `node` lines: each script needs
a loader flag or two that are easy to omit, and whether omitting one breaks
depends on a transitive import several files away. `docs.test.ts` also checks
that every `npm run` name in this documentation exists, which it cannot do
for a command line typed into prose.

To buy a membership by hand: `/membership` → Become a member → card
`4242 4242 4242 4242`, any future expiry, any CVC. You do **not** need to be
signed in first — Stripe collects the address, and you sign in with it
afterwards to unlock what you bought.
