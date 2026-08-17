import process from "node:process";
import { cookies } from "next/headers";
import { sql } from "@/lib/database";
import { isActive, type Member } from "@/lib/members/status";
import { generateSecret, hashSecret } from "./secrets";
import type { Contributor, ContributorRole } from "./types";

const SESSION_COOKIE = "gallery_session";

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
  const member = await memberForSession();
  return isActive(member) ? member : null;
}

/**
 * The member row behind the current cookie, active or not.
 *
 * One join rather than two sequential queries, for the same reason
 * `getCurrentContributor` above is one: this runs on `/api/photo/[id]/details`,
 * which a member hits once per photograph, and two round trips to Neon per
 * swipe is the whole cost of showing a line of text.
 *
 * Callers that gate content want `getCurrentMember`, which returns null for
 * an inactive membership so the check cannot be forgotten. Callers showing
 * somebody their own billing want this one: a lapsed member has the most
 * urgent reason of anyone to reach the portal.
 */
export async function memberForSession(): Promise<Member | null> {
  const store = await cookies();
  const secret = store.get(SESSION_COOKIE)?.value;
  if (secret === undefined || secret === "") {
    return null;
  }

  const rows = await sql`
    SELECT m.email, m.stripe_customer_id, m.status, m.current_period_end
    FROM sessions s
    JOIN members m ON m.email = s.email
    WHERE s.id = ${hashSecret(secret)}
      AND s.expires_at > now();
  `;
  return (rows[0] as Member | undefined) ?? null;
}

/**
 * Pushes the session's expiry back, if it is far enough through its life to be
 * worth a write.
 *
 * The window was fixed: thirty days from the moment somebody signed in, never
 * renewed, so an active photographer was logged out on a schedule for no
 * reason and had to go through the email dance again. Sliding it means
 * somebody who keeps using the site stays signed in, and somebody who stops
 * still falls out after thirty days of not using it — which is what a session
 * lifetime is meant to express.
 *
 * **Halfway, not every request.** Renewing on every read would mean an UPDATE
 * and a `Set-Cookie` on every page a contributor loads, to move an expiry a
 * few seconds. Waiting until the session is past its midpoint makes the write
 * rare — at most once per fifteen days of steady use — while the reader never
 * comes close to the edge.
 *
 * **Only callable from a route handler or a server action.** Next refuses
 * `cookies().set()` during a Server Component render, and the read paths above
 * are called from pages, so this cannot simply be folded into
 * `getCurrentContributor`. `/api/me` calls it, which covers the case that
 * matters most — a signed-in reader browsing the public gallery — and the
 * upload and draft routes are the natural second home for it if a
 * dashboard-only visitor ever turns out to be logged out mid-week.
 */
export async function renewSession(): Promise<void> {
  const store = await cookies();
  const secret = store.get(SESSION_COOKIE)?.value;
  if (secret === undefined || secret === "") {
    return;
  }

  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();

  /*
   * The database decides whether this is due, in the same statement that does
   * it. The midpoint test lives in the WHERE, so a read-then-write race cannot
   * double-renew or revive a session that has just been revoked, and
   * `RETURNING` says whether a live row was actually moved.
   */
  const moved = await sql`
    UPDATE sessions SET expires_at = ${expiresAt}
    WHERE id = ${hashSecret(secret)}
      AND expires_at > now()
      AND expires_at < now() + make_interval(days => ${SESSION_DAYS / 2})
    RETURNING id;
  `;

  if (moved.length === 0) {
    return;
  }

  store.set(SESSION_COOKIE, secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
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
