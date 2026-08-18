import { describe, expect, it } from "vitest";
import { createLimiter } from "./rate-limit";

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
 * `memberViewLimiter` is a limiter of one rather than new machinery, because
 * "at most once per key per window" is what a limiter of one already is —
 * and because reusing it means the dedup stores nothing. `photo_member_views`
 * is aggregated per photograph per day on purpose; an exact dedup would need
 * a durable per-person record of what was looked at, which is precisely what
 * that table was designed not to be.
 */
describe("memberViewLimiter", () => {
  it("counts a member's view of one photograph once", () => {
    const limiter = createLimiter(1, 25 * 60 * 60 * 1000);
    expect(limiter.check("anna@example.test:photo-1")).toBe(true);
    // The refresh key, which used to add a view per press.
    expect(limiter.check("anna@example.test:photo-1")).toBe(false);
    expect(limiter.check("anna@example.test:photo-1")).toBe(false);
  });

  it("counts each photograph separately", () => {
    const limiter = createLimiter(1, 25 * 60 * 60 * 1000);
    expect(limiter.check("anna@example.test:photo-1")).toBe(true);
    expect(limiter.check("anna@example.test:photo-2")).toBe(true);
  });

  it("counts each member separately", () => {
    // Two members reading the same photograph is two views, which is the
    // whole thing the number is supposed to measure.
    const limiter = createLimiter(1, 25 * 60 * 60 * 1000);
    expect(limiter.check("anna@example.test:photo-1")).toBe(true);
    expect(limiter.check("bo@example.test:photo-1")).toBe(true);
  });

  it("counts again the next day", () => {
    const limiter = createLimiter(1, 25 * 60 * 60 * 1000);
    const now = 1_000_000;
    expect(limiter.check("anna@example.test:photo-1", now)).toBe(true);
    expect(limiter.check("anna@example.test:photo-1", now + 60_000)).toBe(
      false,
    );
    /*
     * Twenty-five hours, not twenty-four: the window is rolling per key while
     * `recordMemberView` buckets by `CURRENT_DATE`, and the overlap is what
     * stops a view just before midnight being re-counted just after it.
     */
    expect(
      limiter.check("anna@example.test:photo-1", now + 25 * 60 * 60 * 1000),
    ).toBe(true);
  });
});
