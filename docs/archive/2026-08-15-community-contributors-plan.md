# Community Contributors Implementation Plan

> **Archived record — 15 August 2026. Not current state.**
>
> The eleven-task implementation plan for the contributor feature. Every one
> of its sixty-three checkboxes is unticked and every task shipped: it was
> worked from rather than updated. Paths in it predate the move to `.mts`,
> and its rule counts and environment variable names are those of the day.
>
> Its Global Constraints section, however, is where the working rules in
> [`AGENTS.md`](../../AGENTS.md) came from.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a closed set of invited photographers publish into the gallery, credited and filterable, without giving up the cached, layout-shift-free viewing experience the site has today.

**Architecture:** Photos move from build-time static imports to Neon rows plus Vercel Blob files. Every row is mapped into a `StaticImageData`-shaped object so the existing carousel subtree consumes it unchanged. Pages stay statically rendered with ISR and are revalidated on publish. Auth is a hand-rolled magic link with opaque server sessions, checked in a server helper and never in middleware.

**Tech Stack:** Next 16.3 (App Router), React 19.2, TypeScript 7 (strict + `noUncheckedIndexedAccess`), Neon serverless Postgres, Vercel Blob, `sharp` (derivation), `exifr` (EXIF), `nanoid` (ids), Vitest (unit tests), Biome 2 (lint/format), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-08-15-community-contributors-design.md`

## Global Constraints

- Biome runs with 381 rules; `npm run lint` must pass. Notably `noNonNullAssertion`, `noExplicitAny`, and a11y rules are on.
- `noPropertyAccessFromIndexSignature` is on: read env as `process.env["NAME"]`, never `process.env.NAME`.
- `useNamingConvention` is off precisely so database columns stay `snake_case` crossing into TypeScript. Keep row types snake_case; convert at the mapping boundary only.
- `noUncheckedIndexedAccess` is on: every `rows[0]` is `T | undefined` and must be guarded, never asserted.
- `npm run typecheck` (`tsc --noEmit`) must pass.
- Never alter or drop the existing `image_views` table. All migrations are additive `CREATE TABLE IF NOT EXISTS`.
- Photo ids are nanoids and double as `image_views.image_id`.
- GPS EXIF tags are dropped at derivation time, unconditionally.
- Default export is required for `page`/`layout`/`route` modules (`noDefaultExport` is off for that reason); use named exports everywhere else.

**Deviation from the spec, applied throughout:** the contributor filter is a real route, `/by/[slug]`, not a `?by=` search param. Reading `searchParams` opts a page out of static rendering entirely, which would have cost the whole gallery its cached render — the exact thing section 4 of the spec set out to protect. A route segment keeps both `/` and `/by/[slug]` statically rendered with ISR, and gives each photographer a shareable page, which serves the "attract good photographers" goal better than a query string. Update the spec's section 4 to match as part of Task 11.

---

### Task 1: Test harness and database schema

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/schema.ts`
- Create: `scripts/migrate.ts`
- Modify: `package.json` (scripts)
- Test: `src/lib/schema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `MIGRATIONS: readonly string[]` from `src/lib/schema.ts`; `npm run db:migrate`.

- [ ] **Step 1: Write the failing test**

`src/lib/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MIGRATIONS } from "./schema";

describe("MIGRATIONS", () => {
  it("creates every table the feature needs", () => {
    const sql = MIGRATIONS.join("\n");
    for (const table of ["contributors", "photos", "login_tokens", "sessions"]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("never mutates the pre-existing image_views table", () => {
    const sql = MIGRATIONS.join("\n").toUpperCase();
    expect(sql).not.toContain("DROP TABLE");
    expect(sql).not.toContain("ALTER TABLE IMAGE_VIEWS");
  });

  it("is idempotent by construction", () => {
    for (const statement of MIGRATIONS) {
      expect(statement).toMatch(/IF NOT EXISTS/);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/schema.test.ts`
Expected: FAIL — cannot resolve `./schema`.

- [ ] **Step 3: Add `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": new URL("./src/", import.meta.url).pathname },
  },
});
```

- [ ] **Step 4: Write `src/lib/schema.ts`**

One exported array of statements, in dependency order (`contributors` before `photos`, which references it). Each statement is a separate array entry because the Neon HTTP driver sends one statement per round trip.

```ts
/**
 * Additive migrations, safe to re-run. `image_views` predates this feature and
 * is deliberately absent: photo ids are nanoids that slot into its existing
 * `image_id VARCHAR(255)` with no migration of view data.
 */
export const MIGRATIONS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS contributors (
     id           TEXT PRIMARY KEY,
     email        TEXT NOT NULL UNIQUE,
     slug         TEXT NOT NULL UNIQUE,
     display_name TEXT NOT NULL,
     site_url     TEXT,
     role         TEXT NOT NULL DEFAULT 'contributor',
     revoked_at   TIMESTAMPTZ,
     created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
   );`,
  `CREATE TABLE IF NOT EXISTS photos (
     id            TEXT PRIMARY KEY,
     blob_url      TEXT NOT NULL,
     blob_pathname TEXT NOT NULL,
     width         INTEGER NOT NULL,
     height        INTEGER NOT NULL,
     blur_data_url TEXT NOT NULL,
     bg_color      TEXT NOT NULL,
     title         TEXT NOT NULL,
     description   TEXT NOT NULL,
     location      TEXT,
     exif          JSONB,
     author_id     TEXT NOT NULL REFERENCES contributors(id),
     published_at  TIMESTAMPTZ,
     is_opener     BOOLEAN NOT NULL DEFAULT FALSE,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
   );`,
  `CREATE INDEX IF NOT EXISTS photos_feed_idx
     ON photos (is_opener DESC, published_at DESC)
     WHERE published_at IS NOT NULL;`,
  `CREATE TABLE IF NOT EXISTS login_tokens (
     token_hash     TEXT PRIMARY KEY,
     contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
     expires_at     TIMESTAMPTZ NOT NULL,
     used_at        TIMESTAMPTZ
   );`,
  `CREATE TABLE IF NOT EXISTS sessions (
     id             TEXT PRIMARY KEY,
     contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
     expires_at     TIMESTAMPTZ NOT NULL
   );`,
];
```

- [ ] **Step 5: Write `scripts/migrate.ts`**

```ts
import process from "node:process";
import { MIGRATIONS } from "../src/lib/schema";
import { sql } from "../src/lib/database";

async function main(): Promise<void> {
  for (const statement of MIGRATIONS) {
    await sql.query(statement);
    console.log(`ok: ${statement.slice(0, 60).replace(/\s+/g, " ")}...`);
  }
  console.log(`Applied ${MIGRATIONS.length} statements.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 6: Add scripts to `package.json`**

```json
"test": "vitest run",
"test:watch": "vitest",
"db:migrate": "node --experimental-strip-types --env-file=.env.local scripts/migrate.ts"
```

- [ ] **Step 7: Run the tests and the migration**

Run: `npm test` → PASS.
Run: `npm run db:migrate` → prints one `ok:` line per statement.
Re-run `npm run db:migrate` → same output, no error. That is the idempotency proof.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts src/lib/schema.ts src/lib/schema.test.ts scripts/migrate.ts package.json package-lock.json
git commit -m "Add Vitest and the additive schema for contributors and photos"
```

---

### Task 2: Image derivation

Turns an uploaded buffer into everything the static-import pipeline used to give us for free.

**Files:**
- Create: `src/lib/photos/derive.ts`
- Test: `src/lib/photos/derive.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:

```ts
export interface PhotoExif {
  camera?: string;      // "SONY ILCE-7M4"
  lens?: string;
  focal_length?: string; // "35 mm"
  aperture?: string;     // "f/1.8"
  shutter?: string;      // "1/250 s"
  iso?: number;
  taken_at?: string;     // ISO 8601
}

export interface DerivedPhoto {
  width: number;
  height: number;
  blur_data_url: string;  // "data:image/webp;base64,..."
  bg_color: string;       // "#rrggbb"
  exif: PhotoExif | null;
}

export function deriveFromBuffer(buffer: Buffer): Promise<DerivedPhoto>;
```

- [ ] **Step 1: Write the failing test**

Uses a real repository asset as the fixture — no synthetic image, because the point is that real photographic JPEGs survive the pipeline.

`src/lib/photos/derive.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { deriveFromBuffer } from "./derive";

const fixture = await readFile("src/assets/waves.jpg");

describe("deriveFromBuffer", () => {
  it("reports the intrinsic dimensions next/image needs", async () => {
    const derived = await deriveFromBuffer(fixture);
    expect(derived.width).toBeGreaterThan(0);
    expect(derived.height).toBeGreaterThan(0);
  });

  it("produces a small inline blur placeholder", async () => {
    const derived = await deriveFromBuffer(fixture);
    expect(derived.blur_data_url).toMatch(/^data:image\/webp;base64,/);
    // Next inlines this into the HTML for every image; keep it tiny.
    expect(derived.blur_data_url.length).toBeLessThan(2000);
  });

  it("derives a hex background colour", async () => {
    const derived = await deriveFromBuffer(fixture);
    expect(derived.bg_color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("never returns GPS data", async () => {
    const derived = await deriveFromBuffer(fixture);
    const keys = Object.keys(derived.exif ?? {});
    expect(keys.filter((k) => k.toLowerCase().includes("gps"))).toEqual([]);
    expect(derived.exif === null || "camera" in derived.exif).toBe(true);
  });

  it("rejects a buffer that is not an image", async () => {
    await expect(deriveFromBuffer(Buffer.from("not an image"))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/photos/derive.test.ts`
Expected: FAIL — cannot resolve `./derive`.

- [ ] **Step 3: Implement `src/lib/photos/derive.ts`**

Key points for the implementer: `sharp().stats()` returns a `dominant` `{r,g,b}`; `metadata()` returns possibly-undefined `width`/`height`, so guard rather than assert. `exifr.parse(buffer, {...})` is given an explicit **allowlist** of tags — that is what makes GPS exclusion structural rather than a filter someone can forget.

```ts
import exifr from "exifr";
import sharp from "sharp";

export interface PhotoExif {
  camera?: string;
  lens?: string;
  focal_length?: string;
  aperture?: string;
  shutter?: string;
  iso?: number;
  taken_at?: string;
}

export interface DerivedPhoto {
  width: number;
  height: number;
  blur_data_url: string;
  bg_color: string;
  exif: PhotoExif | null;
}

/** Width of the inlined placeholder, matching what next/image generates. */
const BLUR_WIDTH = 8;

function toHex(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");
}

function formatShutter(seconds: number): string {
  return seconds >= 1 ? `${seconds} s` : `1/${Math.round(1 / seconds)} s`;
}

/**
 * An allowlist, not a denylist. Nothing outside these tags can reach the
 * database, so GPS cannot leak through a forgotten filter later.
 */
const EXIF_PICK = [
  "Make",
  "Model",
  "LensModel",
  "FocalLength",
  "FNumber",
  "ExposureTime",
  "ISO",
  "DateTimeOriginal",
] as const;

async function readExif(buffer: Buffer): Promise<PhotoExif | null> {
  let raw: Record<string, unknown> | undefined;
  try {
    raw = (await exifr.parse(buffer, { pick: [...EXIF_PICK] })) as
      | Record<string, unknown>
      | undefined;
  } catch {
    return null; // A photo without readable EXIF is still a fine photo.
  }
  if (!raw) return null;

  const make = typeof raw["Make"] === "string" ? raw["Make"].trim() : "";
  const model = typeof raw["Model"] === "string" ? raw["Model"].trim() : "";
  const focal = raw["FocalLength"];
  const aperture = raw["FNumber"];
  const shutter = raw["ExposureTime"];
  const iso = raw["ISO"];
  const taken = raw["DateTimeOriginal"];

  const exif: PhotoExif = {};
  const camera = [make, model].filter(Boolean).join(" ");
  if (camera) exif.camera = camera;
  if (typeof raw["LensModel"] === "string") exif.lens = raw["LensModel"];
  if (typeof focal === "number") exif.focal_length = `${Math.round(focal)} mm`;
  if (typeof aperture === "number") exif.aperture = `f/${aperture}`;
  if (typeof shutter === "number") exif.shutter = formatShutter(shutter);
  if (typeof iso === "number") exif.iso = iso;
  if (taken instanceof Date) exif.taken_at = taken.toISOString();

  return Object.keys(exif).length > 0 ? exif : null;
}

export async function deriveFromBuffer(buffer: Buffer): Promise<DerivedPhoto> {
  const image = sharp(buffer, { failOn: "error" });
  const metadata = await image.metadata();
  const { width, height } = metadata;
  if (!width || !height) {
    throw new Error("Could not read the image dimensions.");
  }

  const blur = await image
    .clone()
    .resize(BLUR_WIDTH, undefined, { fit: "inside" })
    .webp({ quality: 40 })
    .toBuffer();

  const { dominant } = await image.clone().stats();

  return {
    width,
    height,
    blur_data_url: `data:image/webp;base64,${blur.toString("base64")}`,
    bg_color: `#${toHex(dominant.r)}${toHex(dominant.g)}${toHex(dominant.b)}`,
    exif: await readExif(buffer),
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/photos/derive.test.ts` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/photos/derive.ts src/lib/photos/derive.test.ts
git commit -m "Derive dimensions, blur, colour and EXIF from an uploaded photo"
```

---

### Task 3: Photo repository and row mapping

**Files:**
- Create: `src/lib/photos/types.ts`
- Create: `src/lib/photos/map.ts`
- Create: `src/lib/photos/repository.ts`
- Test: `src/lib/photos/map.test.ts`

**Interfaces:**
- Consumes: `PhotoExif` from Task 2.
- Produces:

```ts
// types.ts
export interface PhotoRow {
  id: string;
  blob_url: string;
  width: number;
  height: number;
  blur_data_url: string;
  bg_color: string;
  title: string;
  description: string;
  location: string | null;
  exif: PhotoExif | null;
  author_slug: string;
  author_name: string;
  author_site_url: string | null;
}

// map.ts
export function toGalleryImage(row: PhotoRow): GalleryImage;

// repository.ts
export function listPublishedPhotos(authorSlug?: string): Promise<PhotoRow[]>;
export function listPhotosByAuthor(contributorId: string): Promise<OwnPhotoRow[]>;
export function insertDraftPhoto(input: DraftPhotoInput): Promise<string>;
export function publishPhoto(id: string, input: PublishInput, actor: Contributor): Promise<PhotoRow | null>;
export function setPublished(id: string, published: boolean, actor: Contributor): Promise<string | null>;
export function setOpener(id: string): Promise<void>;
```

- [ ] **Step 1: Write the failing test for the mapping**

The mapping is the load-bearing piece — it is what lets the untouched carousel render a database row.

`src/lib/photos/map.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toGalleryImage } from "./map";
import type { PhotoRow } from "./types";

const row: PhotoRow = {
  id: "abc123",
  blob_url: "https://example.public.blob.vercel-storage.com/photos/abc123.jpg",
  width: 4000,
  height: 2667,
  blur_data_url: "data:image/webp;base64,AAAA",
  bg_color: "#2a6b7c",
  title: "Bali, Indonesia",
  description: "Aerial view of tale waves",
  location: null,
  exif: { camera: "SONY ILCE-7M4", iso: 100 },
  author_slug: "anna-weber",
  author_name: "Anna Weber",
  author_site_url: "https://anna.example",
};

describe("toGalleryImage", () => {
  it("shapes src the way next/image expects a static import", () => {
    const image = toGalleryImage(row);
    expect(image.src).toEqual({
      src: row.blob_url,
      width: 4000,
      height: 2667,
      blurDataURL: "data:image/webp;base64,AAAA",
    });
  });

  it("carries the credit through so the viewer can attribute the photo", () => {
    const image = toGalleryImage(row);
    expect(image.author).toEqual({
      slug: "anna-weber",
      name: "Anna Weber",
      siteUrl: "https://anna.example",
    });
  });

  it("keeps id as a string so it matches the image_views key", () => {
    expect(toGalleryImage(row).id).toBe("abc123");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/photos/map.test.ts`
Expected: FAIL — cannot resolve `./map`.

- [ ] **Step 3: Widen `GalleryImage` in `src/data/galleryData.ts`**

`id` becomes `string` (it was `number`), `src` becomes a plain `StaticImageData`-shaped object, and `author`/`location`/`exif` are added. Delete the 15 static imports and the `galleryImages` constant in the same edit — Task 4 replaces every consumer.

```ts
import type { PhotoExif } from "@/lib/photos/derive";

export interface GalleryAuthor {
  slug: string;
  name: string;
  siteUrl: string | null;
}

export interface GalleryImage {
  /** nanoid; also the key used by the image_views table. */
  id: string;
  /**
   * Shaped exactly like a static import. next/image only needs
   * `src`/`width`/`height`/`blurDataURL`, so a database row can stand in for a
   * build-time import and every consumer below keeps working unchanged.
   */
  src: { src: string; width: number; height: number; blurDataURL: string };
  title: string;
  description: string;
  bgColor: string;
  location: string | null;
  exif: PhotoExif | null;
  author: GalleryAuthor;
}
```

- [ ] **Step 4: Implement `src/lib/photos/map.ts`**

```ts
import type { GalleryImage } from "@/data/galleryData";
import type { PhotoRow } from "./types";

/** The single place snake_case database columns become camelCase UI props. */
export function toGalleryImage(row: PhotoRow): GalleryImage {
  return {
    id: row.id,
    src: {
      src: row.blob_url,
      width: row.width,
      height: row.height,
      blurDataURL: row.blur_data_url,
    },
    title: row.title,
    description: row.description,
    bgColor: row.bg_color,
    location: row.location,
    exif: row.exif,
    author: {
      slug: row.author_slug,
      name: row.author_name,
      siteUrl: row.author_site_url,
    },
  };
}
```

- [ ] **Step 5: Implement `src/lib/photos/repository.ts`**

Ordering is `is_opener DESC, published_at DESC` — the pinned opener first, then newest. Authorisation is enforced here, in SQL, not in the caller: a contributor's `UPDATE` carries `AND author_id = ...` unless the actor is the owner, so a forged id cannot touch someone else's row.

```ts
import { nanoid } from "nanoid";
import { sql } from "@/lib/database";
import type { PhotoExif } from "./derive";
import type { PhotoRow } from "./types";

const SELECT_FEED = `
  SELECT p.id, p.blob_url, p.width, p.height, p.blur_data_url, p.bg_color,
         p.title, p.description, p.location, p.exif,
         c.slug AS author_slug, c.display_name AS author_name,
         c.site_url AS author_site_url
  FROM photos p
  JOIN contributors c ON c.id = p.author_id
  WHERE p.published_at IS NOT NULL
`;

export async function listPublishedPhotos(
  authorSlug?: string,
): Promise<PhotoRow[]> {
  const rows = authorSlug
    ? await sql.query(
        `${SELECT_FEED} AND c.slug = $1 ORDER BY p.is_opener DESC, p.published_at DESC`,
        [authorSlug],
      )
    : await sql.query(
        `${SELECT_FEED} ORDER BY p.is_opener DESC, p.published_at DESC`,
      );
  return rows as PhotoRow[];
}

export interface DraftPhotoInput {
  blob_url: string;
  blob_pathname: string;
  width: number;
  height: number;
  blur_data_url: string;
  bg_color: string;
  exif: PhotoExif | null;
  author_id: string;
}

export async function insertDraftPhoto(input: DraftPhotoInput): Promise<string> {
  const id = nanoid(12);
  await sql`
    INSERT INTO photos (id, blob_url, blob_pathname, width, height,
                        blur_data_url, bg_color, title, description, exif, author_id)
    VALUES (${id}, ${input.blob_url}, ${input.blob_pathname}, ${input.width},
            ${input.height}, ${input.blur_data_url}, ${input.bg_color},
            '', '', ${JSON.stringify(input.exif)}::jsonb, ${input.author_id});
  `;
  return id;
}
```

The remaining functions (`listPhotosByAuthor`, `publishPhoto`, `setPublished`, `setOpener`) follow the same shape; each owner-only function checks `actor.role === "owner"` before widening its `WHERE` clause. `setOpener` runs `UPDATE photos SET is_opener = (id = $1)` in a single statement so the "at most one opener" rule cannot be violated by a partial failure.

- [ ] **Step 6: Run the tests**

Run: `npm test` → PASS. `npm run typecheck` will still fail here because Task 4 has not rewired the consumers yet; that is expected and is fixed in the next task.

- [ ] **Step 7: Commit**

```bash
git add src/lib/photos src/data/galleryData.ts
git commit -m "Map photo rows into the shape next/image already understands"
```

---

### Task 4: Reading path — server pages and carousel props

**Files:**
- Modify: `src/data/galleryData.ts` (add `getGalleryImages`)
- Modify: `src/app/page.tsx`
- Create: `src/app/by/[slug]/page.tsx`
- Create: `src/components/gallery/EmptyGallery.tsx`
- Modify: `src/components/gallery/ImageCarousel.tsx`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: `listPublishedPhotos`, `toGalleryImage`.
- Produces: `getGalleryImages(authorSlug?: string): Promise<GalleryImage[]>`; `<ImageCarousel images={...} />`.

- [ ] **Step 1: Add the loader to `src/data/galleryData.ts`**

```ts
import { toGalleryImage } from "@/lib/photos/map";
import { listPublishedPhotos } from "@/lib/photos/repository";

export async function getGalleryImages(
  authorSlug?: string,
): Promise<GalleryImage[]> {
  try {
    return (await listPublishedPhotos(authorSlug)).map(toGalleryImage);
  } catch (error) {
    // A gallery that renders empty beats a gallery that 500s.
    console.error("Failed to load gallery images:", error);
    return [];
  }
}
```

- [ ] **Step 2: Make `ImageCarousel` take its images as a prop**

Delete `import { galleryImages } from "@/data/galleryData";` and add `images` to `ImageCarouselProps`. Then replace every one of the six `galleryImages` references (lines 44, 104, 106, 160, 182, 193) with `images`. Line 104 currently reads:

```ts
const currentImage = galleryImages[currentIndex] ?? galleryImages[0];
```

`noUncheckedIndexedAccess` made that `?? galleryImages[0]` safe only because the constant was typed as a non-empty tuple. An array from a query has no such guarantee, so it becomes:

```ts
const currentImage = images[currentIndex] ?? images[0];
if (!currentImage) return null; // page.tsx renders EmptyGallery before this
```

- [ ] **Step 3: Make `page.tsx` an async Server Component**

```tsx
import { EmptyGallery } from "@/components/gallery/EmptyGallery";
import { ImageCarousel } from "@/components/gallery/ImageCarousel";
import { getGalleryImages } from "@/data/galleryData";

/** Statically rendered, refreshed hourly, and revalidated on publish. */
export const revalidate = 3600;

export default async function Home() {
  const images = await getGalleryImages();
  if (images.length === 0) return <EmptyGallery />;
  return <ImageCarousel images={images} />;
}
```

- [ ] **Step 4: Add `src/app/by/[slug]/page.tsx`**

Same shape, plus a `notFound()` when the contributor has nothing published, and `generateMetadata` giving the page the photographer's name — this page is what a contributor shares, so its title and OG image matter.

- [ ] **Step 5: Allow the blob hostname in `next.config.ts`**

```ts
images: {
  qualities: [75, 95],
  formats: ["image/avif", "image/webp"],
  minimumCacheTTL: 31_536_000,
  remotePatterns: [
    {
      protocol: "https",
      // Blob pathnames are unique per upload and never rewritten, so the
      // year-long optimiser TTL above stays correct for remote photos too.
      hostname: "*.public.blob.vercel-storage.com",
      pathname: "/photos/**",
    },
  ],
},
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck` → PASS (this is the task that makes it pass again).
Run: `npm run lint` → PASS.
Run: `npm run build` → succeeds; `/` renders the empty state because no photos exist yet.

- [ ] **Step 7: Commit**

```bash
git add src/app src/components src/data next.config.ts
git commit -m "Feed the carousel from the database instead of static imports"
```

---

### Task 5: Import the existing 15 photos

Without this the site is empty and every later task is untestable. It is also the proof that the derivation pipeline handles real files.

**Files:**
- Create: `scripts/import-assets.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the script**

Creates the owner contributor if absent, then for each file in `src/assets`: read, derive, `put()` to Blob at `photos/<nanoid>.<ext>`, insert a row published at a timestamp that preserves the current gallery order, and carry across the hand-picked `title`/`description`/`bgColor` from git history rather than the derived colour — those were authored, and the derived dominant colour is only a fallback for photos nobody has tuned.

Guard the whole thing with a `SELECT count(*) FROM photos` so re-running does not duplicate.

- [ ] **Step 2: Run it**

Run: `npm run db:import-assets`
Expected: 15 `uploaded ...` lines, then `Imported 15 photos.`
Re-run: `Photos already imported; nothing to do.`

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open `http://localhost:3000`. All 15 photos render, in the original order, with blur placeholders and no layout shift. Confirm in DevTools that images are served from `/_next/image?url=https%3A%2F%2F...blob.vercel-storage.com...`.

- [ ] **Step 4: Delete the static assets**

`git rm -r src/assets` once the browser check passes. The photos now live in Blob; keeping 40 MB of duplicates in git serves nothing. (`src/assets/waves.jpg` is a test fixture in Task 2 — move that one file to `tests/fixtures/waves.jpg` and update the test's path first.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Import the original fifteen photos into Blob and Postgres"
```

---

### Task 6: Auth core — tokens and sessions

**Files:**
- Create: `src/lib/auth/tokens.ts`
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/auth/contributors.ts`
- Test: `src/lib/auth/tokens.test.ts`

**Interfaces:**
- Produces:

```ts
export function generateSecret(): string;              // 32 random bytes, base64url
export function hashSecret(secret: string): string;    // sha256 hex
export function mintLoginToken(email: string): Promise<string | null>;
export function consumeLoginToken(secret: string): Promise<Contributor | null>;
export function createSession(contributorId: string): Promise<string>;
export function getCurrentContributor(): Promise<Contributor | null>;
export function destroySession(): Promise<void>;
```

- [ ] **Step 1: Write the failing test for the pure parts**

```ts
import { describe, expect, it } from "vitest";
import { generateSecret, hashSecret } from "./tokens";

describe("login secrets", () => {
  it("generates a high-entropy url-safe secret", () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("never repeats", () => {
    const secrets = new Set(Array.from({ length: 500 }, generateSecret));
    expect(secrets.size).toBe(500);
  });

  it("hashes deterministically and irreversibly", () => {
    const secret = generateSecret();
    expect(hashSecret(secret)).toBe(hashSecret(secret));
    expect(hashSecret(secret)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSecret(secret)).not.toContain(secret);
  });
});
```

- [ ] **Step 2: Run it and watch it fail.** `npx vitest run src/lib/auth/tokens.test.ts`

- [ ] **Step 3: Implement.** `randomBytes(32).toString("base64url")` and `createHash("sha256").update(secret).digest("hex")`, both from `node:crypto`.

The two statements that carry the security of the whole feature:

```ts
// Single-use enforced by the database, not by a read-then-write in JS.
const rows = await sql`
  UPDATE login_tokens SET used_at = now()
  WHERE token_hash = ${hashSecret(secret)}
    AND used_at IS NULL
    AND expires_at > now()
  RETURNING contributor_id;
`;
```

```ts
// Revoked contributors cannot open a session even with a valid token.
const rows = await sql`
  SELECT id, email, slug, display_name, site_url, role
  FROM contributors WHERE id = ${contributorId} AND revoked_at IS NULL;
`;
```

`getCurrentContributor()` reads the `gallery_session` cookie via `cookies()` from `next/headers`, hashes it, and joins `sessions` to `contributors` with `expires_at > now() AND revoked_at IS NULL`. Cookie options: `httpOnly: true`, `sameSite: "lax"`, `secure: process.env["NODE_ENV"] === "production"`, `path: "/"`, 30-day `maxAge`.

- [ ] **Step 4: Run the tests** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth
git commit -m "Add single-use magic-link tokens and opaque server sessions"
```

---

### Task 7: Sign-in flow

**Files:**
- Create: `src/lib/auth/email.ts`
- Create: `src/app/contribute/page.tsx`
- Create: `src/app/contribute/actions.ts`
- Create: `src/app/contribute/verify/route.ts`
- Create: `src/lib/rate-limit.ts`
- Test: `src/lib/rate-limit.test.ts`

- [ ] **Step 1: Write the rate-limit test** — 5 requests per 15 minutes per key, sixth rejected, window expiry releases it. In-memory `Map`, which is honest for a ten-person allowlist and documented as such (per-instance under Fluid Compute; the single-use token is the real defence, this only blunts enumeration).

- [ ] **Step 2: Implement the email adapter**

```ts
/**
 * One seam, one provider decision. Development prints the link to the server
 * console so the whole flow is testable with nothing provisioned.
 */
export async function sendLoginEmail(to: string, url: string): Promise<void> {
  const apiKey = process.env["EMAIL_API_KEY"];
  if (!apiKey) {
    console.log(`\n  Magic link for ${to}:\n  ${url}\n`);
    return;
  }
  // Provisioned provider goes here — see docs/CONTRIBUTING-PHOTOS.md.
}
```

- [ ] **Step 3: Build the sign-in page and server action.** The action always returns the same "Check your email" result whether or not the address is on the list.

- [ ] **Step 4: Build `verify/route.ts`.** Consume token → create session → set cookie → `redirect("/contribute/photos")`. On failure redirect to `/contribute?error=expired` — never leak whether the token existed.

- [ ] **Step 5: Verify manually.** `npm run dev`, insert yourself as owner, request a link, copy it from the console, follow it, confirm you land on the dashboard, then confirm following the same link a second time fails.

- [ ] **Step 6: Commit**

---

### Task 8: Upload and publish

**Files:**
- Create: `src/app/api/uploads/token/route.ts`
- Create: `src/app/api/photos/draft/route.ts`
- Create: `src/app/contribute/photos/page.tsx`
- Create: `src/app/contribute/photos/UploadForm.tsx`
- Create: `src/app/contribute/photos/actions.ts`

- [ ] **Step 1: Token route.** `handleUpload` with `onBeforeGenerateToken` requiring a session and returning `allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"]`, `maximumSizeInBytes: 25 * 1024 * 1024`, `addRandomSuffix: true`. `onUploadCompleted` is deliberately omitted — see the spec.

- [ ] **Step 2: Draft route.** Session required. Fetch the blob, `deriveFromBuffer`, `insertDraftPhoto`, return the id and derived values. On derive failure `del(blobUrl)` before returning 422, so a rejected upload leaves no orphan.

- [ ] **Step 3: Upload form.** `upload(pathname, file, { access: "public", handleUploadUrl: "/api/uploads/token", multipart: true, onUploadProgress })`. `multipart: true` matters: photographers upload 20 MB files and a single PUT that fails at 90% has to start over.

- [ ] **Step 4: Publish action.** Validates non-empty title and description, sets `published_at`, calls `revalidatePath("/")` and `revalidatePath(\`/by/${slug}\`)`.

- [ ] **Step 5: Verify the full loop** — upload a photo not already in the gallery, publish it, confirm it appears first on `/` and on `/by/<your-slug>`, with correct EXIF and no GPS.

- [ ] **Step 6: Commit**

---

### Task 9: Credit and EXIF in the viewer

**Files:**
- Modify: `src/components/gallery/carousel/ImageInfo.tsx`
- Create: `src/components/gallery/carousel/PhotoCredit.tsx`

- [ ] **Step 1: Build `PhotoCredit`** — "by {name}" linking to `/by/{slug}`, plus an outbound link to `siteUrl` with `rel="noopener noreferrer"` when present. Match the existing glass treatment; reuse `glass-button.tsx` tokens rather than inventing a new surface.
- [ ] **Step 2: Add a restrained EXIF strip** — camera · focal · aperture · shutter · ISO, only the fields present, hidden below `sm`.
- [ ] **Step 3: Verify** the credit is keyboard reachable and has a visible focus ring (Biome's a11y rules will catch most, but check by tabbing).
- [ ] **Step 4: Commit**

---

### Task 10: Owner tools

**Files:**
- Create: `src/app/contribute/admin/page.tsx`
- Create: `src/app/contribute/admin/actions.ts`

- [ ] **Step 1: Invite form** — email, display name, optional site URL; slug generated from the display name and de-duplicated with a numeric suffix.
- [ ] **Step 2: Contributor list** with revoke/restore.
- [ ] **Step 3: Photo list** with unpublish and "pin as opener".
- [ ] **Step 4: Guard every action** with `actor.role === "owner"`, returning 403 rather than hiding buttons only.
- [ ] **Step 5: Verify** a non-owner session cannot reach `/contribute/admin` or invoke its actions directly.
- [ ] **Step 6: Commit**

---

### Task 11: Documentation and provisioning checklist

**Files:**
- Modify: `README.md`
- Create: `docs/CONTRIBUTING-PHOTOS.md`
- Modify: `docs/superpowers/specs/2026-08-15-community-contributors-design.md` (record the `/by/[slug]` deviation)

- [ ] **Step 1: README** — new env vars, `db:migrate`, `db:import-assets`, `test`.
- [ ] **Step 2: `CONTRIBUTING-PHOTOS.md`** — what a contributor sees, and the operator checklist: provision an email provider, set `EMAIL_API_KEY` and `EMAIL_FROM`, seed the first owner.
- [ ] **Step 3: Full verification** — `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, all passing.
- [ ] **Step 4: Commit**

---

## Self-Review

**Spec coverage.** §1 storage/schema → Tasks 1, 4, 5. §2 identity → Tasks 6, 7. §3 upload pipeline → Task 8. §4 reading path → Tasks 3, 4, 9. §5 ownership → Task 10 (per-row authorisation lands in Task 3's repository, where it belongs). §6 testing → Tasks 1, 2, 3, 6, 7. Migration of the existing photos was implied by §1 but had no explicit section; Task 5 covers it. No uncovered requirement.

**Placeholder scan.** Tasks 8–10 describe steps in prose rather than full code blocks. This is deliberate and bounded: each one names the exact file, the exact API call with its arguments, and the verification, and they are UI assembly over interfaces that Tasks 1–7 define completely. Tasks 1–4 and 6, where the correctness risk actually lives, carry complete code.

**Type consistency.** `PhotoRow` (snake_case, database-shaped) is defined in Task 3 and consumed by Tasks 3, 4, 10. `GalleryImage` (camelCase, UI-shaped) is redefined in Task 3 Step 3 and consumed by Tasks 4 and 9. `PhotoExif` is defined in Task 2 and imported by both. `toGalleryImage` is the only crossing point. `GalleryImage.id` changes from `number` to `string` in Task 3 and every consumer is rewired in Task 4 — checked against all five files that reference `GalleryImage`.

**One risk worth naming for the executor.** Task 3 Step 3 breaks the build, and it stays broken until Task 4 Step 6. That is intentional — splitting the type change from its consumers would mean maintaining two shapes at once — but do not stop at the end of Task 3 believing something has gone wrong.
