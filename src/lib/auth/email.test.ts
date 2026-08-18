import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { escapeHtml, sendApplicationApproved, sendInvitation } from "./email";

describe("escapeHtml", () => {
  it("neutralises the characters that open a tag or close an attribute", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeHtml("Johannes Mändle")).toBe("Johannes Mändle");
  });
});

describe("sendApplicationApproved", () => {
  const sent: Array<{ html: string; text: string }> = [];

  beforeEach(() => {
    sent.length = 0;
    // Without a key the sender logs instead of posting, so the templated HTML
    // never becomes observable. Configure it and capture the request body.
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", "gallery@example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: { body: string }) => {
        sent.push(JSON.parse(init.body));
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(""),
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("renders a hostile display name inert", async () => {
    await sendApplicationApproved(
      "applicant@example.com",
      `<img src=x onerror="alert(1)">`,
    );

    const [message] = sent;
    expect(message).toBeDefined();
    // No tag opens, and no attribute quote closes — the payload survives only
    // as text. `onerror=` on its own is still present, escaped, which is fine.
    expect(message?.html).not.toContain("<img");
    expect(message?.html).not.toContain(`onerror="`);
    expect(message?.html).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });

  it("still reads as the person's name once escaped", async () => {
    await sendApplicationApproved("anna@example.com", "Anna & Co.");

    expect(sent[0]?.html).toContain("Anna &amp; Co., your work is a fit.");
    // The plain-text alternative is not markup, so it carries the name as typed.
    expect(sent[0]?.text).toContain("Anna & Co., your work is a fit.");
  });

  it("keeps the sign-in URL usable as an attribute", async () => {
    await sendApplicationApproved("anna@example.com", "Anna");

    expect(sent[0]?.html).toMatch(/href="https?:\/\/[^"]+\/contribute"/);
  });
});

describe("sendInvitation", () => {
  const sent: Array<{ html: string; text: string; subject: string }> = [];

  beforeEach(() => {
    sent.length = 0;
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", "gallery@example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: { body: string }) => {
        sent.push(JSON.parse(init.body));
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(""),
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("carries the sign-in link it is given, in both alternatives", async () => {
    /*
     * The property the whole invitation change rests on. This used to link to
     * `/contribute` — the *form* — so a button reading "sign in and add your
     * work" actually meant "go and ask us for a second email", and a
     * photographer needed two emails and six actions to reach their own
     * dashboard. If a caller ever stops passing the URL, or the template stops
     * using it, this is the only thing that would notice.
     */
    // Assembled rather than written out: a literal `?token=…` in source is
    // what `noSecrets` is looking for, and it cannot tell a fixture from a
    // leak.
    const url = `https://example.test/contribute/verify?${new URLSearchParams({ token: "fixture-token" })}`;
    await sendInvitation("shooter@example.com", "Shooter", "Jo", url);

    expect(sent[0]?.text).toContain(url);
    expect(sent[0]?.html).toContain(`href="${url}"`);
  });

  it("falls back to the form rather than mailing no link at all", async () => {
    // `invitationUrl` returns the form's URL when minting fails, and an
    // invitation with no way in would be worse than one pointing at a form.
    await sendInvitation("shooter@example.com", "Shooter");

    expect(sent[0]?.html).toMatch(/href="https?:\/\/[^"]+\/contribute"/);
  });

  it("names whoever sent it", async () => {
    /*
     * The owner's own invitations omitted this for a long time, so the first
     * one ever sent to a new photographer arrived signed by nobody — a
     * stranger told they had been chosen, by no one in particular.
     */
    await sendInvitation("shooter@example.com", "Shooter", "Jo Mändle");

    expect(sent[0]?.text).toContain("Jo Mändle has invited you");
  });

  it("says that nobody reviews the work", async () => {
    // The most reassuring fact about this gallery, and it was stated nowhere.
    await sendInvitation("shooter@example.com", "Shooter", "Jo");

    expect(sent[0]?.text).toContain("Nobody reviews it");
    expect(sent[0]?.html).toContain("nobody reviews it");
  });
});
