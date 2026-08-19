# Quality audit — the beauty of earth.

> **Archived record — August 2026. Not current state.**
>
> The reasoning from seven production-readiness passes. Some of its
> recommendations were taken and some were reversed: it argues against
> building a paid tier that now exists, and says there is no way to subscribe
> in a section after the one describing the subscribe flow it built. The
> commit hashes it cites do not resolve — the branch was collapsed on merge.
>
> The measurements are the durable half and are in
> [the roadmap](../roadmap.md). Kept for the argument, not the conclusions.

The reasoning from the production-readiness passes that still constrains
future work. Kept in the repo rather than in a session, because the work
spans many sittings and the reasoning outlives the checklist.

Scope, from the brief: interface quality and design consistency; unfinished
work and inconsistency; end-to-end correctness; SEO and growth; security;
mobile polish, speed and layout stability; Next 16 / React 19 practice; and
making contribution worth someone's while.

---

## What this file is

The decisions that are still live, and the limits measured rather than
guessed. It used to carry a prose changelog of every audit pass, keyed by
commit SHA — several hundred lines duplicating what `git log` already
held, more accurately and without drifting. That half is gone; the
reasoning that still constrains a future change is below.

## Where to go next

Written after seven passes over the code, so it is grounded in what is
actually here rather than in what a photo gallery usually does.

### The read

The scarce asset is curation and trust — a small invited set, real credit,
and a privacy stance most galleries cannot claim (the GPS block is never
read, and there are tests that prove it). Those are the things worth compounding.

The current bottleneck is **not** revenue. It is two photographers and
sixteen photographs. Building a paid tier now would optimise a funnel with
almost nothing in it. Supply and audience come first, and they feed each
other: photographers join where work is seen and credited, audiences arrive
where the work is good.

The demand-side foundation now exists — a page per photograph, real OG
cards, a sitemap, structured data. What is missing is the other half.

### 1. A way to follow the gallery — feed done, email list open

`1a5bcaf` adds `/feed.xml`; `c9d09c9` adds one per photographer at
`/by/<slug>/feed.xml`, with a visible "follow" beside the link to their own
site. Per-photographer is the half that matters to a contributor —
"people can subscribe to you" is the argument for publishing here.

The email half is built in `190a6fa`: `/subscribe`, double opt-in, one-click
unsubscribe that deletes rather than flags, reachable from the photographers
page since `218c5f9`.

**The send is built** — `5011d14`. A button on `/contribute/admin`, and a
Monday-morning cron at `/api/cron/announce-reminder` that emails *the owner*
that something is waiting rather than mailing the list itself. That is the
whole difference between a schedule and an automation: a wrong title reaches
one person who can still stop it.

`markAnnounced` runs before the first message, not after. If the send dies
halfway the choice is between some subscribers getting a second copy and
some photographs never being announced, and the duplicate is worse — the
photograph is still on the site, in both feeds and in the sitemap.

The body is a pure function in `lib/announcement.ts`, tested like `feed.ts`:
every value in it was typed by a contributor and lands inside HTML in
somebody else's mail client, so the escaping is the risk and it is tested
directly. Twelve photographs listed, the rest counted.

One flaw found by driving it rather than designing it: the panel was first
rendered by the page on `pending > 0`, so sending dropped the count to zero,
the section unmounted, and the "sent to N" confirmation went with it. The
component owns its own visibility now, so the result outlives what produced
it.

Needs `CRON_SECRET` set in production; without it the route refuses to run
rather than becoming a public way to ring the owner's inbox.

There is currently no reason to return and no way to subscribe. Every
visitor is a one-time arrival from a link. That is the single largest gap,
it is cheap, and it is the **precondition for everything below**: a
membership cannot be sold to an audience you have no way to reach.

Concretely: an RSS/JSON feed, and an email list that sends when new work is
published. Nothing more.

It also strengthens the contributor pitch, which is the supply side of the
same loop — "your work goes out to N people who asked to see it" is a much
better sentence than "your work appears in a gallery".

### 2. Lower the cost of contributing — the supply side

Batch upload (`8e53153`) removed most of the friction. What remains is that
every photograph needs a title and a description typed from nothing.

This reframes the AI Gateway question. Drafting a description at upload is
not a nice-to-have feature; it is the remaining tax on the scarce resource,
which is photographers' willingness to publish their fortieth image rather
than their fourth. The constraint stands: the model proposes a description,
never a place — it cannot know where a photograph was taken, and a
confident wrong location on someone else's work is worse than a blank field.

### 3a. What a membership should sell

Exact locations are decided. The question is what sits beside them, and the
test each candidate has to pass is: **does a photographer want it to exist?**
This gallery's supply problem is photographers, so anything that makes
publishing here feel worse is expensive however well it converts.

**Strong — build these with locations:**

- **The location itself, per photograph, opt-in.** Nothing is disclosed that
  a photographer did not type. This is the one thing only this community can
  supply, and it fits the privacy stance rather than contradicting it: EXIF
  still never leaks a coordinate; the photographer *chooses* to say where
  they stood.
  *(Built, 17 August 2026 — as a map picker storing two precisions, with the
  blunt one public so `/globe` can exist. The prediction held; the wording
  did not, and the copy that said "never records a coordinate" had to be
  rewritten. What survives is "never read from the file".)*
- **How the photograph was made.** The exposure line is already shown; the
  approach is not — time of day, what they waited for, what they would do
  differently. It costs a photographer a paragraph they usually enjoy
  writing, and it is the thing other photographers actually pay for. It also
  makes the member's relationship with the photographer rather than with us.
- **The full archive.** This is the honest answer to a problem already open
  in this document: `listPublishedPhotos` has no `LIMIT`, and the fix has
  been deferred because a cap silently drops photographs out of a
  photographer's gallery. If the free gallery shows recent work and members
  see everything, the cap becomes a product boundary instead of a
  regression — one decision solving a technical problem and a commercial one.

**Worth considering, with a caveat each:**

- **A share of revenue to photographers, by view.** Strategically the
  strongest thing on this list — "your work earns here" is the best
  recruitment sentence available, and it makes the membership something a
  photographer wants to sell. The caveat is operational: payouts, tax,
  thresholds, and a number that will be small at first and visible.
- **Full-resolution viewing.** Not downloads, which invite the licensing
  question before there is an answer to it. Simply seeing the original where
  the gallery serves a capped copy.

**Rejected, and why, so they do not come back around:**

- **Early access.** Withholding new work from the audience you are trying to
  grow, and from the feed and the email list just built to reach them.
- **Ad-free.** There are no ads.
- **Members-only photographs.** It splits the gallery in two and gives a
  photographer a reason to wonder which half their best work landed in.
- **A members' comment section.** A moderation obligation, not a feature.

### 3b. Membership, when there is an audience to sell to

The architecture is already waiting for it, deliberately. Sessions and
login tokens were re-keyed onto email precisely so a paying member with no
`contributors` row could hold a session — see the migration note in
`schema.ts`, the `getCurrentMember` named in `session.ts`, and the comment
in `tokens.ts`.

Exactly three things block it, and they are small:

- `login_tokens.contributor_id` is `NOT NULL` (`schema.ts`)
- `sessions.contributor_id` is `NOT NULL` (same)
- `mintLoginToken` returns null for an address with no contributors row

**What a membership should sell** matters more than the plumbing. The
strongest candidate is the one already sketched: precise locations. It is
genuinely valuable to the people who look at landscape photography, only
this community can supply it, and it fits the privacy stance rather than
contradicting it — the photographer *chooses* to disclose a spot, which is
categorically different from EXIF leaking it. It must stay per-photograph
and opt-in, and the money has to reach the photographer, or it converts the
site's central promise into a thing it sells out.

Weaker candidates, for the record: ad-free (there are no ads), downloads
(commoditised), early access (annoys the audience you are trying to grow).

### 4. Prints and licensing — later

Money flowing to photographers is the strongest recruitment argument there
is, and it is operationally heavy: fulfilment, tax, returns, disputes. Worth
wanting, not worth starting before 1–3.

---

## Notes and constraints

- `listPublishedPhotos()` has no `LIMIT`. Everything downstream must survive
  an unbounded feed; the dock now does. The grid and the carousel have not
  been checked against this.
- Plausible's domain (`thebeautyof.earth`) is hardcoded in `layout.tsx` and
  is *not* the same as the configured origin. Left alone — analytics domain
  and serving origin can legitimately differ — but noted in case it is a
  second copy of the bug fixed in `aa26e54`.
- The Next.js dev-tools indicator renders in a shadow root at bottom-left.
  It shows up in screenshots and is not app UI.
- The fourteen imported photographs have numeric ids (`"1"`–`"14"`); only
  newer ones are nanoids. Anything that validates a photo id has to accept
  both — this has already caused one near-miss.
- A contributor's description contains a typo, "Aerial view of tale waves".
  Content rather than code, so left alone, but it now appears in alt text
  and in the `/photo/1` metadata where it is more visible than it was.


---

## Measured scaling limits (16 August)

Both the "does it scale" questions had been answered by reasoning rather
than by counting. So I counted, by inserting rows and measuring, then
removing them.

### The contributor dashboard — fixed

`<details>` hides its children; it does not stop them rendering. Collapsing
each row fixed scanning and left every closed row still shipping a complete
edit form. At 114 photographs:

| | before | after |
| --- | --- | --- |
| DOM nodes | 7,432 | 1,943 |
| form inputs | 1,374 | 120 |
| HTML | 1.7 MB | 725 KB |
| DOM ready | 442 ms | 232 ms |

Mounting the form on first open. See the note in `PhotoCard.tsx` for the
trade that buys.

### The public gallery — measured, deferred, with a number

The viewer is a client component and receives every published photograph,
so the page carries all of them whether or not anybody scrolls that far.

| photographs | HTML | DOM nodes |
| --- | --- | --- |
| 16 | 136 KB | 203 |
| 116 | 676 KB | 703 |

**5.4 KB and 5 DOM nodes per photograph**, linear. Which projects to roughly
1.7 MB at 300 and 2.8 MB at 500.

Not the metadata: descriptions average 47 characters and exif 176. It is the
thumbnail markup for every photograph plus the flight data, both of which
scale with the whole set rather than with what is on screen.

Deferred deliberately. At the launch scale this is actually heading for —
five photographers, a few dozen each — it lands near 676 KB, which is less
than one of the photographs it is showing. Fixing it means the viewer no
longer holds the full list, which changes how the dock and the keyboard
navigation work, and that is not a change to make the week before inviting
testers.

The number is here so the decision to revisit is a measurement rather than a
feeling: **past roughly 300 photographs, this needs windowing.**

### The moderation list — measured, fine

The one that grows fastest, since it holds everybody's work rather than one
photographer's. At 116 photographs: 318 ms to DOM ready, 1,302 DOM nodes,
695 KB, and the filter narrows the list in 121 ms.

Eleven DOM nodes per row against the dashboard's sixty-four before it was
fixed, because these rows are a thumbnail, a line of text and two buttons
rather than a hidden form. Nothing to do. Recorded because "we checked and
it was fine" is worth as much as a finding when the next person is deciding
where to look.

### What this exercise was actually worth

Three surfaces, all of which I had previously called scalable. One was
broken and I had already declared it fixed; one is fine on a number rather
than an impression; one needs work at a threshold that is now written down.

The habit: a claim about *many* is a claim about a number, and it is not
verified until somebody has counted.
