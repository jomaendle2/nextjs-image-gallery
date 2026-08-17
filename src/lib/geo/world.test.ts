import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { WORLD_PATH, WORLD_RINGS } from "./world";

/**
 * Two things about a generated file that nobody will re-read.
 *
 * `world.ts` is forty thousand characters of numbers produced by a script.
 * Nobody is going to check it in a diff, and the two ways it can go wrong
 * without anybody noticing are the two checked here: it can stop being a
 * coastline, and it can quietly become thirty times larger.
 *
 * The second is the one that matters more. Natural Earth ships the same
 * layer at 1:50m and 1:10m, they have identical shapes and file names, and
 * at the sizes this site draws them they look the same — so swapping one in
 * is an easy, invisible way to put a megabyte of coastline into the payload
 * of every photograph's detail sheet.
 */

const GENERATED = join(import.meta.dirname, "world.ts");

/*
 * Roughly 50% headroom over what the 110m dataset produces today, and about
 * an order of magnitude below what 1:50m would. It is a tripwire, not a
 * budget: if a legitimate change needs more room, raise it deliberately and
 * say why here.
 */
const CEILING_GZIP_BYTES = 28_000;

describe("the committed coastline stays small", () => {
  it("is under the byte ceiling, gzipped", () => {
    const gzipped = gzipSync(readFileSync(GENERATED)).length;
    expect(
      gzipped,
      "world.ts grew. If the 10m or 50m dataset was swapped in, put 110m " +
        "back — at 160px and on a 400px globe they are indistinguishable.",
    ).toBeLessThan(CEILING_GZIP_BYTES);
  });

  /*
   * The split matters as much as the total. `WORLD_PATH` ships to every
   * gallery page; `WORLD_RINGS` ships only to `/globe`. If the path were
   * ever regenerated at the globe's tolerance, the detail sheet of every
   * photograph would carry four times the bytes for detail that lands
   * inside a single pixel.
   */
  it("keeps the per-photograph path far smaller than the globe's rings", () => {
    const pathBytes = gzipSync(WORLD_PATH).length;
    const ringBytes = gzipSync(JSON.stringify(WORLD_RINGS)).length;
    expect(pathBytes).toBeLessThan(6000);
    expect(pathBytes).toBeLessThan(ringBytes);
  });

  it("records where the numbers came from", () => {
    const source = readFileSync(GENERATED, "utf8");
    expect(source).toContain("Natural Earth");
    expect(source).toContain("scripts/build-world.mts");
    expect(source).toMatch(/Generated \d{4}-\d{2}-\d{2}/);
  });
});

describe("the rings are coordinates", () => {
  it("is a non-trivial number of landmasses", () => {
    expect(WORLD_RINGS.length).toBeGreaterThan(50);
  });

  it("holds flat lng/lat pairs, so every ring has an even length", () => {
    for (const ring of WORLD_RINGS) {
      expect(ring.length % 2).toBe(0);
      // Three points is the minimum that encloses anything.
      expect(ring.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("stays inside the world", () => {
    for (const ring of WORLD_RINGS) {
      for (let index = 0; index < ring.length; index += 2) {
        const lng = ring[index];
        const lat = ring[index + 1];
        expect(lng).toBeGreaterThanOrEqual(-180);
        expect(lng).toBeLessThanOrEqual(180);
        expect(lat).toBeGreaterThanOrEqual(-90);
        expect(lat).toBeLessThanOrEqual(90);
      }
    }
  });

  /*
   * A closed ring, because the globe strokes it as an open polyline and an
   * unclosed one leaves a visible slit across a continent.
   */
  it("closes every ring", () => {
    for (const ring of WORLD_RINGS) {
      expect(ring.slice(0, 2)).toEqual(ring.slice(-2));
    }
  });

  it("actually covers the inhabited world, not one hemisphere", () => {
    const lngs = WORLD_RINGS.flatMap((ring) =>
      ring.filter((_, index) => index % 2 === 0),
    );
    const lats = WORLD_RINGS.flatMap((ring) =>
      ring.filter((_, index) => index % 2 === 1),
    );
    expect(Math.min(...lngs)).toBeLessThan(-150);
    expect(Math.max(...lngs)).toBeGreaterThan(150);
    // Antarctica at the bottom, northern Greenland at the top.
    expect(Math.min(...lats)).toBeLessThan(-80);
    expect(Math.max(...lats)).toBeGreaterThan(80);
  });
});

describe("the path is drawable in the 0 0 360 180 box", () => {
  it("uses only the three commands a coastline needs", () => {
    expect(WORLD_PATH).toMatch(/^M[\d\s.ZLM-]+$/);
    expect(WORLD_PATH).not.toMatch(/[CSQTAcsqta]/);
  });

  it("closes every subpath", () => {
    const opens = WORLD_PATH.match(/M/g)?.length ?? 0;
    const closes = WORLD_PATH.match(/Z/g)?.length ?? 0;
    expect(opens).toBe(closes);
    expect(opens).toBeGreaterThan(20);
  });

  /*
   * The projection is `x = lng + 180`, `y = 90 - lat`, so every number in
   * the path has to land inside the box the consumer declares as its
   * viewBox. A point outside it is a coastline drawn off-canvas.
   */
  it("stays inside its own viewBox", () => {
    const pairs = WORLD_PATH.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g);
    let counted = 0;
    for (const [, x, y] of pairs) {
      expect(Number(x)).toBeGreaterThanOrEqual(0);
      expect(Number(x)).toBeLessThanOrEqual(360);
      expect(Number(y)).toBeGreaterThanOrEqual(0);
      expect(Number(y)).toBeLessThanOrEqual(180);
      counted += 1;
    }
    expect(counted).toBeGreaterThan(200);
  });
});
