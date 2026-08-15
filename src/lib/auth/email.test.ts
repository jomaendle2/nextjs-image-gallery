import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { escapeHtml, sendApplicationApproved } from "./email";

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
