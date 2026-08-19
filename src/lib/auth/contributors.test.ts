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

function fakeSql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<Record<string, unknown>[]> {
  issued.push({ text: strings.join("?"), values });
  return Promise.resolve(responses.shift() ?? []);
}

vi.mock("@/lib/database", () => ({ sql: fakeSql }));

const { claimNudge, ensureNudgeToken, listNudgeCandidates, muteNudges } =
  await import("./contributors");

beforeEach(() => {
  issued.length = 0;
  responses = [];
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
