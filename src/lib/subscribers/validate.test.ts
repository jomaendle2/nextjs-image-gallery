import { describe, expect, it } from "vitest";
import { validateSubscription } from "./validate";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

// biome-ignore lint/security/noSecrets: the name of the function under test
describe("validateSubscription", () => {
  it("accepts an ordinary address", () => {
    expect(validateSubscription(form({ email: "anna@example.com" }))).toEqual({
      ok: true,
      email: "anna@example.com",
    });
  });

  it("trims surrounding whitespace", () => {
    const result = validateSubscription(form({ email: "  a@b.co  " }));
    expect(result).toEqual({ ok: true, email: "a@b.co" });
  });

  it("drops silently when the honeypot is filled", () => {
    const result = validateSubscription(
      form({ email: "bot@example.com", website: "http://spam.example" }),
    );
    expect(result).toEqual({ ok: false, error: "SILENT_DROP" });
  });

  it("asks for an address when the field is empty", () => {
    expect(validateSubscription(form({ email: "   " })).ok).toBe(false);
    expect(validateSubscription(form({})).ok).toBe(false);
  });

  it("rejects things that are plainly not addresses", () => {
    for (const value of ["anna", "anna@", "@example.com", "a b@c.de", "a@b"]) {
      expect(validateSubscription(form({ email: value })).ok).toBe(false);
    }
  });

  it("rejects an address longer than the standard allows", () => {
    const long = `${"a".repeat(250)}@example.com`;
    expect(validateSubscription(form({ email: long })).ok).toBe(false);
  });

  it("does not try to out-guess deliverability", () => {
    // Unusual but legal. The confirmation email is the real check; a regex
    // that rejected these would lose real people.
    for (const value of [
      "anna+gallery@example.com",
      "a.b.c@sub.domain.example",
      "anna@example.photography",
    ]) {
      expect(validateSubscription(form({ email: value })).ok).toBe(true);
    }
  });
});
