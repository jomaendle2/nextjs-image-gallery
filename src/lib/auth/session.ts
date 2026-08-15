import process from "node:process";
import { cookies } from "next/headers";
import { sql } from "@/lib/database";
import {
  getMemberByEmail,
  isActive,
  type Member,
} from "@/lib/members/repository";
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
export async function createSession(
  email: string,
  contributorId: string | null,
): Promise<void> {
  const secret = generateSecret();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();

  /*
   * `email` is what the session is keyed on and what every read resolves
   * through. `contributor_id` is written when there is one, so the foreign
   * key's ON DELETE CASCADE still cleans up after a deleted contributor, and
   * left null for a member — which is the whole reason that column stopped
   * being NOT NULL.
   */
  await sql`
    INSERT INTO sessions (id, contributor_id, email, expires_at)
    VALUES (${hashSecret(secret)}, ${contributorId}, ${email}, ${expiresAt});
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
 * The address of whoever is signed in, or null.
 *
 * This is the identity; everything else is a capability looked up from it.
 * `getCurrentContributor` is one such lookup and `getCurrentMember` is the
 * other — both resolve from the same cookie and the same session row, which
 * is the whole point of keying sessions on email rather than on a
 * contributor id.
 */
export async function getSessionEmail(): Promise<string | null> {
  const store = await cookies();
  const secret = store.get(SESSION_COOKIE)?.value;
  if (secret === undefined || secret === "") {
    return null;
  }

  const rows = await sql`
    SELECT email FROM sessions
    WHERE id = ${hashSecret(secret)} AND expires_at > now();
  `;
  return (rows[0]?.["email"] as string | undefined) ?? null;
}

/**
 * The contributor capability of the signed-in address, if it has one.
 *
 * Deliberately not middleware: middleware runs ahead of the cache on every
 * request, so an auth check there would tax every anonymous visitor to the
 * gallery for the benefit of a handful of contributors.
 *
 * Kept as a single join rather than `getSessionEmail()` followed by a lookup,
 * because this runs on every /contribute request and one round trip beats
 * two. The two are equivalent: `sessions.email` is the join key either way.
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
    JOIN contributors c ON c.email = s.email
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

/**
 * The membership capability of the signed-in address, if it has one.
 *
 * The second lookup the re-keying was for, and the reason `sessions` is
 * keyed on email rather than on a contributor id: this resolves from the
 * same cookie and the same row as `getCurrentContributor`, and somebody can
 * be a member, a contributor, both, or neither.
 *
 * Returns null rather than an inactive member, so a caller cannot forget to
 * check — an expired subscription and no subscription look the same from
 * here, which is what a gate wants.
 */
export async function getCurrentMember(): Promise<Member | null> {
  const email = await getSessionEmail();
  if (email === null) {
    return null;
  }
  const member = await getMemberByEmail(email);
  return isActive(member) ? member : null;
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
