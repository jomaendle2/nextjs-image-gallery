import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { allSourceFiles, code, read, SRC } from "../source-text";
import { WORLD_LAND } from "./world";
import {
  WORLD_NORTH,
  WORLD_PATH,
  WORLD_SOUTH,
  WORLD_VIEW_BOX,
} from "./world-path";

/** Every ring of every polygon, flattened, for the checks that ignore holes. */
const RINGS = WORLD_LAND.flat();

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

const GEO = import.meta.dirname;
const PATH_FILE = join(GEO, "world-path.ts");
const GLOBE_FILE = join(GEO, "world.ts");
const FINE_FILE = join(GEO, "world-fine.ts");
const FINEST_FILE = join(GEO, "world-finest.ts");

/*
 * A budget per file, sized by how many pages each one reaches. These are
 * tripwires rather than targets: the source is now Natural Earth 10m, so
 * output size is set entirely by the tolerances in `build-world.mts`, and
 * these numbers are what stops somebody loosening one without noticing which
 * pages pay for it.
 *
 * The reasoning that got here, kept because it was arrived at twice: source
 * resolution and output size are independent. A pre-generalised source (110m,
 * 50m) is somebody else's simplification at somebody else's scale, and
 * simplifying it again compounds two approximations — 110m gave an oval
 * Africa at every tolerance. 10m cut to a byte budget beats a coarser source
 * cut to the same budget, every time.
 */
const CEILINGS = {
  /* Every gallery page, for the mark in a photograph's detail sheet. */
  path: 12_000,
  /* `/globe` only. */
  globe: 34_000,
  /* Fetched by `import()` when the globe is opened, and never otherwise. */
  fine: 210_000,
  /*
   * Fetched only when a reader zooms past what `fine` can draw, which takes a
   * deliberate pinch or three presses of `+`.
   *
   * By far the largest number in this file, and the one most worth a
   * tripwire, because the temptation it guards against is real: zoom is
   * limited by how far apart the vertices are on screen, so "let me look
   * closer" always cashes out as "more coastline". There is no tolerance
   * that buys magnification cheaply, and a ceiling is what stops the next
   * person discovering that by shipping a megabyte.
   */
  finest: 560_000,
} as const;

describe("each file costs what the pages it reaches can afford", () => {
  it.each([
    { name: "world-path.ts", file: PATH_FILE, ceiling: CEILINGS.path },
    { name: "world.ts", file: GLOBE_FILE, ceiling: CEILINGS.globe },
    { name: "world-fine.ts", file: FINE_FILE, ceiling: CEILINGS.fine },
    { name: "world-finest.ts", file: FINEST_FILE, ceiling: CEILINGS.finest },
  ])("$name is under its ceiling, gzipped", ({ file, ceiling }) => {
    expect(gzipSync(readFileSync(file)).length).toBeLessThan(ceiling);
  });

  /*
   * Three modules rather than one, and this is the assertion that the split
   * is real. A single module with three exports would leave the guarantee to
   * tree-shaking, which works — and which nobody would notice had stopped
   * working, because the symptom is a slower page rather than a broken one.
   */
  it("keeps the flat map in a module of its own", () => {
    const pathSource = readFileSync(PATH_FILE, "utf8");
    expect(pathSource).toContain("WORLD_PATH");
    expect(pathSource).not.toContain("WORLD_LAND");
    expect(readFileSync(GLOBE_FILE, "utf8")).not.toContain("WORLD_PATH =");
  });

  it("keeps the flat map far smaller than the globe's coastline", () => {
    expect(gzipSync(WORLD_PATH).length).toBeLessThan(
      gzipSync(JSON.stringify(WORLD_LAND)).length,
    );
  });

  /*
   * Equirectangular cannot draw a pole: a polygon edged along latitude -90
   * becomes a bar the full width of the world, and two of those — Antarctica
   * along the bottom, the Arctic islands along the top — are what made the
   * first version of the flat map look broken.
   *
   * So the path is cropped, and the crop is what `WORLD_VIEW_BOX` describes.
   * This pins the two together: a component reading the box gets a band, and
   * the data in it has to be that same band.
   */
  it("crops the flat map to the band its viewBox declares", () => {
    expect(WORLD_NORTH).toBeLessThan(90);
    expect(WORLD_SOUTH).toBeGreaterThan(-90);
    expect(WORLD_VIEW_BOX).toBe(
      `0 ${90 - WORLD_NORTH} 360 ${WORLD_NORTH - WORLD_SOUTH}`,
    );
  });

  /*
   * The islands that vanished at the old threshold, each large enough that
   * their absence reads as a mistake rather than as simplification. Checked
   * by asking whether the path visits their bounding box at all.
   */
  it.each([
    { name: "Great Britain", box: [174, 35, 182, 46] },
    { name: "Japan", box: [308, 55, 326, 78] },
    { name: "New Zealand", box: [346, 122, 360, 138] },
    { name: "Iceland", box: [155, 22, 168, 31] },
  ])("draws $name", ({ box }) => {
    const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = box;
    const inside = [...WORLD_PATH.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].some(
      ([, x, y]) =>
        Number(x) >= x0 &&
        Number(x) <= x1 &&
        Number(y) >= y0 &&
        Number(y) <= y1,
    );
    expect(inside).toBe(true);
  });

  it.each([PATH_FILE, GLOBE_FILE, FINE_FILE])(
    "records where the numbers came from",
    (file: string) => {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("Natural Earth");
      expect(source).toContain("scripts/build-world.mts");
      expect(source).toMatch(/Generated \d{4}-\d{2}-\d{2}/);
    },
  );
});

describe("lakes are holes, not land", () => {
  /*
   * The bug this exists to stop coming back, stated at its real size.
   *
   * The first version flattened every ring into one list and drew each
   * separately, losing which ring was an exterior and which was a hole. The
   * first draft of this comment then claimed that had been painting the Great
   * Lakes, Baikal and Victoria as land — checking it found that of 4064
   * polygons in `ne_10m_land`, exactly **one** has a hole. The others are not
   * in the layer at all.
   *
   * That one is the Caspian, and it is worth the structure on its own: filled
   * solid it is a Caspian-shaped piece of land in the middle of Asia, which
   * makes a map read as wrong without anybody being able to say why.
   */
  it("keeps the polygon that has a hole", () => {
    const withHoles = WORLD_LAND.filter((polygon) => polygon.length > 1);
    expect(withHoles.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * A point is inside a ring, by ray casting. Enough to ask "is the Caspian
   * a hole in Eurasia", which is the only question here.
   */
  const contains = (ring: readonly number[], x: number, y: number): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i] ?? 0;
      const yi = ring[i + 1] ?? 0;
      const xj = ring[j] ?? 0;
      const yj = ring[j + 1] ?? 0;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  };

  it.each([{ name: "the Caspian Sea", at: [51, 42] }])(
    "cuts $name out of the land around it",
    ({ at }) => {
      const [x = 0, y = 0] = at;
      const holes = WORLD_LAND.flatMap((polygon) => polygon.slice(1));
      expect(holes.some((hole) => contains(hole, x, y))).toBe(true);
    },
  );

  /*
   * `evenodd` is not the browser default, so a component that forgets it
   * paints every hole solid — the exact bug, reintroduced by omission.
   */
  it("both renderers ask for the even-odd fill rule", () => {
    expect(read("components", "gallery", "carousel", "WorldDot.tsx")).toContain(
      "evenodd",
    );
    expect(read("components", "geo", "paint.ts")).toContain('"evenodd"');
  });
});

describe("the finer coastline is never bundled", () => {
  /*
   * `world-fine.ts` is larger than everything else in `src/lib/geo` put
   * together, and it exists for one interaction: opening the globe
   * full-screen. The whole bargain is that it is fetched then and at no other
   * time — the same one the contributor page makes with the map library.
   *
   * A static `import` anywhere would quietly cancel that, and the symptom
   * would be a slower page rather than a broken one, which is the class of
   * regression nobody notices for months.
   */
  it.each(["world-fine", "world-finest"])(
    "%s is reached only through a dynamic import",
    (module) => {
      const offenders = allSourceFiles()
        /*
         * Comments stripped, for the reason the original of this check gives
         * below: several files explain why these must not be imported, and a
         * check that punishes explaining the rule is a check that gets the
         * explanation deleted.
         */
        .filter((file) => {
          const source = code(readFileSync(file, "utf8"));
          return (
            source.includes(module) &&
            !new RegExp(`import\\(\\s*["'][^"']*${module}`).test(source)
          );
        })
        .map((f) => f.replace(SRC, ""));
      expect(offenders).toEqual([]);
    },
  );

  it("is reached only through a dynamic import", () => {
    const offenders = allSourceFiles()
      /*
       * Comments stripped. Three files explain why this one must not be
       * imported, and a check that punishes explaining the rule is a check
       * that gets the explanation deleted — the same lesson `source-text.ts`
       * records for the invariants that failed against their own docstrings.
       */
      .filter((file) => {
        const source = code(readFileSync(file, "utf8"));
        return (
          source.includes("world-fine") &&
          !/import\(\s*["'][^"']*world-fine/.test(source)
        );
      })
      .map((f) => f.replace(SRC, ""));
    expect(offenders).toEqual([]);
  });

  /*
   * One file names all three tiers, and that is the point rather than tidiness.
   *
   * The lazy loading is only structural while there is a single place a
   * static import could be introduced. Spread across the components that
   * happen to want a coastline, "nothing imports this eagerly" becomes a
   * convention, and a convention is what somebody undoes while tidying.
   */
  it("is fetched from exactly one place", () => {
    const readers = allSourceFiles()
      .filter((file) => code(readFileSync(file, "utf8")).includes("world-fine"))
      .map((f) => f.replace(SRC, ""));
    expect(readers).toEqual([join("/components", "geo", "coastline.ts")]);
  });

  it("and so is the deep one", () => {
    const readers = allSourceFiles()
      .filter((file) =>
        code(readFileSync(file, "utf8")).includes("world-finest"),
      )
      .map((f) => f.replace(SRC, ""));
    expect(readers).toEqual([join("/components", "geo", "coastline.ts")]);
  });

  /*
   * Four times the detail is the point. If it ever stops being much larger
   * than the set that ships, the split has stopped earning its extra request
   * and the two should be one file again.
   */
  it("carries several times the detail of the set that ships", () => {
    const fine = gzipSync(readFileSync(FINE_FILE)).length;
    const everyday = gzipSync(JSON.stringify(WORLD_LAND)).length;
    expect(fine).toBeGreaterThan(everyday * 2);
  });
});

describe("the rings are coordinates", () => {
  it("is a non-trivial number of landmasses", () => {
    expect(WORLD_LAND.length).toBeGreaterThan(50);
  });

  it("holds flat lng/lat pairs, so every ring has an even length", () => {
    for (const ring of RINGS) {
      expect(ring.length % 2).toBe(0);
      // Three points is the minimum that encloses anything.
      expect(ring.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("stays inside the world", () => {
    for (const ring of RINGS) {
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
    for (const ring of RINGS) {
      expect(ring.slice(0, 2)).toEqual(ring.slice(-2));
    }
  });

  it("actually covers the inhabited world, not one hemisphere", () => {
    const lngs = RINGS.flatMap((ring) =>
      ring.filter((_, index) => index % 2 === 0),
    );
    const lats = RINGS.flatMap((ring) =>
      ring.filter((_, index) => index % 2 === 1),
    );
    expect(Math.min(...lngs)).toBeLessThan(-150);
    expect(Math.max(...lngs)).toBeGreaterThan(150);
    /*
     * Tierra del Fuego at the bottom, northern Greenland at the top.
     * Antarctica is deliberately absent from both datasets — see the note in
     * `scripts/build-world.mts`. It broke the flat map as a bar and the globe
     * as a sunburst, in each case because a polygon edged along a pole is not
     * something either projection can draw.
     */
    expect(Math.min(...lats)).toBeLessThan(-50);
    expect(Math.min(...lats)).toBeGreaterThan(-70);
    expect(Math.max(...lats)).toBeGreaterThan(80);
  });
});

describe("the path is drawable in the box it declares", () => {
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
      expect(Number(y)).toBeGreaterThanOrEqual(90 - WORLD_NORTH);
      expect(Number(y)).toBeLessThanOrEqual(90 - WORLD_SOUTH);
      counted += 1;
    }
    expect(counted).toBeGreaterThan(200);
  });
});
