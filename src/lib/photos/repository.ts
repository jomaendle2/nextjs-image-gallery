import { nanoid } from "nanoid";
import type { Contributor } from "@/lib/auth/types";
import { isOwner } from "@/lib/auth/types";
import { sql } from "@/lib/database";
import type {
  DraftPhotoInput,
  OwnPhotoRow,
  PhotoRow,
  PublishInput,
} from "./types";

/** Length chosen so ids stay short in URLs while collisions stay negligible. */
const ID_LENGTH = 12;

const FEED_COLUMNS = `
  p.id, p.blob_url, p.width, p.height, p.blur_data_url, p.bg_color,
  p.title, p.description, p.location, p.exif,
  c.slug AS author_slug, c.display_name AS author_name,
  c.site_url AS author_site_url
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

/** A contributor's own photos, drafts included, newest work first. */
export async function listOwnPhotos(
  contributorId: string,
): Promise<OwnPhotoRow[]> {
  const rows = await sql`
    SELECT p.id, p.blob_url, p.width, p.height, p.blur_data_url, p.bg_color,
           p.title, p.description, p.location, p.exif, p.published_at,
           p.is_opener, p.author_id,
           c.display_name AS author_name, c.slug AS author_slug
    FROM photos p
    JOIN contributors c ON c.id = p.author_id
    WHERE p.author_id = ${contributorId}
    ORDER BY p.created_at DESC;
  `;
  return rows as OwnPhotoRow[];
}

/** Every photo on the site, for the owner's moderation view. */
export async function listAllPhotos(): Promise<OwnPhotoRow[]> {
  const rows = await sql`
    SELECT p.id, p.blob_url, p.width, p.height, p.blur_data_url, p.bg_color,
           p.title, p.description, p.location, p.exif, p.published_at,
           p.is_opener, p.author_id,
           c.display_name AS author_name, c.slug AS author_slug
    FROM photos p
    JOIN contributors c ON c.id = p.author_id
    ORDER BY p.created_at DESC;
  `;
  return rows as OwnPhotoRow[];
}

export async function getOwnPhoto(
  id: string,
  actor: Contributor,
): Promise<OwnPhotoRow | undefined> {
  const rows = await listOwnPhotos(actor.id);
  const own = rows.find((row) => row.id === id);
  if (own || !isOwner(actor)) {
    return own;
  }
  return (await listAllPhotos()).find((row) => row.id === id);
}

export async function insertDraftPhoto(
  input: DraftPhotoInput,
): Promise<string> {
  const id = nanoid(ID_LENGTH);
  await sql`
    INSERT INTO photos (id, blob_url, blob_pathname, width, height,
                        blur_data_url, bg_color, exif, author_id)
    VALUES (${id}, ${input.blob_url}, ${input.blob_pathname}, ${input.width},
            ${input.height}, ${input.blur_data_url}, ${input.bg_color},
            ${JSON.stringify(input.exif)}::jsonb, ${input.author_id});
  `;
  return id;
}

/**
 * Authorisation lives in the WHERE clause, not in the caller. A contributor's
 * update carries `AND author_id = ...`, so a forged id updates zero rows
 * instead of someone else's photo; the owner's does not, so they can moderate.
 * Returns the author's slug for cache revalidation, or null if nothing matched.
 */
export async function publishPhoto(
  id: string,
  input: PublishInput,
  actor: Contributor,
): Promise<string | null> {
  const rows = isOwner(actor)
    ? await sql`
        UPDATE photos p SET title = ${input.title},
               description = ${input.description},
               location = ${input.location},
               bg_color = ${input.bg_color},
               published_at = COALESCE(p.published_at, now())
        FROM contributors c WHERE c.id = p.author_id AND p.id = ${id}
        RETURNING c.slug;`
    : await sql`
        UPDATE photos p SET title = ${input.title},
               description = ${input.description},
               location = ${input.location},
               bg_color = ${input.bg_color},
               published_at = COALESCE(p.published_at, now())
        FROM contributors c WHERE c.id = p.author_id AND p.id = ${id}
          AND p.author_id = ${actor.id}
        RETURNING c.slug;`;
  return (rows[0]?.["slug"] as string | undefined) ?? null;
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

export async function deletePhoto(
  id: string,
  actor: Contributor,
): Promise<string | null> {
  const rows = isOwner(actor)
    ? await sql`DELETE FROM photos WHERE id = ${id} RETURNING blob_pathname;`
    : await sql`DELETE FROM photos WHERE id = ${id}
                AND author_id = ${actor.id} RETURNING blob_pathname;`;
  return (rows[0]?.["blob_pathname"] as string | undefined) ?? null;
}

/**
 * One statement, so "at most one opener" cannot be broken by a partial
 * failure between clearing the old flag and setting the new one.
 */
export async function setOpener(id: string): Promise<void> {
  await sql`UPDATE photos SET is_opener = (id = ${id});`;
}
