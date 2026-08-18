import { describe, expect, it } from "vitest";
import { normaliseEmail, pickFreeSlug, slugify } from "./slug";

describe("slugify", () => {
  it("makes a url-safe handle from a display name", () => {
    expect(slugify("Anna Weber")).toBe("anna-weber");
  });

  it("keeps the letter when folding diacritics", () => {
    // Stripping rather than decomposing would give "mndle".
    expect(slugify("Johannes Mändle")).toBe("johannes-mandle");
  });

  it("collapses punctuation and trims the edges", () => {
    expect(slugify("  ~ J. P. O'Neill ~ ")).toBe("j-p-o-neill");
  });

  it("never leaves a trailing dash after truncation", () => {
    expect(slugify(`${"a".repeat(47)} bcd`)).not.toMatch(/-$/);
  });

  it("falls back rather than returning an empty handle", () => {
    expect(slugify("!!!")).toBe("contributor");
  });
});

describe("pickFreeSlug", () => {
  it("uses the bare slug when nothing has claimed it", () => {
    expect(pickFreeSlug("anna-weber", [])).toBe("anna-weber");
  });

  it("suffixes from 2 when the name is taken", () => {
    expect(pickFreeSlug("anna-weber", ["anna-weber"])).toBe("anna-weber-2");
  });

  it("skips over suffixes already in use", () => {
    expect(
      pickFreeSlug("anna-weber", [
        "anna-weber",
        "anna-weber-2",
        "anna-weber-3",
      ]),
    ).toBe("anna-weber-4");
  });

  it("ignores gaps rather than reusing a freed handle", () => {
    // Reusing "anna-weber-2" would silently redirect an old shared link to a
    // different photographer.
    expect(pickFreeSlug("anna-weber", ["anna-weber", "anna-weber-3"])).toBe(
      "anna-weber-2",
    );
  });
});

describe("normaliseEmail", () => {
  it("lowercases and trims so an invite matches the sign-in attempt", () => {
    expect(normaliseEmail("  Anna@Example.COM ")).toBe("anna@example.com");
  });
});
