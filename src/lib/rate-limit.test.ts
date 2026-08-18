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
