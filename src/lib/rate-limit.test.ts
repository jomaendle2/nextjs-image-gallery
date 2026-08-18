import { describe, expect, it } from "vitest";
import { createLimiter, memberViewLimiter } from "./rate-limit";

const WINDOW = 1000;

describe("createLimiter", () => {
  it("allows attempts up to the limit", () => {
    const limiter = createLimiter(3, WINDOW);
    expect(limiter.check("a", 0)).toBe(true);
    expect(limiter.check("a", 1)).toBe(true);
    expect(limiter.check("a", 2)).toBe(true);
  });

  it("rejects the attempt after the limit", () => {
    const limiter = createLimiter(3, WINDOW);
    for (const t of [0, 1, 2]) {
      limiter.check("a", t);
    }
    expect(limiter.check("a", 3)).toBe(false);
  });

  it("keeps rejecting for the rest of the window", () => {
    const limiter = createLimiter(1, WINDOW);
    limiter.check("a", 0);
    expect(limiter.check("a", WINDOW - 1)).toBe(false);
  });

  it("releases the key once the window has passed", () => {
    const limiter = createLimiter(1, WINDOW);
    limiter.check("a", 0);
    expect(limiter.check("a", WINDOW)).toBe(true);
  });

  it("counts each key separately", () => {
    const limiter = createLimiter(1, WINDOW);
    limiter.check("a", 0);
    expect(limiter.check("b", 0)).toBe(true);
  });

  it("does not let one blocked key keep another blocked", () => {
    const limiter = createLimiter(1, WINDOW);
    limiter.check("a", 0);
    expect(limiter.check("a", 0)).toBe(false);
    expect(limiter.check("b", 0)).toBe(true);
    expect(limiter.check("b", 0)).toBe(false);
  });

  it("evicts expired windows instead of growing forever", () => {
    // A long-lived instance would otherwise hold one entry per address ever
    // seen. Sweeping on each new window keeps the map bounded.
    const limiter = createLimiter(1, WINDOW);
    for (let i = 0; i < 100; i += 1) {
      limiter.check(`key-${i}`, 0);
    }
    // A fresh window sweeps the stale entries, so an old key starts over.
    expect(limiter.check("fresh", WINDOW * 2)).toBe(true);
    expect(limiter.check("key-0", WINDOW * 2)).toBe(true);
  });
});

/**
 * The dedup that keeps a refresh key out of the revenue split.
 *
 * These drive the **exported instance**, not a local `createLimiter(1, …)`
 * built to match it. The first version did the latter, which made them
 * worthless in the one way that matters: changing `memberViewLimiter` to
 * `createLimiter(5, ...)` would have left every assertion green while the
 * guard on the numbers that divide money between photographers quietly
 * stopped working. A test that reconstructs its subject tests the
 * reconstruction.
 *
 * `check` takes `now`, so the window can be crossed without waiting and
 * without a fake clock. Keys are distinct per test because the instance is
 * shared across this file for the life of the module — which is the same
 * reason it works in production.
 */
describe("memberViewLimiter", () => {
  it("counts a member's view of one photograph once", () => {
    expect(memberViewLimiter.check("anna@example.test:photo-a")).toBe(true);
    // The refresh key, which used to add a view per press.
    expect(memberViewLimiter.check("anna@example.test:photo-a")).toBe(false);
    expect(memberViewLimiter.check("anna@example.test:photo-a")).toBe(false);
  });

  it("counts each photograph separately", () => {
    expect(memberViewLimiter.check("bo@example.test:photo-b")).toBe(true);
    expect(memberViewLimiter.check("bo@example.test:photo-c")).toBe(true);
  });

  it("counts each member separately", () => {
    // Two members reading one photograph is two views, which is the whole
    // thing the number is supposed to measure.
    expect(memberViewLimiter.check("cass@example.test:photo-d")).toBe(true);
    expect(memberViewLimiter.check("dev@example.test:photo-d")).toBe(true);
  });

  it("counts again the next day, with a window that overlaps midnight", () => {
    const now = 1_000_000;
    const key = "eli@example.test:photo-e";
    expect(memberViewLimiter.check(key, now)).toBe(true);
    expect(memberViewLimiter.check(key, now + 60_000)).toBe(false);

    /*
     * Still refused a full day later. The window is rolling per key while
     * `recordMemberView` buckets by `CURRENT_DATE`, and that hour of overlap
     * is what stops a view taken just before midnight being counted again
     * just after it. Asserting both sides of the hour pins the choice: at 24
     * hours exactly this would already have reset.
     */
    expect(memberViewLimiter.check(key, now + 24 * 60 * 60 * 1000)).toBe(false);
    expect(memberViewLimiter.check(key, now + 25 * 60 * 60 * 1000)).toBe(true);
  });
});
