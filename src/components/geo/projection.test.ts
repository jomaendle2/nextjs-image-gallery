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
      /*
       * And on the near side, which the pixel comparison alone cannot tell.
       *
       * Orthographic projection maps a point and its mirror through the
       * sphere's centre to the *same* pixel — they differ only in whether
       * they face the camera. Without this line an inverse that consistently
       * returned the far-side point would round-trip perfectly and pass,
       * while aiming the zoom at the antipode of whatever the reader pointed
       * at. The x/y check proves the arithmetic; this proves the branch.
       */
      expect(again.visible).toBe(true);
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

  it("returns the near-side point, not its mirror through the centre", () => {
    /*
     * The same property stated directly, on a case chosen so the two
     * candidates are far apart: a point well off the sub-camera position has
     * a mirror in the opposite hemisphere, and only one of them is in front.
     */
    const view: View = { spin: 0, tilt: 20, radius: 320 };
    const at = project(-40, 60, view);
    expect(at.visible).toBe(true);

    const back = unproject(at.x, at.y, view);
    expect(back?.lat).toBeCloseTo(-40, 6);
    expect(back?.lng).toBeCloseTo(60, 6);
  });

  it("reads the centre pixel as the point facing the camera", () => {
    const view: View = { spin: -73, tilt: -50, radius: 800 };
    const centre = unproject(0, 0, view);
    expect(centre?.lat).toBeCloseTo(-50, 9);
    expect(centre?.lng).toBeCloseTo(73, 9);
  });
});

/**
 * The degenerate inputs, because the failure they cause is invisible.
 *
 * `focusedView` writes what this returns into the spin and tilt the globe
 * keeps between frames. A NaN there is not a wrong picture, it is *no*
 * picture, for the rest of the session, with nothing logged. So the contract
 * is that this never returns a non-finite number — it returns null instead
 * and the caller leaves the view alone.
 */
describe("unproject never poisons the view", () => {
  const finite = (result: { lat: number; lng: number } | null) =>
    result === null ||
    (Number.isFinite(result.lat) && Number.isFinite(result.lng));

  it("survives a canvas measured at zero size", () => {
    // The overlay animates open from nothing, so a wheel can arrive while
    // the canvas is still 0x0 and the radius is therefore zero.
    const flat: View = { spin: 0, tilt: 20, radius: 0 };
    // Exactly on the centre line is the one that makes 0 / 0 rather than
    // an infinity, and NaN fails `> 1` where Infinity does not.
    expect(finite(unproject(0, 0, flat))).toBe(true);
    expect(finite(unproject(10, 5, flat))).toBe(true);
  });

  it("survives a non-finite pointer", () => {
    const view: View = { spin: 0, tilt: 20, radius: 320 };
    expect(finite(unproject(Number.NaN, 0, view))).toBe(true);
    expect(finite(unproject(0, Number.NaN, view))).toBe(true);
    expect(finite(unproject(Number.POSITIVE_INFINITY, 0, view))).toBe(true);
  });
});
