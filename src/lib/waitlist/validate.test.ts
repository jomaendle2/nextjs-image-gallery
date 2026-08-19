import { describe, expect, it } from "vitest";
import { EARLY_ACCESS, isEarlyAccessTier, TIERS } from "./tiers";
import { validateEarlyAccess } from "./validate";

/**
 * The form that carries the whole point of `/pricing`.
 *
 * Worth testing rather than eyeballing because what it produces is a count
 * somebody will make a build-or-abandon decision from. A validator that
 * quietly accepts a second row for the same person, or files a request under
 * a tier that is not offered, does not fail loudly — it returns a number
 * that is wrong in the direction its author was hoping for.
 */

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    data.set(name, value);
  }
  return data;
}

const VALID = { email: "reader@example.com", tier: "pro" };

describe("validateEarlyAccess", () => {
  it("accepts an address and a tier", () => {
    const result = validateEarlyAccess(form(VALID));
    expect(result).toEqual({
      ok: true,
      value: {
        email: "reader@example.com",
        tier: "pro",
        note: "",
        screens: null,
      },
    });
  });

  it("normalises the address, so one person is one row", () => {
    const result = validateEarlyAccess(
      form({ ...VALID, email: "  Reader@Example.COM " }),
    );
    expect(result.ok && result.value.email).toBe("reader@example.com");
  });

  it("reports a filled honeypot as the same drop the other forms use", () => {
    const result = validateEarlyAccess(
      form({ ...VALID, website: "https://spam.example" }),
    );
    expect(result).toEqual({ ok: false, error: "SILENT_DROP" });
  });

  it("refuses an address that is not one", () => {
    expect(validateEarlyAccess(form({ ...VALID, email: "reader" })).ok).toBe(
      false,
    );
    expect(validateEarlyAccess(form({ ...VALID, email: "" })).ok).toBe(false);
  });

  /*
   * The check that keeps the register countable. `tier` is a hidden input, so
   * anything unrecognised arriving here is a crafted POST — and the cost of
   * accepting one is a row counted under a heading nobody reads.
   */
  it("refuses a tier that is not on offer", () => {
    for (const tier of ["free", "member", "enterprise", ""]) {
      expect(validateEarlyAccess(form({ ...VALID, tier })).ok).toBe(false);
    }
  });

  describe("screens", () => {
    it("is optional", () => {
      const result = validateEarlyAccess(
        form({ email: VALID.email, tier: "spaces", screens: "" }),
      );
      expect(result.ok && result.value.screens).toBeNull();
    });

    it("takes a whole number", () => {
      const result = validateEarlyAccess(
        form({ email: VALID.email, tier: "spaces", screens: "6" }),
      );
      expect(result.ok && result.value.screens).toBe(6);
    });

    /*
     * `parseInt` would have accepted every one of these and stored a number
     * nobody typed. The field ends up in front of the person who filled it
     * in, on a call, so guessing is worse than asking again.
     */
    it("refuses anything that is not one, rather than guessing", () => {
      for (const screens of ["6 screens", "6.5", "0", "-2", "9999", "many"]) {
        const result = validateEarlyAccess(
          form({ email: VALID.email, tier: "spaces", screens }),
        );
        expect(result.ok, `accepted ${screens}`).toBe(false);
      }
    });

    it("is dropped when it arrives against the tier that has no screens", () => {
      const result = validateEarlyAccess(
        form({ email: VALID.email, tier: "pro", screens: "6" }),
      );
      expect(result.ok && result.value.screens).toBeNull();
    });
  });
});

describe("the tiers a form accepts are the tiers the page shows", () => {
  /*
   * The drift this exists to catch: a tier marked `draft` on the page with
   * no matching entry in `EARLY_ACCESS` renders a form that refuses every
   * submission, and the failure looks like nobody being interested.
   */
  it("every draft tier can be requested", () => {
    const drafts = TIERS.filter((tier) => tier.status === "draft").map(
      (tier) => tier.id,
    );
    expect([...EARLY_ACCESS].sort()).toEqual(drafts.sort());
  });

  it("no live tier can be requested", () => {
    for (const tier of TIERS.filter(
      (candidate) => candidate.status === "live",
    )) {
      expect(isEarlyAccessTier(tier.id)).toBe(false);
    }
  });
});
