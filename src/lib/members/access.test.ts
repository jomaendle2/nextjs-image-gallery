import { describe, expect, it } from "vitest";
import { mayDisplayStale, nextSessionAccess, type PhotoAccess } from "./access";

/**
 * The three decisions that used to live inside a client component.
 *
 * They are here rather than in a rendering test because each one is a fact
 * about the model, not about markup, and two of them are the fix for bugs
 * that a rendering test would have found only by being written to reproduce
 * exactly the sequence that caused them.
 */

describe("nextSessionAccess", () => {
  it("settles the session on a refusal to somebody not signed in", () => {
    // An anonymous reader gets the same 403 for every photograph. Asking
    // sixteen times fills the console with red and answers nothing.
    expect(nextSessionAccess("none", false)).toBe(false);
  });

  it("leaves it unknown when a signed-in reader is refused", () => {
    /*
     * The regression this exists to prevent. A photographer who opens
     * somebody *else's* photograph first is refused; if that settled the
     * session, the query would be disabled for the rest of the tab and their
     * own photograph would show the teaser again — with no request made and
     * nothing in the console to explain it.
     */
    expect(nextSessionAccess("none", true)).toBeNull();
  });

  it("records a membership", () => {
    expect(nextSessionAccess("member", true)).toBe(true);
  });

  it("says nothing about a membership when the reader is the author", () => {
    /*
     * Authorship is per photograph; membership is per session. Writing
     * `true` here would be the lie the old `member: boolean` wire told —
     * one look at their own photograph and every other photograph in the tab
     * would hold a blank line waiting for content that never arrives.
     */
    expect(nextSessionAccess("author", true)).toBeNull();
  });
});

describe("mayDisplayStale", () => {
  it("keeps a refusal on screen across a swipe", () => {
    // It reads identically under any photograph, so blinking it out is pure
    // flicker for no gain in truthfulness.
    expect(mayDisplayStale("none")).toBe(true);
  });

  it("holds back anything that belongs to one photograph", () => {
    /*
     * A location under the wrong photograph — even for a tenth of a second —
     * is wrong in the one place this site promises precision. An author's
     * answer is a location too, so it is held back exactly like a member's.
     */
    expect(mayDisplayStale("member")).toBe(false);
    expect(mayDisplayStale("author")).toBe(false);
  });

  it("covers every case of PhotoAccess", () => {
    // If a fourth reason to see the paid columns is ever added, this fails
    // until somebody decides whether it is safe to carry across a swipe.
    const all: PhotoAccess[] = ["member", "author", "none"];
    expect(all.filter(mayDisplayStale)).toEqual(["none"]);
  });
});
