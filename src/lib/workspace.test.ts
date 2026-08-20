import { describe, expect, it } from "vitest";
import { code, read } from "./source-text";

/**
 * Invariants about the contributor workspace's own shape.
 *
 * A sibling of the security files, and the same technique for a different
 * kind of failure: this is not about what a stranger can reach, it is about a
 * condition that has to be written exactly once because writing it twice is
 * invisible until somebody sees the page.
 */

/**
 * The first-publish moment is one either/or, not two predicates.
 *
 * `published.length === 1` selected the celebration card, and
 * `published.length === 1 ? null :` suppressed the link row above it — the
 * same question in opposite polarity, thirty-eight lines apart, with the
 * reason recorded only at the first of them. Widening one and missing the
 * other gives exactly the layout the reason exists to prevent: two links to
 * `/by/<slug>` a hand's width apart and the same invitation count stated
 * twice, on the screen the whole feature exists to make feel like a moment.
 *
 * Counting rather than reading, because the failure is a *second* occurrence
 * and no type or lint rule has an opinion about one.
 */
describe("the first-publish card and the link row are one branch", () => {
  const page = code(read("app", "contribute", "photos", "page.tsx"));
  const slice = page.slice(
    page.indexOf('title="Your photographs"'),
    page.indexOf("<UnsavedGuard />"),
  );

  it("finds the region at all", () => {
    // If the anchors stop matching, this test is measuring nothing.
    expect(slice.length).toBeGreaterThan(0);
  });

  it("asks whether exactly one photograph is published exactly once", () => {
    expect(slice.split("published.length === 1").length - 1).toBe(1);
  });
});
