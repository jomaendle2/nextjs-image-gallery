import { describe, expect, it } from "vitest";
import { beyondHorizon, boundingCaps, outsideFrame, viewBasis } from "./caps";
import { markNear, placeMarks } from "./marks";
import { cameraDirection, project, type View } from "./projection";

/**
 * The back-face cull, checked against the thing it is an optimisation of.
 *
 * This is the only arithmetic in `caps.ts` whose failure mode is silent and
 * catastrophic at the same time: a cap computed slightly too small deletes a
 * continent for exactly the range of angles where it was wrong, and nothing
 * throws. The predicate is cheap and the brute-force answer is cheap too, so
 * the test simply computes both for every polygon over a spread of views and
 * insists the fast one never says "hidden" when the slow one can find a
 * visible vertex.
 *
 * Deterministic pseudo-random rather than a fixed table of views, because the
 * bug this guards against lives at particular angles and a table is a list of
 * the angles somebody already thought of. Seeded, so a failure is reproducible
 * rather than a rumour.
 */
function pseudoRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

/**
 * Polygons that between them cover the awkward cases: a big blobby continent,
 * a polygon straddling the antimeridian, one over a pole, a degenerate
 * two-vertex sliver, and a ring so wide its centroid is nowhere near it.
 */
const LAND: readonly (readonly (readonly number[])[])[] = [
  [[10, 40, 30, 40, 30, 55, 10, 55]],
  [[170, -10, -170, -10, -170, 10, 170, 10]],
  [[-180, 80, -60, 80, 60, 80, 180, 80, 180, 89, -180, 89]],
  [[5, 5, 5.001, 5.001]],
  [[-150, -20, -30, 0, 90, 20, 150, -40]],
  // A hole, to prove the cap covers every ring rather than only the first.
  [
    [-20, -20, 20, -20, 20, 20, -20, 20],
    [-5, -5, 5, -5, 5, 5, -5, 5],
  ],
];

function anyVertexVisible(
  polygon: readonly (readonly number[])[],
  view: View,
): boolean {
  for (const ring of polygon) {
    for (let index = 0; index < ring.length; index += 2) {
      if (project(ring[index + 1] ?? 0, ring[index] ?? 0, view).visible) {
        return true;
      }
    }
  }
  return false;
}

describe("the back-face cull", () => {
  it("never discards a polygon with a visible vertex", () => {
    const random = pseudoRandom(20_260_817);
    const caps = boundingCaps(LAND);

    for (let attempt = 0; attempt < 400; attempt += 1) {
      const view: View = {
        spin: random() * 720 - 360,
        tilt: random() * 160 - 80,
        radius: 100 + random() * 400,
      };
      const camera = cameraDirection(view);

      for (let index = 0; index < LAND.length; index += 1) {
        const cap = caps[index];
        const polygon = LAND[index];
        if (
          cap !== undefined &&
          polygon !== undefined &&
          beyondHorizon(cap, camera)
        ) {
          expect(
            anyVertexVisible(polygon, view),
            `culled polygon ${index} at spin ${view.spin}, tilt ${view.tilt}`,
          ).toBe(false);
        }
      }
    }
  });

  it("still culls, or it would not be worth the arithmetic", () => {
    const caps = boundingCaps(LAND);
    const camera = cameraDirection({ spin: 0, tilt: 0, radius: 100 });
    const culled = caps.filter((cap) => beyondHorizon(cap, camera));

    // Looking at 0,0: the antimeridian polygon is exactly opposite.
    expect(culled.length).toBeGreaterThan(0);
  });

  it("gives a degenerate ring a cap that is never culled", () => {
    // An empty polygon has no centroid to speak of, and the safe answer to
    // "where is it" is "everywhere" rather than "behind you".
    const [cap] = boundingCaps([[[]]]);
    expect(cap).toBeDefined();
    for (const spin of [0, 90, 180, 270]) {
      expect(
        beyondHorizon(
          cap ?? { x: 0, y: 0, z: 1, sin: 1, chord: 2 },
          cameraDirection({ spin, tilt: 0, radius: 100 }),
        ),
      ).toBe(false);
    }
  });
});

/**
 * The frame cull, checked the same way and for the same reason.
 *
 * `outsideFrame` is a bound on where a polygon can land on screen, and a
 * bound that is a hair too tight erases whatever it was bounding — silently,
 * and only at the magnification and angle where it was wrong. So this walks
 * every drawn point the renderer would produce, including the radial push
 * `layOnSphere` applies to hidden vertices, and insists the predicate never
 * says "outside" when one of them is inside the frame.
 *
 * The magnifications matter more than the angles here, because the cull only
 * starts discarding anything once the sphere outgrows the frame. `frame` is
 * held at the sphere's resting radius and `radius` grows past it, which is
 * exactly what `paintSphere` does: the porthole stays put and the globe grows
 * through it.
 */
function drawnPoints(
  polygon: readonly (readonly number[])[],
  view: View,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const ring of polygon) {
    for (let index = 0; index < ring.length; index += 2) {
      const point = project(ring[index + 1] ?? 0, ring[index] ?? 0, view);
      // `layOnSphere`'s limb push, reproduced exactly.
      const scale = point.visible
        ? 1
        : view.radius / (Math.hypot(point.x, point.y) || 1);
      out.push({ x: point.x * scale, y: point.y * scale });
    }
  }
  return out;
}

describe("the frame cull", () => {
  const FRAME = 200;

  it("never discards a polygon with a point inside the frame", () => {
    const caps = boundingCaps(LAND);
    const random = pseudoRandom(20_260_819);

    for (let attempt = 0; attempt < 400; attempt += 1) {
      const view: View = {
        spin: random() * 360,
        tilt: (random() - 0.5) * 140,
        // 1x through 16x, the whole range the stops cover.
        radius: FRAME * (1 + random() * 15),
      };

      for (const [index, polygon] of LAND.entries()) {
        const cap = caps[index];
        if (cap !== undefined && outsideFrame(cap, viewBasis(view), FRAME)) {
          for (const point of drawnPoints(polygon, view)) {
            /*
             * The frame is a circle, and `paintSphere` clips to it — but an
             * edge between two points outside a circle can still cut across
             * it, so the assertion uses the circumscribing square. Anything
             * the renderer could possibly touch has to be outside that.
             */
            expect(
              Math.max(Math.abs(point.x), Math.abs(point.y)),
            ).toBeGreaterThan(FRAME);
          }
        }
      }
    }
  });

  it("discards most of the world once the globe outgrows the porthole", () => {
    const caps = boundingCaps(LAND);
    const view: View = { spin: 0, tilt: 0, radius: FRAME * 16 };
    const kept = caps.filter(
      (cap) => !outsideFrame(cap, viewBasis(view), FRAME),
    );

    // The point of the whole exercise: at 16x the porthole holds a sliver of
    // the near side, and almost nothing survives both culls.
    expect(kept.length).toBeLessThan(LAND.length);
  });

  it("keeps everything while the sphere still fits the frame", () => {
    const caps = boundingCaps(LAND);
    for (const spin of [0, 60, 120, 180, 240, 300]) {
      const view: View = { spin, tilt: 0, radius: FRAME };
      for (const cap of caps) {
        expect(outsideFrame(cap, viewBasis(view), FRAME)).toBe(false);
      }
    }
  });
});

describe("hit testing", () => {
  const points = [
    { lat: 0, lng: 0, count: 3 },
    { lat: 0, lng: 180, count: 1 },
    { lat: 10, lng: 10, count: 2 },
  ];
  const view: View = { spin: 0, tilt: 0, radius: 200 };

  it("places only the marks on the near side", () => {
    const marks = placeMarks(points, view);
    // The antimeridian point is directly behind the one at 0,0.
    expect(marks.map((mark) => mark.index)).toEqual([0, 2]);
  });

  it("keeps each mark's index into the original list", () => {
    const marks = placeMarks(points, view);
    const second = marks.find((mark) => mark.index === 2);
    expect(second).toBeDefined();
    expect(points[second?.index ?? 0]?.count).toBe(2);
  });

  it("finds the nearest mark within the radius and nothing outside it", () => {
    const marks = placeMarks(points, view);
    const [first] = marks;
    expect(first).toBeDefined();

    expect(markNear(marks, first?.x ?? 0, first?.y ?? 0, 18)?.index).toBe(0);
    expect(
      markNear(marks, (first?.x ?? 0) + 17, first?.y ?? 0, 18)?.index,
    ).toBe(0);
    expect(markNear(marks, (first?.x ?? 0) + 19, first?.y ?? 0, 18)).toBeNull();
  });

  it("gives a tie to the earlier mark, which is the busier cell", () => {
    // `groupIntoCells` sorts busiest first and `placeMarks` preserves that
    // order, so two marks at the same distance resolve to the bigger place.
    const stacked = [
      { index: 0, x: 0, y: 0 },
      { index: 1, x: 0, y: 0 },
    ];
    expect(markNear(stacked, 0, 0, 18)?.index).toBe(0);
  });
});

describe("the tilt memo", () => {
  it("does not leak one view's tilt into the next", () => {
    // `project` caches sin/cos of the tilt at module scope; the cache is keyed
    // on the value, so alternating tilts must still give alternating answers.
    const north = project(45, 0, { spin: 0, tilt: 80, radius: 100 });
    const south = project(45, 0, { spin: 0, tilt: -80, radius: 100 });
    const northAgain = project(45, 0, { spin: 0, tilt: 80, radius: 100 });

    expect(north.y).toBeCloseTo(northAgain.y, 10);
    expect(north.y).not.toBeCloseTo(south.y, 3);
  });
});
