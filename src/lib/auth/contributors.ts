import { nanoid } from "nanoid";
import { sql } from "@/lib/database";
import { normaliseEmail, pickFreeSlug, slugify } from "./slug";
import type { Contributor, ContributorRole } from "./types";

const ID_LENGTH = 12;

const CONTRIBUTOR_COLUMNS = "id, email, slug, display_name, site_url, role";

function firstContributor(rows: Record<string, unknown>[]): Contributor | null {
  const [row] = rows;
  if (!row) {
    return null;
  }
  return {
    id: row["id"] as string,
    email: row["email"] as string,
    slug: row["slug"] as string,
    display_name: row["display_name"] as string,
    site_url: (row["site_url"] as string | null) ?? null,
    role: row["role"] as ContributorRole,
  };
}

export async function getContributorBySlug(
  slug: string,
): Promise<Contributor | null> {
  const rows = await sql.query(
    `SELECT ${CONTRIBUTOR_COLUMNS} FROM contributors
     WHERE slug = $1 AND revoked_at IS NULL`,
    [slug],
  );
  return firstContributor(rows as Record<string, unknown>[]);
}

export async function listContributors(): Promise<
  (Contributor & {
    revoked_at: string | null;
    photo_count: number;
    published_count: number;
  })[]
> {
  /*
   * Two counts, because two callers want different questions answered.
   *
   * The admin table wants everything, drafts included — that is the point of
   * a moderation view. The sitemap wants only what a visitor would find, and
   * using the total there emitted `/by/<slug>` for contributors who had
   * uploaded but published nothing: a 200 rendering `EmptyGallery`, which is
   * exactly the thin page the sitemap's own comment says it excludes.
   */
  const rows = await sql`
    SELECT c.id, c.email, c.slug, c.display_name, c.site_url, c.role,
           c.revoked_at,
           COUNT(p.id)::int AS photo_count,
           COUNT(p.id) FILTER (WHERE p.published_at IS NOT NULL)::int
             AS published_count
    FROM contributors c
    LEFT JOIN photos p ON p.author_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at ASC;
  `;
  return rows as (Contributor & {
    revoked_at: string | null;
    photo_count: number;
    published_count: number;
  })[];
}

/**
 * Inserting the row *is* the invitation — there is no pending state to track.
 * The slug is de-duplicated with a numeric suffix so two photographers with
 * the same name both get a working page.
 */
export async function inviteContributor(input: {
  email: string;
  display_name: string;
  site_url: string | null;
  role?: ContributorRole;
}): Promise<Contributor | null> {
  const slug = await nextFreeSlug(slugify(input.display_name));

  const rows = await sql`
    INSERT INTO contributors (id, email, slug, display_name, site_url, role)
    VALUES (${nanoid(ID_LENGTH)}, ${normaliseEmail(input.email)}, ${slug},
            ${input.display_name}, ${input.site_url},
            ${input.role ?? "contributor"})
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, slug, display_name, site_url, role;
  `;
  return firstContributor(rows as Record<string, unknown>[]);
}

async function nextFreeSlug(base: string): Promise<string> {
  const rows = await sql`
    SELECT slug FROM contributors
    WHERE slug = ${base} OR slug LIKE ${`${base}-%`};
  `;
  return pickFreeSlug(
    base,
    rows.map((row) => row["slug"] as string),
  );
}

export interface ContributorPreview {
  slug: string;
  display_name: string;
  site_url: string | null;
  photo_count: number;
  previews: { id: string; blob_url: string; blur_data_url: string }[];
}

/**
 * Everyone with published work, each with a few recent photographs.
 *
 * One query rather than one per contributor: the lateral join pulls each
 * person's four most recent photographs alongside their row, so the page
 * costs a single round trip however many photographers there are.
 */
export async function listContributorsWithPreviews(): Promise<
  ContributorPreview[]
> {
  /*
   * Two lateral joins and no GROUP BY. Grouping by the aggregated previews
   * fails outright — Postgres has no equality operator for `json` — and
   * counting in its own subquery is clearer than grouping around it anyway.
   * The inner join on a positive count is what hides contributors who have
   * been invited but have not published yet.
   */
  const rows = await sql`
    SELECT c.slug, c.display_name, c.site_url,
           stats.photo_count,
           COALESCE(recent.previews, '[]'::json) AS previews
    FROM contributors c
    JOIN LATERAL (
      SELECT COUNT(*)::int AS photo_count
      FROM photos p
      WHERE p.author_id = c.id AND p.published_at IS NOT NULL
    ) stats ON stats.photo_count > 0
    LEFT JOIN LATERAL (
      SELECT json_agg(x) AS previews FROM (
        SELECT r.id,
               COALESCE(r.display_url, r.blob_url) AS blob_url,
               r.blur_data_url
        FROM photos r
        WHERE r.author_id = c.id AND r.published_at IS NOT NULL
        ORDER BY r.is_opener DESC, r.published_at DESC
        LIMIT 4
      ) x
    ) recent ON TRUE
    WHERE c.revoked_at IS NULL
    ORDER BY stats.photo_count DESC, c.display_name ASC;
  `;
  return rows as ContributorPreview[];
}

/** Whether this contributor is an owner, for rules the interface must not own. */
export async function isOwnerContributor(id: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM contributors WHERE id = ${id} AND role = 'owner' LIMIT 1;
  `;
  return rows.length > 0;
}

export async function setContributorRevoked(
  id: string,
  revoked: boolean,
): Promise<void> {
  const revokedAt = revoked ? new Date().toISOString() : null;
  await sql`UPDATE contributors SET revoked_at = ${revokedAt} WHERE id = ${id};`;
  if (revoked) {
    /*
     * Revocation has to be immediate, so live sessions go with it. Deleted
     * by email, matching the column sessions are keyed and read on — the
     * `contributor_id` on those rows is a fallback, not the lookup path, and
     * clearing by it would leave a session that still resolves.
     */
    await sql`
      DELETE FROM sessions
      WHERE email = (SELECT email FROM contributors WHERE id = ${id});
    `;
  }
}
