import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sign-in seam, pinned before it is changed.
 *
 * Nothing covered `mintLoginToken` or `consumeLoginToken` until now — the
 * fifteen-minute expiry existed only as a constant in one file and as prose
 * inside two email bodies, and the neutral-response property that keeps the
 * sign-in form from becoming a roster was documented and unenforced. This file
 * exists because the invitation flow is about to start minting tokens with a
 * different lifetime, and every property below is one a careless change to that
 * could quietly remove.
 *
 * The database is a recording fake rather than a real connection. That is a
 * deliberate limit and worth naming: these tests prove what SQL is *issued* and
 * what values are bound to it, not what Postgres does with it. The two
 * properties that genuinely live in the database — that `used_at IS NULL`
 * inside the UPDATE makes redemption atomic, and that `expires_at > now()` is
 * evaluated by the server clock rather than ours — are asserted here as *the
 * statement still containing those clauses*, which is the same source-text
 * technique `security.test.ts` uses for the invariants it cannot execute.
 */

interface Recorded {
  text: string;
  values: unknown[];
}

const issued: Recorded[] = [];

/**
 * Rows the fake returns, oldest first, one entry per statement.
 *
 * An `Error` in the queue is thrown rather than returned, which is the only
 * way to test what this module does when one statement of a multi-statement
 * flow fails while the ones before it have already committed.
 */
let responses: (Record<string, unknown>[] | Error)[] = [];

/** A Postgres error as the neon driver surfaces one, code and all. */
function pgError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

/**
 * A stand-in for neon's tagged template.
 *
 * Neon's `sql` is called as `` sql`SELECT …${value}` ``, so it receives the
 * literal fragments and the interpolated values separately — which is the whole
 * reason this codebase can assert that no request string ever reaches SQL text.
 * The fake keeps both halves so the tests can read the statement and the bound
 * parameters independently.
 */
function fakeSql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<Record<string, unknown>[]> {
  issued.push({ text: strings.join("?"), values });
  const next = responses.shift();
  return next instanceof Error
    ? Promise.reject(next)
    : Promise.resolve(next ?? []);
}

vi.mock("@/lib/database", () => ({ sql: fakeSql }));

const memberExists = vi.fn<(email: string) => Promise<boolean>>();
vi.mock("@/lib/members/repository", () => ({
  memberExists: (email: string) => memberExists(email),
}));

const { consumeLoginToken, invitationUrl, mintLoginToken } = await import(
  "./tokens"
);
// The two durations moved to a module with no imports, so that the mail
// templates and the privacy policy can state them without pulling in a
// database connection. They are read from their definer, not re-exported.
const { INVITE_TTL_MINUTES, LOGIN_TTL_MINUTES } = await import("./ttl");
const { hashSecret } = await import("./secrets");

beforeEach(() => {
  issued.length = 0;
  responses = [];
  memberExists.mockReset();
  memberExists.mockResolvedValue(false);
});

/** How many minutes ahead of now the statement's timestamp sits. */
function ttlOf(statement: Recorded | undefined): number {
  const stamp = statement?.values.find(
    (value): value is string =>
      typeof value === "string" && value.includes("T"),
  );
  return (Date.parse(stamp ?? "") - Date.now()) / 60_000;
}

/** The statement that wrote a row, by the table it wrote to. */
function insertInto(table: string): Recorded | undefined {
  return issued.find(
    (statement) =>
      statement.text.includes("INSERT INTO") && statement.text.includes(table),
  );
}

describe("mintLoginToken", () => {
  it("returns null for an address that is neither a contributor nor a member", async () => {
    // The property the neutral sign-in response rests on: no token, no row,
    // and — critically — nothing for the caller to distinguish. If this ever
    // starts throwing or returning a value, the form becomes a way to ask who
    // is on the list.
    responses = [[]];

    expect(await mintLoginToken("nobody@example.test")).toBeNull();
    expect(insertInto("login_tokens")).toBeUndefined();
  });

  it("issues a token for a member with no contributors row", async () => {
    // The case that was broken once: a paying member has an address and
    // nothing else, and used to be refused because a contributors row was
    // required.
    responses = [[]];
    memberExists.mockResolvedValue(true);

    expect(await mintLoginToken("member@example.test")).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    expect(insertInto("login_tokens")).toBeDefined();
  });

  it("issues a token for a live contributor without consulting the member list", async () => {
    responses = [[{ id: "c1" }]];

    expect(await mintLoginToken("shooter@example.test")).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    // A contributor is enough on its own; asking twice would be a wasted query
    // on the commonest path.
    expect(memberExists).not.toHaveBeenCalled();
  });

  it("stores only the hash, never the secret it returned", async () => {
    responses = [[{ id: "c1" }]];

    const secret = await mintLoginToken("shooter@example.test");
    const insert = insertInto("login_tokens");

    expect(secret).not.toBeNull();
    expect(insert?.values).toContain(hashSecret(secret ?? ""));
    // What is at rest must not be replayable as a login link.
    expect(insert?.values).not.toContain(secret);
  });

  it("normalises the address it stores, so redemption matches what was typed", async () => {
    responses = [[{ id: "c1" }]];

    await mintLoginToken("  Shooter@Example.TEST ");

    expect(insertInto("login_tokens")?.values).toContain(
      "shooter@example.test",
    );
  });

  it("expires the link after the default window", async () => {
    responses = [[{ id: "c1" }]];

    await mintLoginToken("shooter@example.test");

    // The number lives in one constant and in prose inside three email
    // bodies. This is the only thing that would notice them disagreeing.
    expect(ttlOf(insertInto("login_tokens"))).toBeCloseTo(LOGIN_TTL_MINUTES, 0);
  });

  it("honours a caller's window, which is how an invitation gets a week", async () => {
    responses = [[{ id: "c1" }]];

    await mintLoginToken("shooter@example.test", INVITE_TTL_MINUTES);

    expect(ttlOf(insertInto("login_tokens"))).toBeCloseTo(
      INVITE_TTL_MINUTES,
      0,
    );
  });

  it("keeps the invitation window far longer than the sign-in one", () => {
    /*
     * The two exist for different readers: one is waiting at a keyboard, the
     * other is opening their mail the next morning. Collapsing them back to a
     * single constant is the change this guards against — it is what made the
     * invitation unable to carry a token at all.
     */
    expect(INVITE_TTL_MINUTES).toBeGreaterThan(LOGIN_TTL_MINUTES * 24);
  });
});

describe("consumeLoginToken", () => {
  it("refuses an empty secret without touching the database", async () => {
    expect(await consumeLoginToken("")).toBeNull();
    expect(issued).toHaveLength(0);
  });

  it("spends the token and resolves the contributor behind it", async () => {
    responses = [
      [{ email: "shooter@example.test" }],
      [
        {
          id: "c1",
          email: "shooter@example.test",
          slug: "shooter",
          display_name: "Shooter",
          site_url: null,
          role: "contributor",
        },
      ],
    ];

    const redeemed = await consumeLoginToken("a-secret");

    expect(redeemed?.email).toBe("shooter@example.test");
    expect(redeemed?.contributor?.slug).toBe("shooter");
  });

  it("still signs somebody in when the first-sign-in stamp cannot be written", async () => {
    /*
     * The one failure that must not cost somebody their link.
     *
     * `first_signed_in_at` is written *after* `used_at`, so by the time this
     * statement runs the token is already spent and cannot be presented
     * again. A rejection propagating from here is therefore not "sign-in
     * failed, try the link again" — it is a 500 on a link that no longer
     * works, and the only way back is asking for another one.
     *
     * `42703` is undefined_column, which is precisely the state of every
     * preview deployment of a branch that adds the column: `scripts/migrate`
     * refuses to run outside production and all three environments share one
     * Neon database, so the code is deployed and the column is not. The same
     * window `listContributors` reaches for `to_jsonb` to survive.
     */
    responses = [
      [{ email: "shooter@example.test" }],
      [
        {
          id: "c1",
          email: "shooter@example.test",
          slug: "shooter",
          display_name: "Shooter",
          site_url: null,
          role: "contributor",
        },
      ],
      pgError("42703", 'column "first_signed_in_at" does not exist'),
    ];

    const redeemed = await consumeLoginToken("a-secret");

    expect(redeemed?.email).toBe("shooter@example.test");
    expect(redeemed?.contributor?.slug).toBe("shooter");
  });

  it("looks the token up by hash, so a stolen row is not a stolen link", async () => {
    responses = [[]];

    await consumeLoginToken("a-secret");

    expect(issued[0]?.values).toContain(hashSecret("a-secret"));
    expect(issued[0]?.values).not.toContain("a-secret");
  });

  it("enforces single use and expiry inside the write itself", async () => {
    responses = [[]];

    await consumeLoginToken("a-secret");
    const update = issued[0]?.text ?? "";

    /*
     * Asserted as source text because the atomicity is Postgres's, not ours: a
     * read followed by a write would pass every behavioural test above and
     * still let two simultaneous presses of one link both succeed. What makes
     * that impossible is these two clauses being in the same statement as the
     * `SET`, so that is what is pinned.
     */
    expect(update).toContain("UPDATE login_tokens");
    expect(update).toContain("used_at IS NULL");
    expect(update).toContain("expires_at > now()");
  });

  it("returns null for a token that bought nothing", async () => {
    // Wrong, spent or expired all arrive here as an empty result, and the
    // caller must not be able to tell which.
    responses = [[]];

    expect(await consumeLoginToken("a-secret")).toBeNull();
  });

  it("admits a member whose address has no contributors row", async () => {
    responses = [[{ email: "member@example.test" }], []];
    memberExists.mockResolvedValue(true);

    const redeemed = await consumeLoginToken("a-secret");

    expect(redeemed?.email).toBe("member@example.test");
    expect(redeemed?.contributor).toBeNull();
  });

  it("refuses a valid token whose address has lost every capability", async () => {
    /*
     * This is how revocation keeps working. The token itself is still
     * unspent and unexpired — the UPDATE succeeds and spends it — but the
     * contributor row is gone or revoked and there is no membership, so the
     * link resolves to nobody. A revoked photographer who never subscribed
     * lands exactly here.
     */
    responses = [[{ email: "revoked@example.test" }], []];
    memberExists.mockResolvedValue(false);

    expect(await consumeLoginToken("a-secret")).toBeNull();
  });
});

describe("invitationUrl", () => {
  it("carries a sign-in token, so the invitation is the way in", async () => {
    responses = [[{ id: "c1" }]];

    const url = new URL(await invitationUrl("shooter@example.test"));

    /*
     * The whole point of the change this guards. The invitation used to link to
     * the sign-in *form*, so a button reading "sign in and add your work" meant
     * "go and ask us for a second email" — six actions and two emails before a
     * photographer saw anything of their own.
     */
    expect(url.pathname).toBe("/contribute/verify");
    expect(url.searchParams.get("token")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("gives the invitation a week to be opened", async () => {
    responses = [[{ id: "c1" }]];

    await invitationUrl("shooter@example.test");

    expect(ttlOf(insertInto("login_tokens"))).toBeCloseTo(
      INVITE_TTL_MINUTES,
      0,
    );
  });

  it("falls back to the form rather than mailing a dead link", async () => {
    // Minting returns null for an address it cannot place. An invitation with
    // no usable link at all would be worse than one pointing at the form.
    responses = [[]];
    memberExists.mockResolvedValue(false);

    const url = new URL(await invitationUrl("nobody@example.test"));

    expect(url.pathname).toBe("/contribute");
    expect(url.searchParams.get("token")).toBeNull();
  });
});
