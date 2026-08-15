# Opening the gallery to invited contributors

Status: approved (sections 1-2 reviewed with Jo; 3-6 authored under AFK
authorisation on 2026-08-15).

## Goal

Let a small, invited set of photographers publish into the gallery, in a way
that attracts good photographers and rewards good work. Two consequences
follow from that goal and drive most of the decisions below:

1. **Attribution is a first-class feature, not a footnote.** Photographers
   trade work for credit. The credit line is always visible, links out to the
   contributor's own site, and doubles as the filter into their set.
2. **The site must respect the craft.** Capture and display EXIF, keep the
   original file at full resolution, and never silently degrade an image.

## Shape

- **Community model:** invited contributors. A closed set, trusted on
  invitation, publishing directly. No approval queue.
- **Structure:** one mixed stream by default, filterable to one contributor.
- **Auth:** magic link. The invitation is the account.
- **Ordering:** newest first, with a single pinned opener.

## 1. Data model and storage

Files live in **Vercel Blob** (public), at `photos/<nanoid>.<ext>`. Blob paths
are unique per upload and never rewritten, so `minimumCacheTTL: 31_536_000` in
`next.config.ts` stays correct; `remotePatterns` gains the blob hostname.

```sql
CREATE TABLE contributors (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,      -- lowercased
  slug         TEXT NOT NULL UNIQUE,      -- filter key: /?by=anna-weber
  display_name TEXT NOT NULL,
  site_url     TEXT,
  role         TEXT NOT NULL DEFAULT 'contributor',  -- 'owner' | 'contributor'
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE photos (
  id            TEXT PRIMARY KEY,         -- nanoid; also the image_views key
  blob_url      TEXT NOT NULL,
  blob_pathname TEXT NOT NULL,
  width         INTEGER NOT NULL,
  height        INTEGER NOT NULL,
  blur_data_url TEXT NOT NULL,
  bg_color      TEXT NOT NULL,            -- '#2a6b7c', derived then editable
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  location      TEXT,
  exif          JSONB,                    -- camera/lens/exposure, GPS stripped
  author_id     TEXT NOT NULL REFERENCES contributors(id),
  published_at  TIMESTAMPTZ,              -- NULL = draft or unpublished
  is_opener     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE login_tokens (
  token_hash     TEXT PRIMARY KEY,        -- SHA-256 of the emailed secret
  contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  expires_at     TIMESTAMPTZ NOT NULL,
  used_at        TIMESTAMPTZ
);

CREATE TABLE sessions (
  id             TEXT PRIMARY KEY,        -- SHA-256 of the cookie value
  contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  expires_at     TIMESTAMPTZ NOT NULL
);
```

Notes on specific columns:

- `photos.id` is a TEXT nanoid, so it drops straight into the existing
  `image_views.image_id VARCHAR(255)` with no migration of view data.
- `published_at IS NULL` is the entire unpublish mechanism. No status enum,
  no state machine.
- `is_opener` pins one authored first impression on top of a newest-first
  feed. At most one row may hold it; setting it clears the others.

Migrations are additive `CREATE TABLE IF NOT EXISTS`, run by an idempotent
script. The existing `image_views` table is never altered.

## 2. Identity and invitations

The contributor row *is* the invitation: insert an email, that person can sign
in. Revoking is `revoked_at`.

`/contribute` takes an email, mints a single-use token (15 min TTL), and mails
a link to `/contribute/verify?token=...`. Verification hashes the token,
consumes it atomically, opens a session, sets an `httpOnly` `SameSite=Lax`
`Secure` cookie, and redirects.

**Auth is checked in a server helper, never in middleware.** Middleware runs
ahead of the cache on every request; putting auth there would tax every
anonymous gallery visitor for the benefit of ten contributors. The public
gallery touches no session.

Hand-rolled rather than a framework, because the correctness surface is short
and closed:

- tokens from `crypto.randomBytes`, stored **hashed**;
- single-use enforced in the read statement itself
  (`UPDATE ... WHERE used_at IS NULL RETURNING ...`), so two clicks cannot race;
- lookup by hash, so no timing-unsafe comparison;
- the request endpoint answers identically for unknown emails and is rate
  limited per IP and per email, so it is not an invited-contributor oracle;
- session cookie value also stored hashed.

Email sending sits behind one `sendLoginEmail()` adapter. Dev logs the link to
the console; production needs one provisioned transactional-email provider.

## 3. Upload and publish pipeline

Large photographic originals make a direct-to-Blob client upload the right
default: the file never passes through a function body.

1. Contributor picks a file. The browser uploads straight to Blob via
   `@vercel/blob/client`, authorised by `POST /api/uploads/token`, which
   requires a session and constrains content type and size (25 MB).
2. On completion the client posts the blob URL to `POST /api/photos/draft`.
   The server fetches the blob once and derives, with `sharp` and `exifr`:
   intrinsic `width`/`height`; an 8px-wide base64 `blur_data_url`; a dominant
   colour for `bg_color`; and EXIF (camera, lens, focal length, aperture,
   shutter, ISO, capture date). **GPS tags are dropped**, always — location is
   a field the human fills in if they want it public. A draft row is inserted
   (`published_at IS NULL`).
3. The form comes back pre-filled with what was derived. The contributor
   supplies title and description, may correct `bg_color` and `location`, and
   publishes: `published_at = now()` plus `revalidateTag('photos')`.

Deliberately not deferred to a webhook (`onUploadCompleted`), which does not
fire against localhost and would make the flow untestable in development.

Failure handling: a derive failure deletes the orphaned blob and reports the
reason; an upload that never reaches step 2 leaves a blob with no row, which a
`blob:prune` script clears.

## 4. Reading path

`src/data/galleryData.ts` keeps the `GalleryImage` interface and replaces the
constant with `getGalleryImages({ by })`. Each row maps to a
`StaticImageData`-shaped object — `{ src, width, height, blurDataURL }` — which
is all `next/image` requires, so `CarouselImage`, `ImageModal`, `ImageInfo` and
`ImageIndicators` need no change to how they consume an image.

The query is wrapped in `"use cache"` with `cacheTag('photos')`, so visitors
get a cached render and publishing invalidates it. Ordering is
`is_opener DESC, published_at DESC`.

`ImageCarousel` currently imports `galleryImages` at module scope from inside a
`"use client"` file. That import becomes an `images` prop supplied by
`page.tsx`, which becomes an async Server Component. The non-empty tuple type
cannot survive a query, so `page.tsx` handles the empty case explicitly rather
than casting.

The viewer gains a credit line — display name, optional outbound link — and a
subtle EXIF strip. `/?by=<slug>` filters the stream to one contributor.

## 5. Ownership and moderation

Role `owner` (Jo) may unpublish any photo, pin the opener, and invite or revoke
contributors from `/contribute/admin`. Role `contributor` may publish, edit and
unpublish only their own photos. Both are enforced server-side in the mutation
handlers, not in the UI.

## 6. Testing

The repo has no test runner; this adds **Vitest** for pure units:

- token mint/verify: expiry, single use, wrong token, revoked contributor;
- feed ordering: opener first, then newest, drafts excluded, filter by slug;
- row-to-`GalleryImage` mapping;
- derivation against a real fixture from `src/assets`, asserting dimensions, a
  parseable blur data URL, a `#rrggbb` colour, and **that GPS is absent**.

Route handlers and the pipeline are verified by running the flow against the
real dev server rather than by mocking Blob and Neon.

## Out of scope

Public sign-up, comments, likes, follower graphs, collections, ranking by
popularity, image editing, and multi-image posts.
