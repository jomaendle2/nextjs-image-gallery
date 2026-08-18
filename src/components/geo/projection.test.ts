import { describe, expect, it } from "vitest";
import { project, unproject, type View } from "./projection";

/**
 * The inverse projection, checked against the forward one.
 *
 * `unproject` exists so the zoom can aim at whatever is under the pointer,
 * and a wrong inverse would not crash — it would quietly drift the globe
 * somewhere plausible-looking, which is the kind of bug nobody reports and
 * everybody feels. Round-tripping every visible point through both is the
 * only check that can fail when the arithmetic is subtly wrong.
 */
describe("unproject", () => {
  const views: View[] = [
    { spin: 0, tilt: 0, radius: 320 },
    { spin: 0, tilt: 20, radius: 320 },
    { spin: -73, tilt: -50, radius: 800 },
    { spin: 137, tilt: 65, radius: 208 },
  ];

  /** Every visible graticule crossing, as (view, lat, lng) triples. */
  const visiblePoints = views.flatMap((view) =>
    Array.from({ length: 9 }, (_, i) => -80 + i * 20).flatMap((lat) =>
      Array.from({ length: 18 }, (_, j) => -170 + j * 20)
        .map((lng) => ({ view, lat, lng, at: project(lat, lng, view) }))
        .filter((candidate) => candidate.at.visible),
    ),
  );

  it("returns the point that project() puts back in the same place", () => {
    // If the filter above ever empties, this test would pass vacuously.
    expect(visiblePoints.length).toBeGreaterThan(100);

    for (const { view, at } of visiblePoints) {
      const back = unproject(at.x, at.y, view);
      expect(back).not.toBeNull();
      /*
       * Compared by where they land, not by their numbers. Longitude is
       * cyclic and degenerate at the poles, so two correct answers can differ
       * by 360 — or, at a pole, by anything at all.
       */
      const again = project(back?.lat ?? 0, back?.lng ?? 0, view);
      expect(again.x).toBeCloseTo(at.x, 6);
      expect(again.y).toBeCloseTo(at.y, 6);
    }
  });

  it("refuses a pixel that is not on the sphere", () => {
    const view: View = { spin: 0, tilt: 20, radius: 320 };
    // Just past the limb, and well past it.
    expect(unproject(321, 0, view)).toBeNull();
    expect(unproject(1000, 1000, view)).toBeNull();
    // Exactly on the limb is still the sphere.
    expect(unproject(320, 0, view)).not.toBeNull();
  });

  it("reads the centre pixel as the point facing the camera", () => {
    const view: View = { spin: -73, tilt: -50, radius: 800 };
    const centre = unproject(0, 0, view);
    expect(centre?.lat).toBeCloseTo(-50, 9);
    expect(centre?.lng).toBeCloseTo(73, 9);
  });
});
