import { nanoid } from "nanoid";
import type { Contributor } from "@/lib/auth/types";
import { isOwner } from "@/lib/auth/types";
import { sql } from "@/lib/database";
import { coarsen } from "./coarsen";
/*
 * `exifParam` comes from `types.ts`, not from `derive.ts` where the rest of
 * the EXIF handling lives. Importing it from `derive.ts` is a value import of
 * a module that loads `sharp` and `exifr`, and the file tracer follows that
 * into the deployed bundle of every route this repository reaches — which is
 * most of them. See the note on `exifParam` itself.
 */
import {
  type DraftPhotoInput,
  exifParam,
  type GlobePointRow,
  type OwnPhotoRow,
  type PhotoRow,
  type Pin,
  type PublishInput,
} from "./types";

/** Length chosen so ids stay short in URLs while collisions stay negligible. */
const ID_LENGTH = 12;

/*
 * What a public page's payload may carry.
 *
 * `coarse_lat`/`coarse_lng` are here and the exact pair is not, for the same
 * reason `precise_location` is not: this list *is* the member gate. A column
 * absent from it cannot leak by being rendered conditionally, because it was
 * never sent. `security.test.ts` asserts both halves of that sentence.
 *
 * `has_member_details` is the one thing about those columns that may cross:
 * a single generated bit saying whether a member would see anything here, so
 * `MemberDetails` can stop offering the membership under photographs that
 * have nothing behind it. The derivation is in the table — see the migration
 * — precisely so that this list does not have to name what it withholds.
 *
 * **Why the `to_jsonb` detour, and what breaks without it.** A bare
 * `p.has_member_details` raises `42703` — undefined column — until the
 * migration has run, and that error lands on the *feed* query: not one
 * corner of one page, but every gallery page at once, plus the sitemap and
 * the feeds. Preview, development and production still share one Neon
 * database and `scripts/migrate.mts` now refuses to migrate outside
 * production, so the window where this code is deployed and the column is
 * not is real, expected, and lasts as long as the branch does.
 *
 * `to_jsonb(p)` closes it without a schema probe and without a new pattern:
 * a row turned into jsonb has whatever keys it has, and `->>` on a missing
 * key is null rather than an error, so the `COALESCE` reports `false` — the
 * safe answer, which is "make no offer". No extra round trip, no cached
 * failure, no branch.
 *
 * Do not simplify it back to the bare column until the migration has landed
 * in the shared database. When it has, this line may become
 * `p.has_member_details` and this paragraph should go with it. Its cost until
 * then is one jsonb serialisation of each row, blur placeholder included,
 * which is measurable at three hundred photographs and invisible at fourteen.
 */
const FEED_COLUMNS = `
  p.id, COALESCE(p.display_url, p.blob_url) AS blob_url,
  p.width, p.height, p.blur_data_url, p.bg_color,
  p.title, p.description, p.location, p.exif, p.published_at,
  p.coarse_lat, p.coarse_lng,
  COALESCE((to_jsonb(p) ->> 'has_member_details')::boolean, false)
    AS has_member_details,
  c.slug AS author_slug, c.display_name AS author_name,
  c.site_url AS author_site_url
`;

/*
 * What a photographer sees of their own work, and what the owner sees of
 * everybody's.
 *
 * The two queries below were byte-identical select lists maintained by hand,
 * which is precisely the arrangement in which one of them grows a column and
 * the other does not. Adding four at once was the moment to stop, following
 * the `FEED_COLUMNS` precedent that already existed two lines up.
 *
 * Unlike `FEED_COLUMNS` this one selects everything, exact pin included.
 * That is not a gap in the gate: both callers are behind a session, and one
 * of them is the person who marked the point.
 */
const OWN_COLUMNS = `
  p.id, COALESCE(p.display_url, p.blob_url) AS blob_url,
  p.width, p.height, p.blur_data_url, p.bg_color,
  p.title, p.description, p.location, p.exif, p.published_at,
  p.is_opener, p.precise_location, p.technique, p.is_specimen,
  p.precise_lat, p.precise_lng, p.coarse_lat, p.coarse_lng,
  p.author_id,
  c.display_name AS author_name, c.slug AS author_slug
`;

/*
 * The pinned opener first, then newest published first. Matches the partial
 * index `photos_feed_idx`, so the feed never scans drafts.
 */
const FEED_ORDER = "ORDER BY p.is_opener DESC, p.published_at DESC";

export async function listPublishedPhotos(
  authorSlug?: string,
): Promise<PhotoRow[]> {
  const rows =
    authorSlug === undefined
      ? await sql.query(
          `SELECT ${FEED_COLUMNS}
           FROM photos p JOIN contributors c ON c.id = p.author_id
           WHERE p.published_at IS NOT NULL AND c.revoked_at IS NULL
           ${FEED_ORDER}`,
        )
      : await sql.query(
          `SELECT ${FEED_COLUMNS}
           FROM photos p JOIN contributors c ON c.id = p.author_id
           WHERE p.published_at IS NOT NULL AND c.revoked_at IS NULL
             AND c.slug = $1
           ${FEED_ORDER}`,
          [authorSlug],
        );
  return rows as PhotoRow[];
}

/**
 * How many are waiting, without the rows.
 *
 * The admin page and the cron reminder both want only a number, and
 * `listUnannouncedPhotos` returns every `FEED_COLUMNS` field — including a
 * base64 blur placeholder per photograph. Fetching a hundred rows to call
 * `.length` on them is the kind of waste that never announces itself.
 */
export async function countUnannouncedPhotos(): Promise<number> {
  const rows = await sql`
    SELECT count(*)::int AS n
    FROM photos p JOIN contributors c ON c.id = p.author_id
    WHERE p.published_at IS NOT NULL AND p.announced_at IS NULL
      AND c.revoked_at IS NULL;
  `;
  return Number(rows[0]?.["n"] ?? 0);
}

/** A contributor's own photos, drafts included, newest work first. */
export async function listOwnPhotos(
  contributorId: string,
): Promise<OwnPhotoRow[]> {
  const rows = await sql.query(
    `SELECT ${OWN_COLUMNS}
     FROM photos p
     JOIN contributors c ON c.id = p.author_id
     WHERE p.author_id = $1
     ORDER BY p.created_at DESC`,
    [contributorId],
  );
  return rows as OwnPhotoRow[];
}

/** Every photo on the site, for the owner's moderation view. */
export async function listAllPhotos(): Promise<OwnPhotoRow[]> {
  const rows = await sql.query(
    `SELECT ${OWN_COLUMNS}
     FROM photos p
     JOIN contributors c ON c.id = p.author_id
     ORDER BY p.created_at DESC`,
  );
  return rows as OwnPhotoRow[];
}

/**
 * What a membership pays for: two sentences and a point.
 *
 * All three are deliberately absent from `FEED_COLUMNS`, so they are not in
 * the payload of any page and cannot leak by being rendered conditionally.
 * The only caller is the route that checks for an active membership first.
 *
 * The pin is the newest of them and the most dangerous. Prose is vague and
 * deniable; an exact coordinate is machine-actionable and republishable in
 * bulk, which is why the route that reads this is rate limited and why the
 * public globe is fed from a separate, coarsened column instead.
 *
 * Returns nulls rather than nothing for a photograph whose photographer has
 * filled in none of them: a member is entitled to know there is nothing to
 * know, which is different from being told they cannot see it.
 */
export async function getMemberDetails(id: string): Promise<{
  precise_location: string | null;
  technique: string | null;
  pin: Pin | null;
} | null> {
  const rows = await sql`
    SELECT p.precise_location, p.technique, p.precise_lat, p.precise_lng
    FROM photos p JOIN contributors c ON c.id = p.author_id
    WHERE p.id = ${id} AND p.published_at IS NOT NULL
      AND c.revoked_at IS NULL;
  `;
  const [row] = rows;
  if (row === undefined) {
    return null;
  }
  /*
   * Both or neither. A photographer who chose the public dot only has a
   * coarse pair and no exact one, and half a coordinate is not a location —
   * so the shape handed to the route is a pin or nothing, rather than two
   * numbers a caller has to remember to check together.
   */
  const lat = row["precise_lat"] as number | null;
  const lng = row["precise_lng"] as number | null;
  return {
    precise_location: (row["precise_location"] as string | null) ?? null,
    technique: (row["technique"] as string | null) ?? null,
    pin: lat === null || lng === null ? null : { lat, lng },
  };
}

/**
 * Every published cell with something in it, for `/globe`.
 *
 * Deliberately not `FEED_COLUMNS`, which would drag a base64 blur
 * placeholder per photograph into a page that draws dots. Five small fields,
 * and the grouping happens in `globe.ts` on the way out.
 *
 * `location` is the photographer's own public string, which is what labels a
 * cell. No reverse geocoding: it would need a sixth processor and would be
 * worse than the words the person who was there chose.
 */
export async function listGlobePoints(): Promise<GlobePointRow[]> {
  const rows = await sql`
    SELECT p.id, p.title, p.location, p.coarse_lat, p.coarse_lng
    FROM photos p JOIN contributors c ON c.id = p.author_id
    WHERE p.published_at IS NOT NULL AND c.revoked_at IS NULL
      AND p.coarse_lat IS NOT NULL AND p.coarse_lng IS NOT NULL
    ORDER BY p.published_at DESC;
  `;
  return rows as GlobePointRow[];
}

/**
 * One photograph per coarsened cell, for the card the expanded globe shows
 * when a mark is pointed at.
 *
 * **Deliberately inside the globe's slice in `src/lib/security.test.ts`,
 * between `listGlobePoints` and `getSpecimenPhoto`.** That test reads the
 * source between those two names and asserts the region reaches no exact
 * coordinate and no base64 placeholder. Both prohibitions are exactly right
 * for this query, so sitting inside the gate is the point rather than an
 * accident: a public image query for the globe must never reach a ten-metre
 * pin, and must never carry a placeholder blob per row.
 *
 * It was first written below `getSpecimenPhoto`, on the argument that an
 * unrelated security test should not arbitrate which columns a thumbnail may
 * select. That was wrong twice over. The two columns it forbids are the two
 * this must not have — and the slice above it runs from `getSpecimenPhoto` to
 * `listUnannouncedPhotos`, so "below" put a coarsened latitude inside the
 * assertion that the *specimen* query has not quietly acquired a coordinate.
 * That test failed, correctly, and this is where the function belongs.
 *
 * Note that the assertion reads raw source rather than stripped code, so this
 * paragraph cannot spell the two column names it is about — `world.test.ts`
 * solved the same problem the other way, by stripping comments before
 * matching, and records why: a check that punishes explaining the rule is a
 * check that gets the explanation deleted. Worth folding in here the next
 * time that file is opened.
 *
 * `bg_color` rather than a placeholder blob is the same argument the
 * `listGlobePoints` docblock makes about payload: a few hundred bytes of
 * base64 per row against seven characters of hex, for a 96px thumbnail that
 * is on screen for as long as a pointer rests on a dot. The gate now holds
 * that decision in place.
 *
 * **One picture per cell, chosen here rather than by the client.**
 * `DISTINCT ON` over the coarsened pair takes the most recently published
 * photograph from each place. Recency rather than random, because the page
 * and this route revalidate on independent clocks: a choice that varied
 * between them would show a different picture depending on which cache
 * answered.
 */
export async function listGlobeThumbnails(): Promise<
  {
    coarse_lat: number;
    coarse_lng: number;
    url: string;
    width: number;
    height: number;
    bg_color: string;
  }[]
> {
  const rows = await sql`
    SELECT DISTINCT ON (p.coarse_lat, p.coarse_lng)
           p.coarse_lat, p.coarse_lng,
           COALESCE(p.display_url, p.blob_url) AS url,
           p.width, p.height, p.bg_color
    FROM photos p JOIN contributors c ON c.id = p.author_id
    WHERE p.published_at IS NOT NULL AND c.revoked_at IS NULL
      AND p.coarse_lat IS NOT NULL AND p.coarse_lng IS NOT NULL
    ORDER BY p.coarse_lat, p.coarse_lng, p.published_at DESC;
  `;
  return rows.map((row) => ({
    coarse_lat: row["coarse_lat"] as number,
    coarse_lng: row["coarse_lng"] as number,
    url: row["url"] as string,
    width: row["width"] as number,
    height: row["height"] as number,
    bg_color: row["bg_color"] as string,
  }));
}

/**
 * One published photograph whose photographer filled in both member fields.
 *
 * For `/membership`, which sells those two fields and until now described
 * them instead of showing one. A specimen is the only honest way to price
 * this: the reader can see the actual sentences a photographer wrote, not a
 * promise about the sentences they might write.
 *
 * This is the one place member-only columns are read for a public page, so
 * the query is the whole gate. It takes no arguments, cannot be steered by
 * request input, and returns exactly one row. The gated per-photograph route
 * is untouched — a reader still cannot get these fields for any photograph
 * they choose, only for the one the gallery chose to show them.
 *
 * Consent, not recency. An earlier version took the most recently annotated
 * photograph, which would have made a photographer's writing public because
 * of when they happened to type it. `is_specimen` is them saying yes, and
 * without it this returns nothing at all.
 *
 * `null` when no photograph qualifies, which is currently every photograph:
 * nobody has opted in and both columns are empty on all sixteen rows. The
 * caller must have something to fall back to.
 */
export async function getSpecimenPhoto(): Promise<{
  id: string;
  title: string;
  location: string | null;
  precise_location: string;
  technique: string;
  display_url: string;
  blur_data_url: string | null;
  width: number;
  height: number;
} | null> {
  const rows = await sql`
    SELECT p.id, p.title, p.location, p.precise_location, p.technique,
           p.display_url, p.blur_data_url, p.width, p.height
    FROM photos p JOIN contributors c ON c.id = p.author_id
    WHERE p.published_at IS NOT NULL
      AND c.revoked_at IS NULL
      AND p.is_specimen
      AND btrim(coalesce(p.precise_location, '')) <> ''
      AND btrim(coalesce(p.technique, '')) <> ''
    ORDER BY p.published_at DESC
    LIMIT 1;
  `;
  const [row] = rows;
  return row === undefined
    ? null
    : {
        id: row["id"] as string,
        title: row["title"] as string,
        location: (row["location"] as string | null) ?? null,
        precise_location: row["precise_location"] as string,
        technique: row["technique"] as string,
        display_url: row["display_url"] as string,
        blur_data_url: (row["blur_data_url"] as string | null) ?? null,
        width: row["width"] as number,
        height: row["height"] as number,
      };
}

/**
 * Published photographs the subscriber list has not been told about yet.
 *
 * Ordered oldest first, which is the opposite of the gallery and correct
 * here: an announcement is read as a catch-up, in the order the work
 * appeared, rather than as a front page where the newest matters most.
 *
 * Revoked contributors are excluded on the same join the feed uses, so
 * revoking somebody also stops their work being announced.
 */
export async function listUnannouncedPhotos(): Promise<PhotoRow[]> {
  const rows = await sql.query(
    `SELECT ${FEED_COLUMNS}
     FROM photos p JOIN contributors c ON c.id = p.author_id
     WHERE p.published_at IS NOT NULL AND p.announced_at IS NULL
       AND c.revoked_at IS NULL
     ORDER BY p.published_at ASC`,
  );
  return rows as PhotoRow[];
}

/**
 * Marks photographs as announced.
 *
 * The caller does this *before* the messages go out. If the send dies
 * halfway through, the choice is between some subscribers receiving a
 * second copy later and some photographs never being announced at all —
 * and the duplicate is the worse outcome. An unannounced photograph is
 * still on the site, in both feeds and in the sitemap; a list that mails
 * people twice is harder to win back.
 */
export async function markAnnounced(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  await sql`UPDATE photos SET announced_at = now() WHERE id = ANY(${ids});`;
}

/**
 * Whether some photo row already points at this blob.
 *
 * Blob URLs of published photographs are public — they are in the markup of
 * every gallery page. Without this check a signed-in contributor could post
 * another photographer's URL to the draft endpoint and receive a row
 * attributed to themselves, which is to say: publish someone else's
 * photograph under their own name, using nothing but a URL they were shown.
 *
 * The blob itself is already restricted to our own host and `photos/` prefix
 * by the caller; this is the second half, and it asks about ownership rather
 * than origin.
 */
export async function blobIsClaimed(pathname: string): Promise<boolean> {
  /*
   * Both pathnames, and the second is the one that mattered.
   *
   * This matched only `blob_pathname` — the original upload, whose URL is
   * never rendered anywhere. What every gallery page puts in its markup is
   * `COALESCE(display_url, blob_url)`, which for every row written since the
   * display copy was introduced is the *display* blob. So the only URL an
   * attacker could actually copy was the only one this could not recognise,
   * and the check had been passing everything through for as long as it has
   * existed.
   */
  const rows = await sql`
    SELECT 1 FROM photos
    WHERE blob_pathname = ${pathname} OR display_pathname = ${pathname}
    LIMIT 1;
  `;
  return rows.length > 0;
}

export async function insertDraftPhoto(
  input: DraftPhotoInput,
): Promise<string> {
  const id = nanoid(ID_LENGTH);
  await sql`
    INSERT INTO photos (id, blob_url, blob_pathname, display_url,
                        display_pathname, width,
                        height, blur_data_url, bg_color, exif, author_id)
    VALUES (${id}, ${input.blob_url}, ${input.blob_pathname},
            ${input.display_url}, ${input.display_pathname}, ${input.width},
            ${input.height}, ${input.blur_data_url}, ${input.bg_color},
            ${exifParam(input.exif)}::jsonb, ${input.author_id});
  `;
  return id;
}

/** What a save did, so the caller can say so. */
export interface SaveResult {
  slug: string;
  live: boolean;
}

/**
 * Authorisation lives in the WHERE clause, not in the caller: a contributor's
 * update carries `AND author_id = ...`, so a forged id updates zero rows
 * instead of somebody else's photograph. The owner's clause is satisfied by
 * the role instead, so they can moderate.
 *
 * `publish` is separate from saving because it was not, and a photographer
 * could not write a title without the photograph going live — so captioning
 * an evening's uploads meant publishing each one into the feed and the
 * announcement queue and pulling it back. Saving a draft leaves
 * `published_at` alone; publishing sets it once and never moves it, so
 * re-publishing does not reorder the gallery.
 */
export async function publishPhoto(
  id: string,
  input: PublishInput,
  actor: Contributor,
  publish: boolean,
): Promise<SaveResult | null> {
  /*
   * Two updates in one statement, because "only one photograph is the public
   * example" is a claim the editor makes to the photographer and therefore
   * has to be true in the table rather than in the label.
   *
   * `cleared` runs only when this save is switching the flag on, and it
   * excludes the row `updated` just touched. If `updated` matched nothing —
   * a forged id, or somebody else's photograph — the subquery is NULL, the
   * comparison is NULL, and no rows are cleared: an unauthorised save cannot
   * knock the real example off the membership page.
   *
   * Last one wins, across the whole gallery rather than per photographer.
   * The page shows one example for the site, so scoping the uniqueness to a
   * contributor would let two of them both believe theirs was the one.
   */
  /*
   * The only place `coarsen` is called, which is what makes the two stored
   * precisions impossible to disagree. A caller submits one point; this
   * derives the public one from it. `security.test.ts` pins the "only place"
   * part, because a second caller is how the exact point and the dot on the
   * globe would drift apart without anybody noticing.
   *
   * Clearing the pin writes four NULLs rather than leaving the old dot
   * behind — a photographer removing a location must actually remove it.
   *
   * `publicOnly` writes the coarse pair and leaves the exact pair null: the
   * globe gains a dot and there is nothing behind the paywall at all. That
   * is the option for somebody whose subject is a nest or a rare plant, and
   * it costs one branch rather than a column.
   */
  const coarse =
    input.pin === null
      ? null
      : coarsen(input.pin.point.lat, input.pin.point.lng);
  const exact =
    input.pin === null || input.pin.publicOnly ? null : input.pin.point;

  const rows = await sql`
    WITH updated AS (
      UPDATE photos p SET title = ${input.title},
             description = ${input.description},
             location = ${input.location},
             precise_location = ${input.precise_location},
             technique = ${input.technique},
             is_specimen = ${input.is_specimen},
             bg_color = ${input.bg_color},
             precise_lat = ${exact?.lat ?? null},
             precise_lng = ${exact?.lng ?? null},
             coarse_lat = ${coarse?.lat ?? null},
             coarse_lng = ${coarse?.lng ?? null},
             published_at = CASE WHEN ${publish}
                                 THEN COALESCE(p.published_at, now())
                                 ELSE p.published_at END
      FROM contributors c WHERE c.id = p.author_id AND p.id = ${id}
        AND (${isOwner(actor)} OR p.author_id = ${actor.id})
      RETURNING p.id, c.slug, p.published_at
    ), cleared AS (
      UPDATE photos SET is_specimen = FALSE
      WHERE ${input.is_specimen} AND is_specimen
        AND id <> (SELECT id FROM updated)
    )
    SELECT slug, published_at IS NOT NULL AS live FROM updated;`;

  const row = rows[0] as Record<string, unknown> | undefined;
  if (row === undefined) {
    return null;
  }
  return { slug: row["slug"] as string, live: row["live"] === true };
}

export async function setPublished(
  id: string,
  published: boolean,
  actor: Contributor,
): Promise<string | null> {
  const publishedAt = published ? new Date().toISOString() : null;
  const rows = isOwner(actor)
    ? await sql`
        UPDATE photos p SET published_at = ${publishedAt}
        FROM contributors c WHERE c.id = p.author_id AND p.id = ${id}
        RETURNING c.slug;`
    : await sql`
        UPDATE photos p SET published_at = ${publishedAt}
        FROM contributors c WHERE c.id = p.author_id AND p.id = ${id}
          AND p.author_id = ${actor.id}
        RETURNING c.slug;`;
  return (rows[0]?.["slug"] as string | undefined) ?? null;
}

/** What a deletion leaves behind for the caller to clean up. */
export interface DeletedPhoto {
  /** The original upload. */
  blob_pathname: string;
  /** The re-encoded copy the gallery actually served, if there was one. */
  display_pathname: string | null;
  /** Whose page needs revalidating — not necessarily the actor's. */
  author_slug: string;
}

/**
 * Removes a photograph and reports what else has to go.
 *
 * Returns three things rather than one, and each fixes a real leak. The
 * display copy is a second blob written at upload; returning only
 * `blob_pathname` orphaned it forever, since nothing referenced it once the
 * row was gone. And the author's slug is not the actor's: the owner may
 * delete anybody's photograph, so revalidating the actor's page left the
 * deleted work on the real author's page and in their feed for an hour.
 *
 * `RETURNING` from the DELETE rather than reading first, so the row cannot
 * change between the two.
 */
export async function deletePhoto(
  id: string,
  actor: Contributor,
): Promise<DeletedPhoto | null> {
  const rows = isOwner(actor)
    ? await sql`DELETE FROM photos p USING contributors c
                WHERE c.id = p.author_id AND p.id = ${id}
                RETURNING p.blob_pathname, p.display_pathname, c.slug;`
    : await sql`DELETE FROM photos p USING contributors c
                WHERE c.id = p.author_id AND p.id = ${id}
                  AND p.author_id = ${actor.id}
                RETURNING p.blob_pathname, p.display_pathname, c.slug;`;

  const [row] = rows;
  if (row === undefined) {
    return null;
  }
  return {
    blob_pathname: row["blob_pathname"] as string,
    display_pathname: (row["display_pathname"] as string | null) ?? null,
    author_slug: row["slug"] as string,
  };
}

/**
 * One statement, so "at most one opener" cannot be broken by a partial
 * failure between clearing the old flag and setting the new one.
 */
export async function setOpener(id: string): Promise<void> {
  await sql`UPDATE photos SET is_opener = (id = ${id});`;
}
