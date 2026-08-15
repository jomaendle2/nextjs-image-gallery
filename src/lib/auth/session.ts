import process from "node:process";
import { cookies } from "next/headers";
import { sql } from "@/lib/database";
import { generateSecret, hashSecret } from "./secrets";
import type { Contributor, ContributorRole } from "./types";

export const SESSION_COOKIE = "gallery_session";

const SESSION_DAYS = 30;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

/**
 * Opaque server-side sessions rather than a signed stateless cookie.
 *
 * For a closed list of contributors, immediate revocation matters more than
 * saving a query: deleting the row logs someone out now, whereas a signed JWT
 * stays valid until it expires. The lookup only ever runs on /contribute
 * routes, so the cached public gallery pays nothing for it.
 */
export async function createSession(contributorId: string): Promise<void> {
  const secret = generateSecret();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();

  await sql`
    INSERT INTO sessions (id, contributor_id, expires_at)
    VALUES (${hashSecret(secret)}, ${contributorId}, ${expiresAt});
  `;

  const store = await cookies();
  store.set(SESSION_COOKIE, secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * The only way to learn who is signed in.
 *
 * Deliberately not middleware: middleware runs ahead of the cache on every
 * request, so an auth check there would tax every anonymous visitor to the
 * gallery for the benefit of a handful of contributors.
 */
export async function getCurrentContributor(): Promise<Contributor | null> {
  const store = await cookies();
  const secret = store.get(SESSION_COOKIE)?.value;
  if (secret === undefined || secret === "") {
    return null;
  }

  const rows = await sql`
    SELECT c.id, c.email, c.slug, c.display_name, c.site_url, c.role
    FROM sessions s
    JOIN contributors c ON c.id = s.contributor_id
    WHERE s.id = ${hashSecret(secret)}
      AND s.expires_at > now()
      AND c.revoked_at IS NULL;
  `;
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

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const secret = store.get(SESSION_COOKIE)?.value;
  if (secret !== undefined && secret !== "") {
    await sql`DELETE FROM sessions WHERE id = ${hashSecret(secret)};`;
  }
  store.delete(SESSION_COOKIE);
}

/** For routes and actions that must not run for an anonymous visitor. */
export async function requireContributor(): Promise<Contributor> {
  const contributor = await getCurrentContributor();
  if (!contributor) {
    throw new Error("Not signed in.");
  }
  return contributor;
}
