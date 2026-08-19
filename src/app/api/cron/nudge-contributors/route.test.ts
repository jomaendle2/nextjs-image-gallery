import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The run itself: who gets claimed, who gets mailed, and who gets neither.
 *
 * The schedule is tested next door in `nudges.test.ts` and needs nothing but
 * a clock. What this file covers is the part that cannot be pure — the bearer
 * check, the order of claim and send, the cap, and the dry run — and each of
 * those is a way to mail the wrong person or the same person twice.
 *
 * Everything below the route is a spy. That is the point: the assertions are
 * about *what the route did*, in what order, and a real database or provider
 * would only make that harder to see.
 */

const listNudgeCandidates = vi.fn();
const claimNudge = vi.fn();
const ensureNudgeToken = vi.fn();
const sendUploadNudge = vi.fn();
const sendDraftNudge = vi.fn();
const invitationUrl = vi.fn();

vi.mock("@/lib/auth/contributors", () => ({
  listNudgeCandidates: () => listNudgeCandidates(),
  claimNudge: (id: string, track: string, stage: number) =>
    claimNudge(id, track, stage),
  ensureNudgeToken: (id: string) => ensureNudgeToken(id),
}));

vi.mock("@/lib/auth/email", () => ({
  sendUploadNudge: (to: string, options: unknown) =>
    sendUploadNudge(to, options),
  sendDraftNudge: (to: string, options: unknown) => sendDraftNudge(to, options),
}));

vi.mock("@/lib/auth/tokens", () => ({
  invitationUrl: (email: string) => invitationUrl(email),
}));

const { GET } = await import("./route");

const SECRET = "cron-secret-for-tests";

/** Long enough ago to be due for stage 1 on the empty track. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "one",
    email: "anna@example.com",
    display_name: "Anna",
    created_at: daysAgo(3),
    revoked_at: null,
    nudge_token: null,
    nudges_muted_at: null,
    first_signed_in_at: null,
    photo_count: 0,
    published_count: 0,
    oldest_unpublished_at: null,
    empty_stage: 0,
    draft_stage: 0,
    last_sent_at: null,
    ...overrides,
  };
}

/** A request the way Vercel's scheduler makes it. */
function request(query = ""): {
  headers: Headers;
  nextUrl: { searchParams: URLSearchParams };
} {
  return {
    headers: new Headers({ authorization: `Bearer ${SECRET}` }),
    nextUrl: { searchParams: new URLSearchParams(query) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", SECRET);
  claimNudge.mockResolvedValue(true);
  ensureNudgeToken.mockResolvedValue("quiet-token");
  invitationUrl.mockResolvedValue("https://example.test/contribute/verify");
  sendUploadNudge.mockResolvedValue(undefined);
  sendDraftNudge.mockResolvedValue(undefined);
  listNudgeCandidates.mockResolvedValue([]);
});

describe("the door", () => {
  it("refuses to run at all when CRON_SECRET is unset", async () => {
    /*
     * Fail closed, and loudly. An unconfigured secret must not mean "no
     * check": this endpoint mails people, so the version of it that runs
     * without a secret is a way for anyone to burn somebody's whole sequence
     * in an afternoon.
     */
    vi.stubEnv("CRON_SECRET", "");
    // biome-ignore lint/suspicious/noExplicitAny: the route only reads two fields of the request
    const response = await GET(request() as any);

    expect(response.status).toBe(500);
    expect(listNudgeCandidates).not.toHaveBeenCalled();
  });

  it("refuses a wrong bearer token", async () => {
    const wrong = {
      headers: new Headers({ authorization: "Bearer nope" }),
      nextUrl: { searchParams: new URLSearchParams() },
    };
    // biome-ignore lint/suspicious/noExplicitAny: as above
    const response = await GET(wrong as any);

    expect(response.status).toBe(401);
    expect(listNudgeCandidates).not.toHaveBeenCalled();
  });
});

describe("a dry run", () => {
  it("returns the plan and touches nothing", async () => {
    /*
     * The property the first production run depends on. `?dry=1` is how the
     * list of addresses gets read by a person before 09:00 the next morning,
     * and a preview that claimed stages would spend the sequence it was
     * meant to preview.
     */
    listNudgeCandidates.mockResolvedValue([candidate()]);
    // biome-ignore lint/suspicious/noExplicitAny: as above
    const response = await GET(request("dry=1") as any);
    const body = (await response.json()) as {
      dry: boolean;
      due: number;
      plan: { email: string; track: string; stage: number }[];
    };

    expect(body.dry).toBe(true);
    expect(body.due).toBe(1);
    expect(body.plan[0]).toMatchObject({
      email: "anna@example.com",
      track: "empty",
      stage: 1,
    });
    expect(claimNudge).not.toHaveBeenCalled();
    expect(sendUploadNudge).not.toHaveBeenCalled();
    expect(invitationUrl).not.toHaveBeenCalled();
  });
});

describe("a real run", () => {
  it("claims the stage before it sends anything", async () => {
    /*
     * The order is the design. Claiming first means a send that throws costs
     * one missed message; sending first would mean a crash between the two
     * mails it again tomorrow — and a duplicate is the worse failure.
     */
    listNudgeCandidates.mockResolvedValue([candidate()]);
    const order: string[] = [];
    claimNudge.mockImplementation(() => {
      order.push("claim");
      return Promise.resolve(true);
    });
    sendUploadNudge.mockImplementation(() => {
      order.push("send");
      return Promise.resolve();
    });

    // biome-ignore lint/suspicious/noExplicitAny: as above
    await GET(request() as any);

    expect(order).toEqual(["claim", "send"]);
    expect(claimNudge).toHaveBeenCalledWith("one", "empty", 1);
  });

  it("sends nothing when the claim was already taken", async () => {
    // A retried run, two overlapping crons, or a hand-run during an incident.
    listNudgeCandidates.mockResolvedValue([candidate()]);
    claimNudge.mockResolvedValue(false);

    // biome-ignore lint/suspicious/noExplicitAny: as above
    const response = await GET(request() as any);
    const body = (await response.json()) as { sent: number; skipped: number };

    expect(sendUploadNudge).not.toHaveBeenCalled();
    expect(body).toMatchObject({ sent: 0, skipped: 1 });
  });

  it("mints a fresh sign-in link rather than reusing the invitation's", async () => {
    /*
     * The whole reason this route exists rather than a template with a
     * stored URL: the original invite token is single-use and seven days
     * old, so a day-37 nudge carrying it would be a dead link — which is
     * worse than no nudge, because it teaches the reader that this
     * gallery's mail does not work.
     */
    listNudgeCandidates.mockResolvedValue([candidate()]);

    // biome-ignore lint/suspicious/noExplicitAny: as above
    await GET(request() as any);

    expect(invitationUrl).toHaveBeenCalledWith("anna@example.com");
    expect(sendUploadNudge).toHaveBeenCalledWith(
      "anna@example.com",
      expect.objectContaining({
        signInUrl: "https://example.test/contribute/verify",
        quietUrl: expect.stringContaining("token=quiet-token"),
        stage: 1,
      }),
    );
  });

  it("refuses to send when no opt-out token could be minted", async () => {
    // A nudge without a working way out is the message that earns a spam
    // report, and a spam report costs the domain rather than the address.
    listNudgeCandidates.mockResolvedValue([candidate()]);
    ensureNudgeToken.mockResolvedValue(null);

    // biome-ignore lint/suspicious/noExplicitAny: as above
    const response = await GET(request() as any);
    const body = (await response.json()) as { sent: number; failed: number };

    expect(sendUploadNudge).not.toHaveBeenCalled();
    expect(body).toMatchObject({ sent: 0, failed: 1 });
  });

  it("routes a drafter to the draft template, with the count", async () => {
    listNudgeCandidates.mockResolvedValue([
      candidate({
        photo_count: 3,
        published_count: 0,
        oldest_unpublished_at: daysAgo(2),
      }),
    ]);

    // biome-ignore lint/suspicious/noExplicitAny: as above
    await GET(request() as any);

    expect(sendUploadNudge).not.toHaveBeenCalled();
    expect(sendDraftNudge).toHaveBeenCalledWith(
      "anna@example.com",
      expect.objectContaining({ drafts: 3, stage: 1 }),
    );
  });

  it("leaves somebody who has published alone entirely", async () => {
    // The behaviour the whole feature is judged on: publishing ends the
    // sequence mid-flight, without anything having been flagged when it began.
    listNudgeCandidates.mockResolvedValue([
      candidate({ photo_count: 2, published_count: 1 }),
    ]);

    // biome-ignore lint/suspicious/noExplicitAny: as above
    const response = await GET(request() as any);
    const body = (await response.json()) as { due: number; sent: number };

    expect(body).toMatchObject({ due: 0, sent: 0 });
    expect(claimNudge).not.toHaveBeenCalled();
  });

  it("one failure does not end the run for everybody behind it", async () => {
    listNudgeCandidates.mockResolvedValue([
      candidate({ id: "one", email: "anna@example.com" }),
      candidate({ id: "two", email: "bo@example.com" }),
    ]);
    sendUploadNudge.mockRejectedValueOnce(new Error("provider said no"));

    // biome-ignore lint/suspicious/noExplicitAny: as above
    const response = await GET(request() as any);
    const body = (await response.json()) as { sent: number; failed: number };

    expect(body).toMatchObject({ sent: 1, failed: 1 });
  });

  it("caps a run and defers the rest rather than truncating quietly", async () => {
    /*
     * Resend's default rate limit is low and this is a loop with an await in
     * it. The cap matters most on the very first production run, against a
     * list that accumulated before the feature existed — and the warning
     * matters because a silent truncation reads afterwards as "everybody was
     * covered".
     */
    const many = Array.from({ length: 45 }, (_unused, index) =>
      candidate({ id: `p${index}`, email: `p${index}@example.com` }),
    );
    listNudgeCandidates.mockResolvedValue(many);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // biome-ignore lint/suspicious/noExplicitAny: as above
    const response = await GET(request() as any);
    const body = (await response.json()) as { due: number; sent: number };

    expect(body.due).toBe(45);
    expect(body.sent).toBe(40);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
