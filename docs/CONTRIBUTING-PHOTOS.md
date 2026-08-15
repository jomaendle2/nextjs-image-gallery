# Contributing photographs

The gallery is open to invited photographers. There is no public sign-up and
no approval queue: an invitation is a statement of trust, and an invited
contributor publishes directly.

## What a contributor does

1. Goes to `/contribute` and enters the address the invitation was sent to.
2. Receives a sign-in link, opens it, and presses **Sign in** on the page it
   lands on. The link works **once** and expires after 15 minutes.

   The button is not ceremony. Corporate mail gateways — SafeLinks,
   Proofpoint and the like — fetch every URL in an inbound message before
   the recipient sees it, and a link that signs you in on arrival would be
   spent by the scanner. The real click would then land on "expired", with
   no way to tell it had never had a chance.
3. Lands on `/contribute/photos` and adds photographs — several at once, by
   picker or by dropping them on the panel. JPEG, PNG, WebP or AVIF, up to
   25 MB each. The browser uploads straight to storage, so a file is never
   re-encoded or shrunk on the way in. They go up one after another rather
   than in parallel, and each reports its own progress; one failing does not
   take the others with it.
4. The server reads each file once and works out its dimensions, a blur
   placeholder, a backdrop colour, and the camera and exposure details.
5. Each photograph is a row in the list. Opening one reveals its form: a
   title, a description, a location, and the backdrop colour if the derived
   one is wrong. Two further fields are optional and shown only to members —
   where exactly the photograph was taken, and how it was made. Both are
   blank by default and nothing is ever read from the file to fill them.
6. Publish, and the photograph appears at the top of the gallery, credited,
   on the contributor's own page at `/by/<their-slug>`, at a URL of its own
   at `/photo/<id>`, and in both feeds.

### Working with a lot of photographs

Past four photographs the list gains a search box and a status filter with
counts. Search matches titles and locations. Tick the checkboxes to publish
or unpublish several at once, which is the thing people otherwise do ten
times in a row after a batch upload.

Bulk delete exists too, behind a confirmation that **lists the titles**
rather than a count — a misclicked row shows up as a name you did not expect
to read, which a number cannot do. Deleting is irreversible and takes the
stored file with it.

Contributors can edit, unpublish and delete their own photographs, and only
their own. That rule is enforced in the SQL, not in the interface.

## What is read from the file, and what is discarded

Read and shown: camera, lens, focal length, aperture, shutter speed, ISO and
the capture time.

**Discarded, always: GPS coordinates.** The parser is never asked for the GPS
block — nor for XMP, IPTC or the embedded thumbnail, all of which can also
carry coordinates — and separately, only the eight fields listed above are
ever copied into the database. Two independent layers, both covered by tests.
If a contributor wants a place named, they type it into the location field.

Capture times are stored as the camera's wall clock (`2026-04-11 08:32:10`).
EXIF carries no timezone, so converting to UTC would invent an offset from
whichever machine happened to process the upload.

## Operator setup

### 1. Storage and database

```bash
vercel env pull .env.local   # DATABASE_URL, BLOB_READ_WRITE_TOKEN
npm run db:migrate           # additive, idempotent
```

### 2. Email

Sign-in links are printed to the server console until an email provider is
configured, which is enough for local development. For production:

```bash
vercel env add RESEND_API_KEY production
vercel env add EMAIL_FROM production      # a sender you have verified with Resend
vercel env add SITE_URL production        # https://your-domain
```

`SITE_URL` matters for more than tidiness. Sign-in links carry a token, and
building them from the request `Host` header would let anyone hitting the
sign-in form choose where an invited contributor's token gets delivered.

### 3. Inviting people

Sign in as the owner and go to `/contribute/admin`. Enter a display name, an
email address, and optionally the photographer's own website — which becomes
an outbound link on every one of their credits.

There is no pending state. The row is the invitation.

### 4. Getting yourself in the first time

If no email provider is configured yet, mint your own link:

```bash
npm run auth:link -- you@example.com
```

## Owner tools

At `/contribute/admin` the owner can:

- **Invite and revoke.** Revoking is immediate: it drops the contributor's
  live sessions and removes their photographs from the public feed, which
  joins on `revoked_at IS NULL`. It does not delete anything, so restoring
  brings the work back.
- **Unpublish any photograph.** `published_at` becomes null. Nothing is
  destroyed.
- **Pin the opening photograph.** The feed is newest-first, so without a pin
  the first thing a visitor sees changes every time anyone publishes. Exactly
  one photograph can hold the pin; setting it clears the others in the same
  statement.

A signed-in contributor who is not the owner gets a 404 at `/contribute/admin`
rather than a 403 — there is no reason to confirm the page exists.

## How it fits together

| Piece | Where |
| --- | --- |
| Schema | `src/lib/schema.ts` |
| Derivation (dimensions, blur, colour, EXIF) | `src/lib/photos/derive.ts` |
| Row → view-model mapping | `src/lib/photos/map.ts` |
| Queries and per-row authorisation | `src/lib/photos/repository.ts` |
| Magic-link tokens | `src/lib/auth/tokens.ts` |
| Sessions | `src/lib/auth/session.ts` |
| Upload token | `src/app/api/uploads/token/route.ts` |
| Ingest | `src/app/api/photos/draft/route.ts` |
| Alt text | `src/lib/photos/alt-text.ts` |
| Structured data (JSON-LD) | `src/lib/structured-data.ts` |
| Feeds | `src/lib/feed.ts`, `src/app/feed.xml/`, `src/app/by/[slug]/feed.xml/` |
| Security headers | `next.config.ts` |

Two decisions worth knowing before you change anything:

**Authentication is checked in a server helper, never in middleware.**
Middleware runs ahead of the cache on every request. Putting the session
lookup there would make every anonymous visitor to the gallery pay for a
feature that serves about ten people.

**A photograph row is shaped into what `next/image` expects from a static
import** — `{ src, width, height, blurDataURL }`. That is the whole trick
behind the carousel not caring where a photograph came from.

## Verifying a change

```bash
npm test && npm run lint && npm run typecheck && npm run build
```

For the ingest path specifically, against a running dev server:

```bash
node --env-file=.env.local scripts/smoke-upload.mts <gallery_session cookie>
```

Take the cookie from your browser's dev tools after signing in, or mint a
session directly. Thirteen checks, and the one worth watching is **"never
read the GPS block"** — the synthetic photograph it uploads carries real GPS
tags, so that assertion is the promise on the apply page, tested.

It uploads a synthetic photograph carrying GPS tags, checks that the derived
metadata is right and that the coordinates did not survive, confirms the row
landed as a draft, and checks that the endpoint refuses three things: an
anonymous caller, a URL pointing anywhere other than the blob store, and a
blob that already belongs to a photograph. That last one is what stops a
contributor claiming another's work by posting its URL, which is public in
the markup of every page the photograph appears on. It cleans up after
itself.

### Traps when checking this by hand

Every one of these produced a confident, wrong "I found a bug" during the
work on this version. They are cheap to avoid once named.

- **`innerText` lies about what is on the page.** It is layout-dependent and
  will skip an element that is present and correctly sized. Use
  `textContent` when asking whether something rendered, and
  `getBoundingClientRect()` when asking how big it is.
- **Read the label before asserting on it.** A check for a button called
  "Send" found nothing and looked like a missing panel; the button says
  "Announce 16". Query the page for its actual text first, then assert.
- **Reloading hides live-update failures.** Server actions revalidate and
  the client updates on its own within about half a second. A test that
  reloads before checking would pass even if that were broken — which is
  the failure a person would actually hit.
- **Grep the whole of `src`.** A list of files touching a column, built from
  `src/lib` and `src/app`, missed `src/components` and was wrong within
  seconds of being turned into a test.
- **Sign-in tokens are single-use and last fifteen minutes.** A token from
  an earlier attempt silently redirects to the sign-in form, and the next
  assertion fails for reasons that have nothing to do with the change. Mint
  a fresh one per run.
- **The database is shared with production.** Anything created, published or
  deleted while testing is real. Clean up in the same script that sets up,
  and check the counts afterwards rather than assuming.
