import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The four statements the nudge cron runs, pinned as text.
 *
 * The database is a recording fake, which is the limit `tokens.test.ts`
 * already names: these prove what SQL is *issued* and what values are bound
 * to it, not what Postgres does with it. That is the right trade for the
 * three properties here, because all three are properties of the statement —
 * a `DISTINCT` that must not be dropped, an `ON CONFLICT DO NOTHING` that is
 * the entire idempotency mechanism, and a `COALESCE` that keeps a secret
 * stable. Each of them is invisible at the type level and each would fail
 * quietly and expensively: silent double-sends, or a sequence that goes mute
 * for everybody at once.
 */

interface Recorded {
  text: string;
  values: unknown[];
}

const issued: Recorded[] = [];
let responses: Record<string, unknown>[][] = [];
/** Set by a test that wants the next statement to fail, as Postgres would. */
let failWith: (Error & { code?: string }) | null = null;

function fakeSql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<Record<string, unknown>[]> {
  issued.push({ text: strings.join("?"), values });
  if (failWith !== null) {
    const error = failWith;
    failWith = null;
    return Promise.reject(error);
  }
  return Promise.resolve(responses.shift() ?? []);
}

vi.mock("@/lib/database", () => ({ sql: fakeSql }));

const {
  claimNudge,
  ensureNudgeToken,
  inviterName,
  listContributors,
  listNudgeCandidates,
  listNudgeCounts,
  muteNudges,
} = await import("./contributors");
const { NUDGE_SEED_AT } = await import("@/lib/schema");

beforeEach(() => {
  issued.length = 0;
  responses = [];
  failWith = null;
});

describe("listNudgeCandidates", () => {
  it("counts photographs distinctly, or the empty track goes silent", async () => {
    /*
     * The bug this exists to prevent, and it is silent in exactly the way
     * that costs the most: two left joins from `contributors` multiply each
     * other, so somebody with three nudge rows and no photographs would
     * report `photo_count` above zero, be classified as a *drafter*, and
     * stop receiving the sequence that was meant for them — while the ledger
     * that caused it grew with every run.
     */
    await listNudgeCandidates();

    const [statement] = issued;
    expect(statement).toBeDefined();
    expect(statement?.text).toContain(
      "COUNT(DISTINCT p.id)::int AS photo_count",
    );
    expect(statement?.text).toMatch(
      /COUNT\(DISTINCT p\.id\) FILTER \(WHERE p\.published_at IS NOT NULL\)/,
    );
  });

  it("anchors the draft track on the oldest unpublished photograph", async () => {
    await listNudgeCandidates();

    expect(issued[0]?.text).toMatch(
      /MIN\(p\.created_at\) FILTER \(WHERE p\.published_at IS NULL\)/,
    );
  });

  it("keeps the two tracks' counters apart", async () => {
    // A single shared counter would greet a first upload with "still nothing
    // published?" — the third message of a sequence they had never begun.
    await listNudgeCandidates();

    const text = issued[0]?.text ?? "";
    expect(text).toMatch(/MAX\(n\.stage\) FILTER \(WHERE n\.track = 'empty'\)/);
    expect(text).toMatch(/MAX\(n\.stage\) FILTER \(WHERE n\.track = 'draft'\)/);
    // And one overall timestamp, which is what the global floor reads.
    expect(text).toContain("MAX(n.sent_at) AS last_sent_at");
  });

  it("never offers a revoked contributor as a candidate", async () => {
    await listNudgeCandidates();

    expect(issued[0]?.text).toContain("WHERE c.revoked_at IS NULL");
  });
});

describe("listContributors, on a database the migration has not reached", () => {
  it("reads the new column through to_jsonb, never bare", async () => {
    /*
     * This test exists because the bare column failed a real build.
     *
     * Preview, development and production share one Neon database and
     * `migrate.mts` refuses to migrate outside production, so a branch that
     * adds a column runs against a database without it for as long as the
     * branch is open. `listPublicContributorSlugs` wraps this query, so
     * `/by/[slug]` prerenders through it — and `42703: column
     * c.nudges_muted_at does not exist` was not a broken page, it was a
     * failed deployment.
     *
     * `FEED_COLUMNS` already solved this for `has_member_details`. The rule
     * is the same one: a column added on this branch is read as jsonb until
     * the migration has landed in the shared database.
     */
    await listContributors();

    const [statement] = issued;
    expect(statement).toBeDefined();
    expect(statement?.text).toContain(
      "(to_jsonb(c) ->> 'nudges_muted_at') AS nudges_muted_at",
    );
    expect(statement?.text).not.toMatch(/\bc\.nudges_muted_at\b/);
  });

  it("does not name the ledger table at all", async () => {
    // A missing *table* cannot be softened the way a missing column can —
    // Postgres rejects the statement at parse time — so this query, which
    // the build depends on, must not mention it. The count lives in
    // `listNudgeCounts`, which is allowed to fail.
    await listContributors();

    expect(issued[0]?.text).not.toContain("contributor_nudges");
  });
});

describe("listNudgeCounts", () => {
  it("counts only reminders that were actually sent", async () => {
    /*
     * The seed migration writes three `contributor_nudges` rows for every
     * contributor invited before it ran — stages 1-3 of the empty track,
     * marked sent so the sequence starts on its monthly tail rather than
     * ambushing the existing list. Nothing was mailed for those rows.
     *
     * A plain `COUNT(*)` therefore opens the admin table on day one showing
     * "3 reminders sent" beside every photographer on it, which is the one
     * thing the cell exists to tell the truth about: the comment above it
     * says it shows what the cron "has actually done to this person", and
     * for the entire pre-existing list it would be showing what the cron
     * explicitly did *not* do.
     *
     * The seed's stamp is a fixed literal precisely so it can be recognised
     * again, and `NUDGE_SEED_AT` is that literal shared rather than retyped —
     * a second copy here that drifted from the migration's would silently
     * start counting the seed again.
     */
    responses = [[]];

    await listNudgeCounts();

    const [statement] = issued;
    expect(statement?.text).toContain("sent_at >");
    expect(statement?.values).toContain(NUDGE_SEED_AT);
  });

  it("returns a count per contributor", async () => {
    responses = [
      [
        { contributor_id: "a", n: 3 },
        { contributor_id: "b", n: 1 },
      ],
    ];
    const counts = await listNudgeCounts();

    expect(counts.get("a")).toBe(3);
    expect(counts.get("b")).toBe(1);
  });

  it("degrades to nothing when the table is not there yet", async () => {
    /*
     * `42P01` on a preview means one thing only: this branch's code against a
     * database the migration has not reached. The admin page then renders
     * without one cell, rather than 500ing — which matters because it is the
     * page somebody would open to find out what was going on.
     */
    failWith = Object.assign(new Error("undefined table"), { code: "42P01" });

    await expect(listNudgeCounts()).resolves.toEqual(new Map());
  });

  it("re-throws anything that is not a missing table", async () => {
    // Swallowing the rest would hide a real bug behind a quietly absent
    // column for as long as nobody counted the cells.
    failWith = Object.assign(new Error("connection lost"), { code: "08006" });

    await expect(listNudgeCounts()).rejects.toThrow("connection lost");
  });
});

describe("claimNudge", () => {
  it("claims with a conflict clause that does nothing", async () => {
    /*
     * The whole idempotency mechanism, in one clause. Without it a retried
     * run — a provider timeout, two overlapping crons, a hand-run during an
     * incident — sends the same stage twice, and a duplicate is the failure
     * this design explicitly prefers to a miss.
     */
    responses = [[{ contributor_id: "abc" }]];
    const claimed = await claimNudge("abc", "empty", 2);

    expect(claimed).toBe(true);
    expect(issued[0]?.text).toContain("ON CONFLICT");
    expect(issued[0]?.text).toContain("DO NOTHING");
    expect(issued[0]?.text).toContain("RETURNING contributor_id");
    expect(issued[0]?.values).toEqual(["abc", "empty", 2]);
  });

  it("reports the claim lost when the row was already there", async () => {
    // No rows back means somebody else claimed this stage. The caller must
    // send nothing at all, so this has to be false rather than throwing.
    responses = [[]];
    expect(await claimNudge("abc", "empty", 2)).toBe(false);
  });
});

describe("ensureNudgeToken", () => {
  it("keeps an existing token rather than replacing it", async () => {
    /*
     * `COALESCE` inside the UPDATE is what makes every nudge's opt-out link
     * the same link. Replacing the token per send would silently invalidate
     * the one in every message already sitting in the inbox — the reader
     * presses it, nothing matches, and the mail keeps coming.
     */
    responses = [[{ nudge_token: "already-here" }]];
    const token = await ensureNudgeToken("abc");

    expect(token).toBe("already-here");
    expect(issued[0]?.text).toMatch(
      /SET nudge_token = COALESCE\(nudge_token, \?\)/,
    );
  });

  it("returns null for a contributor that no longer exists", async () => {
    responses = [[]];
    expect(await ensureNudgeToken("gone")).toBeNull();
  });
});

describe("muteNudges", () => {
  it("mutes on a matching token and says so", async () => {
    responses = [[{ id: "abc" }]];
    expect(await muteNudges("a-token")).toBe(true);
    expect(issued[0]?.values).toEqual(["a-token"]);
  });

  it("refuses an empty token without going near the database", async () => {
    /*
     * An empty string reaching `WHERE nudge_token = ''` would match nothing
     * today, and would match every un-minted row the moment somebody
     * defaults that column to `''` instead of null. Cheaper to refuse here.
     */
    expect(await muteNudges("")).toBe(false);
    expect(issued).toHaveLength(0);
  });

  it("does not move the timestamp on a second press", async () => {
    // The one-click endpoint and the page's button can both be pressed, in
    // either order. Neither should overwrite when the person first asked.
    responses = [[{ id: "abc" }]];
    await muteNudges("a-token");

    expect(issued[0]?.text).toMatch(
      /SET nudges_muted_at = COALESCE\(nudges_muted_at, now\(\)\)/,
    );
  });

  it("reports success for an address that was already muted", async () => {
    // `COALESCE` still returns the row, so this stays true — and it should.
    // "You will not be mailed again" is what the reader asked about, and it
    // is true either way.
    responses = [[{ id: "abc" }]];
    expect(await muteNudges("a-token")).toBe(true);
  });
});

describe("inviterName", () => {
  it("asks about the inviter, not only about the invitee", async () => {
    /*
     * Both filters are on `inviter.`, and that is the whole of the test.
     * Filtering the invitee is not the bug — filtering *only* the invitee is:
     * the query would happily name somebody who has since been removed from
     * the gallery, or name the owner.
     *
     * The owner one is the subtle half. `inviteContributor` leaves
     * `invited_by` NULL, so the admin door never produced this line and the
     * `role` filter looked redundant — but the owner is also a contributor,
     * and an invite spent through `/contribute/invite` runs `claimInvite`,
     * which records `invited_by` like anybody else's. The sentence exists to
     * say a peer chose you.
     */
    await inviterName("abc");

    expect(issued[0]?.text).toContain("inviter.revoked_at IS NULL");
    expect(issued[0]?.text).toContain("inviter.role <> 'owner'");
    expect(issued[0]?.values).toEqual(["abc"]);
  });
});
