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
  (Contributor & { revoked_at: string | null; photo_count: number })[]
> {
  const rows = await sql`
    SELECT c.id, c.email, c.slug, c.display_name, c.site_url, c.role,
           c.revoked_at, COUNT(p.id)::int AS photo_count
    FROM contributors c
    LEFT JOIN photos p ON p.author_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at ASC;
  `;
  return rows as (Contributor & {
    revoked_at: string | null;
    photo_count: number;
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

export async function setContributorRevoked(
  id: string,
  revoked: boolean,
): Promise<void> {
  const revokedAt = revoked ? new Date().toISOString() : null;
  await sql`UPDATE contributors SET revoked_at = ${revokedAt} WHERE id = ${id};`;
  if (revoked) {
    // Revocation has to be immediate, so live sessions go with it.
    await sql`DELETE FROM sessions WHERE contributor_id = ${id};`;
  }
}
