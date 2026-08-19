import { nanoid } from "nanoid";
import { cache } from "react";
import { sql } from "@/lib/database";
import type { NudgeCandidate } from "./nudges";
import { generateSecret } from "./secrets";
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

/**
 * Cached per request: `generateMetadata` and the page body both need it, on
 * both `/by/[slug]` and its slideshow. See the note on `listGalleryImages`.
 */
export const getContributorBySlug = cache(async function bySlug(
  slug: string,
): Promise<Contributor | null> {
  const rows = await sql.query(
    `SELECT ${CONTRIBUTOR_COLUMNS} FROM contributors
     WHERE slug = $1 AND revoked_at IS NULL`,
    [slug],
  );
  return firstContributor(rows as Record<string, unknown>[]);
});

export async function listContributors(): Promise<
  (Contributor & {
    revoked_at: string | null;
    photo_count: number;
    published_count: number;
    invites_remaining: number;
    invited_by_name: string | null;
    nudge_count: number;
    nudges_muted_at: string | null;
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
  /*
   * The nudge count comes from a scalar subquery rather than a third join.
   *
   * A `LEFT JOIN contributor_nudges` here would multiply against the photos
   * join and inflate both counts above — the same fan-out `listNudgeCandidates`
   * spells `COUNT(DISTINCT …)` to survive. There is one ledger row per stage
   * and a handful of stages, so the subquery costs nothing worth defending.
   */
  const rows = await sql`
    SELECT c.id, c.email, c.slug, c.display_name, c.site_url, c.role,
           c.revoked_at, c.invites_remaining, c.nudges_muted_at,
           inviter.display_name AS invited_by_name,
           COUNT(p.id)::int AS photo_count,
           COUNT(p.id) FILTER (WHERE p.published_at IS NOT NULL)::int
             AS published_count,
           (SELECT COUNT(*) FROM contributor_nudges n
             WHERE n.contributor_id = c.id)::int AS nudge_count
    FROM contributors c
    LEFT JOIN photos p ON p.author_id = c.id
    LEFT JOIN contributors inviter ON inviter.id = c.invited_by
    GROUP BY c.id, inviter.display_name
    ORDER BY c.created_at ASC;
  `;
  return rows as (Contributor & {
    revoked_at: string | null;
    photo_count: number;
    published_count: number;
    invites_remaining: number;
    invited_by_name: string | null;
    nudge_count: number;
    nudges_muted_at: string | null;
  })[];
}

/** A contributor as the nudge cron needs to see them, in one row. */
export interface NudgeCandidateRow extends NudgeCandidate {
  id: string;
  email: string;
  display_name: string;
  /** Null until the first nudge mints one. */
  nudge_token: string | null;
  first_signed_in_at: string | null;
}

/**
 * Everyone who might be owed a nudge, with everything needed to decide.
 *
 * Purpose-built rather than an extension of `listContributors`, which is
 * close but selects no `created_at` — the empty track's anchor — and would
 * need the ledger join regardless. One statement per run, whatever the size
 * of the list, because the alternative is a query per contributor inside the
 * loop that also sends the mail.
 *
 * The `DISTINCT`s are load-bearing and the bug they prevent is silent. Two
 * left joins from `contributors` multiply each other: a photographer with two
 * photographs and three nudge rows produces six, so a plain `COUNT(p.id)`
 * reports six photographs, `photo_count === 0` is false for somebody who has
 * uploaded nothing, and the empty track stops mailing anybody the moment
 * their first nudge is logged. `MIN` and `MAX` are indifferent to the
 * duplication, which is why only the counts carry it.
 *
 * Revoked rows are excluded here *and* checked again in `dueStage`. That is
 * deliberate belt-and-braces: this query is the performance answer, and the
 * schedule owns the rule.
 */
export async function listNudgeCandidates(): Promise<NudgeCandidateRow[]> {
  const rows = await sql`
    SELECT c.id, c.email, c.display_name, c.created_at, c.revoked_at,
           c.nudge_token, c.nudges_muted_at, c.first_signed_in_at,
           COUNT(DISTINCT p.id)::int AS photo_count,
           COUNT(DISTINCT p.id) FILTER (WHERE p.published_at IS NOT NULL)::int
             AS published_count,
           MIN(p.created_at) FILTER (WHERE p.published_at IS NULL)
             AS oldest_unpublished_at,
           COALESCE(MAX(n.stage) FILTER (WHERE n.track = 'empty'), 0)::int
             AS empty_stage,
           COALESCE(MAX(n.stage) FILTER (WHERE n.track = 'draft'), 0)::int
             AS draft_stage,
           MAX(n.sent_at) AS last_sent_at
    FROM contributors c
    LEFT JOIN photos p ON p.author_id = c.id
    LEFT JOIN contributor_nudges n ON n.contributor_id = c.id
    WHERE c.revoked_at IS NULL
    GROUP BY c.id
    ORDER BY c.created_at ASC;
  `;
  return rows as NudgeCandidateRow[];
}

/**
 * Claims one stage of one track, returning whether this caller got it.
 *
 * The claim happens *before* the send, and the composite primary key is what
 * makes that safe: a second run — a retry after a provider timeout, two
 * overlapping crons, a hand-run during an incident — inserts nothing and
 * returns false, so it sends nothing. The failure this orders is deliberate.
 * Claiming first means a send that throws leaves a stage marked as sent and
 * the photographer misses one message; sending first would mean a crash
 * between the two mails it twice. A duplicate is worse than a miss, which is
 * the same trade `markAnnounced` documents.
 */
export async function claimNudge(
  contributorId: string,
  track: string,
  stage: number,
): Promise<boolean> {
  const rows = await sql`
    INSERT INTO contributor_nudges (contributor_id, track, stage)
    VALUES (${contributorId}, ${track}, ${stage})
    ON CONFLICT DO NOTHING
    RETURNING contributor_id;
  `;
  return rows.length > 0;
}

/**
 * The opt-out secret for one contributor, minted on first use.
 *
 * Lazy rather than backfilled: an address that never receives a nudge never
 * needs one, and a migration that generated a secret for every row would be
 * writing credentials for people who will never see them. `COALESCE` inside
 * the UPDATE keeps it stable — two runs that race both return the same token
 * because whichever writes second still writes the value already there.
 */
export async function ensureNudgeToken(
  contributorId: string,
): Promise<string | null> {
  const rows = await sql`
    UPDATE contributors
       SET nudge_token = COALESCE(nudge_token, ${generateSecret()})
     WHERE id = ${contributorId}
    RETURNING nudge_token;
  `;
  return (rows[0]?.["nudge_token"] as string | undefined) ?? null;
}

/**
 * Stops the nudges for whoever holds this token. Nothing else changes.
 *
 * Sign-in links and announcements are untouched, because they rest on
 * different consent: somebody who is tired of being asked to upload has not
 * asked to be locked out of their own account.
 *
 * Idempotent by `COALESCE`, so the RFC 8058 one-click endpoint and the page's
 * button can both be pressed, in either order, without the second one moving
 * the timestamp. It returns true for an already-muted address as well — from
 * the reader's point of view "you are muted" is the same outcome, and
 * reporting failure for a second click would be a lie.
 */
export async function muteNudges(token: string): Promise<boolean> {
  if (token === "") {
    return false;
  }
  const rows = await sql`
    UPDATE contributors
       SET nudges_muted_at = COALESCE(nudges_muted_at, now())
     WHERE nudge_token = ${token}
    RETURNING id;
  `;
  return rows.length > 0;
}

/**
 * The slug of every photographer a visitor can actually reach: not revoked,
 * and with at least one published photograph.
 *
 * One list, three consumers, and that is the point. The sitemap decides what
 * to advertise with this filter, and `/by/[slug]` and its slideshow decide
 * what to prerender with it — so a set that disagreed would either advertise
 * pages nobody had built or build pages nobody was told about. It was
 * written out once and about to be written out twice more.
 *
 * `revoked_at` and `published_count` are both required: `listContributors`
 * is the moderation view and returns everybody, including people who have
 * been removed and people who have uploaded nothing. Either of those gets a
 * 404 or an empty gallery, which is not a page worth having in either list.
 */
export async function listPublicContributorSlugs(): Promise<string[]> {
  const contributors = await listContributors();
  return contributors
    .filter(
      (person) => person.revoked_at === null && person.published_count > 0,
    )
    .map((person) => person.slug);
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

/** Why a contributor's invite did or did not create somebody. */
export type ClaimOutcome =
  | { status: "invited"; contributor: Contributor; remaining: number }
  | { status: "no-invites-left" }
  | { status: "already-a-contributor" }
  | { status: "inviter-not-eligible" };

/**
 * Spending one of a contributor's three invites.
 *
 * The quota check and the insert are deliberately one statement. A read
 * followed by a write would let two tabs — or two taps on a slow phone —
 * both see "1 left" and both spend it, and the whole point of a scarce
 * invite is that it is scarce. Postgres runs a data-modifying CTE as one
 * statement in one implicit transaction, so either the counter drops and
 * the row appears, or neither happens.
 *
 * Three races, and what each does:
 *
 *   - Same inviter twice at once. The second UPDATE blocks on the first's
 *     row lock, then re-evaluates its WHERE against the committed row under
 *     READ COMMITTED. It sees the decremented count and stops at zero.
 *   - Two inviters, same new address. Both snapshots pass `NOT EXISTS`, one
 *     INSERT wins, the other raises 23505 — and the whole statement rolls
 *     back, decrement included, so the loser is not charged.
 *   - Two people with the same display name. `nextFreeSlug` reads before
 *     this statement, so the slugs can collide; that also raises 23505 and
 *     also rolls back, which is what makes a retry safe.
 *
 * Nothing is ever refunded, because nothing is spent unless the row is
 * created. A compensating UPDATE would be a second write that can fail on
 * its own.
 *
 * The diagnosis comes back in the same statement rather than from a
 * follow-up SELECT: a second read is a second snapshot, and could report a
 * reason that was never true at the moment the claim was refused.
 */
export async function claimInvite(input: {
  inviterId: string;
  email: string;
  display_name: string;
  site_url: string | null;
}): Promise<ClaimOutcome> {
  const email = normaliseEmail(input.email);
  const slug = await nextFreeSlug(slugify(input.display_name));

  const rows = await sql`
    WITH taken AS (
      SELECT 1 FROM contributors WHERE email = ${email}
    ),
    inviter AS (
      SELECT id, invites_remaining, revoked_at
      FROM contributors WHERE id = ${input.inviterId}
    ),
    claimed AS (
      UPDATE contributors AS a
         SET invites_remaining = a.invites_remaining - 1
       WHERE a.id = ${input.inviterId}
         AND a.revoked_at IS NULL
         AND a.invites_remaining > 0
         AND NOT EXISTS (SELECT 1 FROM taken)
      RETURNING a.id, a.invites_remaining
    ),
    inserted AS (
      INSERT INTO contributors
        (id, email, slug, display_name, site_url, role, invited_by)
      SELECT ${nanoid(ID_LENGTH)}, ${email}, ${slug},
             ${input.display_name}, ${input.site_url}, 'contributor', c.id
        FROM claimed c
      RETURNING id, email, slug, display_name, site_url, role
    )
    SELECT i.id, i.email, i.slug, i.display_name, i.site_url, i.role,
           (SELECT count(*) FROM taken) > 0 AS email_taken,
           COALESCE(
             (SELECT revoked_at IS NOT NULL FROM inviter), TRUE
           ) AS inviter_blocked,
           COALESCE(
             (SELECT invites_remaining FROM claimed),
             (SELECT invites_remaining FROM inviter),
             0
           ) AS remaining
      FROM (SELECT 1) AS always
      LEFT JOIN inserted i ON TRUE;
  `;

  const row = rows[0] as Record<string, unknown> | undefined;
  if (row === undefined) {
    return { status: "inviter-not-eligible" };
  }

  /*
   * The LEFT JOIN always returns a row, so a refusal comes back with every
   * contributor column NULL rather than as an empty result. `firstContributor`
   * only guards against a missing row, so handing it this one would build a
   * Contributor whose id is null — checking the id is what distinguishes
   * "refused" from "created".
   */
  if (row["id"] !== null && row["id"] !== undefined) {
    const contributor = firstContributor([row]);
    if (contributor !== null) {
      return {
        status: "invited",
        contributor,
        remaining: Number(row["remaining"] ?? 0),
      };
    }
  }

  // Refused. The flags come from the same snapshot as the refusal, so this
  // reports the reason that actually applied rather than a later one.
  if (row["email_taken"] === true) {
    return { status: "already-a-contributor" };
  }
  if (row["inviter_blocked"] === true) {
    return { status: "inviter-not-eligible" };
  }
  return { status: "no-invites-left" };
}

/** How many invites this contributor has left to give. */
export async function invitesRemaining(contributorId: string): Promise<number> {
  const rows = await sql`
    SELECT invites_remaining FROM contributors WHERE id = ${contributorId};
  `;
  return Number(rows[0]?.["invites_remaining"] ?? 0);
}

/** The photographers this contributor brought in, newest first. */
export async function listInvitees(
  contributorId: string,
): Promise<{ slug: string; display_name: string; published_count: number }[]> {
  const rows = await sql`
    SELECT c.slug, c.display_name,
           COUNT(p.id) FILTER (WHERE p.published_at IS NOT NULL)::int
             AS published_count
    FROM contributors c
    LEFT JOIN photos p ON p.author_id = c.id
    WHERE c.invited_by = ${contributorId}
    GROUP BY c.id, c.slug, c.display_name, c.created_at
    ORDER BY c.created_at DESC;
  `;
  return rows as {
    slug: string;
    display_name: string;
    published_count: number;
  }[];
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
): Promise<string | null> {
  const revokedAt = revoked ? new Date().toISOString() : null;
  const rows = await sql`
    UPDATE contributors SET revoked_at = ${revokedAt}
    WHERE id = ${id} RETURNING slug;`;
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
  return (rows[0]?.["slug"] as string | undefined) ?? null;
}
