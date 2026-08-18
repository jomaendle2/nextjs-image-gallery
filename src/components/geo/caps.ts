import { TO_RADIANS } from "./projection";

/**
 * The back-face cull: which polygons are round the back and can be skipped.
 *
 * Its own file rather than a corner of `paint.ts` because it is the only
 * arithmetic in the module that can silently delete a continent, and it is
 * the only part of it with a test. Nothing here touches a canvas — a cap is a
 * fact about a polygon and a camera, which is why `paint.test.ts` can check
 * it against brute force without one.
 */

/**
 * A bounding spherical cap: the direction a polygon sits in, and how wide it
 * is.
 *
 * `x`/`y`/`z` is the unit vector towards the polygon's centroid; `sin` is the
 * sine of its angular radius, which is the largest angle between that
 * centroid and any of its vertices.
 */
export interface Cap {
  x: number;
  y: number;
  z: number;
  sin: number;
}

/**
 * Bounding caps, computed once per coastline and remembered against it.
 *
 * A `WeakMap` keyed on the land array itself rather than a cache with a
 * lifetime: there are exactly two of these arrays in the program, both
 * module constants inside their own chunks, so the entries live as long as
 * the coastline does and vanish with it. Nothing has to decide when to
 * invalidate, because the key *is* the data.
 *
 * The precompute walks every vertex once — about 25,700 of them for the fine
 * set — and is paid on the frame the coastline arrives, which is a frame that
 * was already going to be the expensive one.
 *
 * Measured over 96 views spread across every spin and four tilts, the cull
 * discards **49% of polygons but only 28% of vertices** — and the gap between
 * those two numbers is the honest summary of it. What gets culled is islands;
 * what survives is Eurasia, Africa and the Americas, which are precisely the
 * polygons carrying most of the vertices and are almost never wholly hidden.
 * A quarter of the projection work for twenty lines is still worth having,
 * but it is not the halving a polygon count suggests, and the frame budget
 * mostly comes from not drawing frames at all.
 */
const capsFor = new WeakMap<object, Cap[]>();

/**
 * The direction of a polygon's centroid, or null where there is not one.
 *
 * A degenerate ring — or the vanishingly unlikely polygon whose vertices
 * cancel to the centre — has no direction to speak of, and the caller turns
 * that into a cap covering the whole sphere, which is never culled. Wrong
 * answers here are invisible; a wrongly culled continent is not.
 */
function centroidOf(
  polygon: readonly (readonly number[])[],
): { x: number; y: number; z: number } | null {
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let total = 0;

  for (const ring of polygon) {
    for (let index = 0; index < ring.length; index += 2) {
      const phi = (ring[index + 1] ?? 0) * TO_RADIANS;
      const lambda = (ring[index] ?? 0) * TO_RADIANS;
      const cosPhi = Math.cos(phi);
      sumX += cosPhi * Math.cos(lambda);
      sumY += cosPhi * Math.sin(lambda);
      sumZ += Math.sin(phi);
      total += 1;
    }
  }

  const length = Math.hypot(sumX, sumY, sumZ);
  if (total === 0 || length === 0) {
    return null;
  }

  return { x: sumX / length, y: sumY / length, z: sumZ / length };
}

/**
 * The sine of the angular radius: how far the furthest vertex is from the
 * centroid.
 *
 * `smallest` is the cosine of that angle, so a value at or below zero means
 * the cap is a hemisphere or wider — and such a cap must never be culled,
 * because `-sin(r)` stops being the right threshold the moment `r` passes
 * ninety degrees. Sine is symmetric about it: a cap of 170 degrees would
 * produce the same `-0.17` as one of 10 and cull a polygon wrapping most of
 * the planet. `sin: 1` makes the test `dot < -1`, which is never true.
 *
 * `paint.test.ts` found this on its first run, with a polygon spanning three
 * hundred degrees of longitude. It is exactly the failure the brute force is
 * there for: silent, angle-dependent, and invisible on the frame it happens.
 */
function angularRadiusSin(
  polygon: readonly (readonly number[])[],
  centre: { x: number; y: number; z: number },
): number {
  let smallest = 1;
  for (const ring of polygon) {
    for (let index = 0; index < ring.length; index += 2) {
      const phi = (ring[index + 1] ?? 0) * TO_RADIANS;
      const lambda = (ring[index] ?? 0) * TO_RADIANS;
      const cosPhi = Math.cos(phi);
      const dot =
        centre.x * cosPhi * Math.cos(lambda) +
        centre.y * cosPhi * Math.sin(lambda) +
        centre.z * Math.sin(phi);
      smallest = Math.min(smallest, dot);
    }
  }

  if (smallest <= 0) {
    return 1;
  }

  // cos(r) to sin(r), without the round trip through acos.
  return Math.sqrt(1 - smallest * smallest);
}

/**
 * Exported, with `cameraDirection` and `beyondHorizon`, for one reason: the
 * cull they implement is the only piece of arithmetic in this module that can
 * silently delete a continent, and `paint.test.ts` checks it against brute
 * force over every polygon and a spread of views. A predicate whose failure
 * mode is invisible on the frame it happens deserves a test that does not
 * need a canvas to run.
 */
export function boundingCaps(
  land: readonly (readonly (readonly number[])[])[],
): Cap[] {
  const known = capsFor.get(land);
  if (known !== undefined) {
    return known;
  }

  const caps = land.map((polygon) => {
    const centre = centroidOf(polygon);
    if (centre === null) {
      return { x: 0, y: 0, z: 1, sin: 1 };
    }
    return { ...centre, sin: angularRadiusSin(polygon, centre) };
  });

  capsFor.set(land, caps);
  return caps;
}

/**
 * Whether a whole polygon is round the back of the sphere.
 *
 * The angle from the camera to any vertex is at least the angle to the
 * centroid minus the cap's radius, so a centroid more than `90 + radius`
 * degrees away puts every vertex past the horizon. The cosine of `90 + r` is
 * `-sin(r)`, which is why the cap stores the sine.
 *
 * Conservative in the only direction that matters: it may fail to cull
 * something that happens to be invisible — `layOnSphere` then discards it as
 * it always did — but it can never cull a polygon with a visible vertex.
 */
export function beyondHorizon(
  cap: Cap,
  camera: { x: number; y: number; z: number },
): boolean {
  return cap.x * camera.x + cap.y * camera.y + cap.z * camera.z < -cap.sin;
}
