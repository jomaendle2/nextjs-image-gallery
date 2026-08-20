import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one-click unsubscribe endpoint, which mail clients call unattended.
 *
 * Its contract is not really with a person: Gmail POSTs here on the reader's
 * behalf, and what it needs is a 200 and no argument. Everything below is a
 * property of that contract, including the one that reads oddly out of
 * context — an unknown token still answers 200, because a 404 would make this
 * a way to test tokens and would tell the client nothing it could act on.
 */

const muteNudges = vi.fn();
vi.mock("@/lib/auth/contributors", () => ({
  muteNudges: (token: string) => muteNudges(token),
}));

const route = await import("./route");

function post(query: string): { nextUrl: { searchParams: URLSearchParams } } {
  return { nextUrl: { searchParams: new URLSearchParams(query) } };
}

beforeEach(() => {
  vi.clearAllMocks();
  muteNudges.mockResolvedValue(true);
});

describe("POST /api/quiet", () => {
  it("mutes the contributor holding the token", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: the route reads only the URL
    const response = await route.POST(post("token=abc") as any);

    expect(muteNudges).toHaveBeenCalledWith("abc");
    expect(response.status).toBe(200);
  });

  it("answers 200 for a token that matches nobody", async () => {
    muteNudges.mockResolvedValue(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // biome-ignore lint/suspicious/noExplicitAny: as above
    const response = await route.POST(post("token=stale") as any);

    expect(response.status).toBe(200);
    // Quietly to the caller, loudly to us: a header pointing at a token
    // nothing matches means every reader of that message has a dead opt-out.
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("treats a missing token as an empty one", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: as above
    const response = await route.POST(post("") as any);

    expect(muteNudges).toHaveBeenCalledWith("");
    expect(response.status).toBe(200);
  });
});

describe("the shape of the endpoint", () => {
  it("exports no GET at all", () => {
    /*
     * The whole reason this is a POST. Corporate link scanners — SafeLinks,
     * Proofpoint, Barracuda — fetch every URL in an inbound message before
     * the recipient sees it, so a GET here would mute entire organisations
     * before anybody read the mail, and they would never learn why the
     * gallery had gone quiet. Scanners do not POST.
     */
    expect(route).not.toHaveProperty("GET");
  });
});
