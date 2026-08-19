import { TO_RADIANS, type View } from "./projection";

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
  /**
   * The straight-line distance, through the sphere, from the centroid to the
   * furthest vertex — the chord of the angular radius, on a unit sphere.
   *
   * `sin` answers "is this polygon round the back?"; `chord` answers "how far
   * across the screen can it reach?". They are the same angle measured two
   * ways, and the second one is a distance rather than an angle for a reason:
   * an orthographic projection is a linear map followed by dropping a
   * coordinate, so it never increases a distance. Two points a chord `c`
   * apart in space are therefore at most `radius * c` apart on screen, with
   * no trigonometry at the call site and no case analysis at the poles.
   *
   * Unlike `sin`, this stays meaningful past ninety degrees: the chord grows
   * monotonically with the angle all the way to 2 at the antipode, so a
   * hemisphere-spanning polygon gets a large bound rather than an ambiguous
   * one — which is the failure `sin` needs its own sentinel to avoid.
   */
  chord: number;
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
 * How far the furthest vertex is from the centroid, measured both ways the
 * two culls need it.
 *
 * One walk rather than two. The horizon cull wants the sine of the angular
 * radius and the frame cull wants its chord, and both are functions of the
 * same number — `smallest`, the least dot product between the centroid and
 * any vertex, which is the cosine of that angle. Computing it twice meant
 * fifty thousand redundant trigonometric calls per coastline for two
 * arithmetic conversions.
 *
 * They disagree past ninety degrees, and the disagreement is deliberate:
 *
 * **`sin`** is clamped to 1 there, which makes `beyondHorizon`'s test
 * `dot < -1` and so never true. It has to be, because `-sin(r)` stops being
 * the right threshold once `r` passes ninety: sine is symmetric about it, so
 * a cap of 170 degrees produces the same `-0.17` as one of 10 and would cull
 * a polygon wrapping most of the planet. `paint.test.ts` found exactly that
 * on its first run, with a polygon spanning three hundred degrees of
 * longitude — a silent, angle-dependent failure invisible on the frame it
 * happens.
 *
 * **`chord`** needs no such guard, because it grows monotonically with the
 * angle all the way to 2 at the antipode. A hemisphere-spanning polygon gets
 * an honestly large screen bound rather than an ambiguous one.
 */
function extentOf(
  polygon: readonly (readonly number[])[],
  centre: { x: number; y: number; z: number },
): { sin: number; chord: number } {
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

  return {
    // |a - b|² = 2 - 2(a·b) for unit vectors. Clamped because a dot product
    // assembled from five trigonometric calls can land a hair outside [-1, 1].
    chord: Math.sqrt(Math.max(0, 2 - 2 * smallest)),
    // cos(r) to sin(r), without the round trip through acos.
    sin: smallest <= 0 ? 1 : Math.sqrt(1 - smallest * smallest),
  };
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
      // No direction to speak of, so a cap covering everything: never culled
      // by the horizon, and a chord of 2 is never culled by the frame either.
      return { x: 0, y: 0, z: 1, sin: 1, chord: 2 };
    }
    return { ...centre, ...extentOf(polygon, centre) };
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

/**
 * Whether a whole polygon falls outside the porthole.
 *
 * `beyondHorizon` asks whether a polygon is round the back. This asks the
 * question magnification made worth asking: whether it is on the near side
 * and still nowhere near the hole the reader is looking through. At 1x the
 * answer is almost always no, because the frame *is* the sphere. At 16x the
 * frame holds a couple of per cent of the near side, and the answer is yes
 * for every continent except the one being looked at.
 *
 * That inverts the cost curve, which is the whole reason deep zoom is
 * affordable. Without it, zooming in projects the same hundred and fifty
 * thousand vertices in order to draw fewer and fewer of them: the closer the
 * reader looks, the more work each frame does for a smaller picture. With it,
 * the work follows what is actually on screen.
 *
 * **The bound.** An orthographic projection never increases a distance, so
 * every vertex lands within `radius * cap.chord` of where the centroid lands.
 * `layOnSphere` then pushes hidden vertices radially outward to the limb,
 * which only moves them *further* from the origin — and the origin is the
 * centre of the frame. So the drawn shape, edges included, stays within the
 * cone that the bounding disc subtends from the centre of the frame.
 *
 * **`SLACK`.** That argument bounds the shape's distance from the frame
 * centre but not, tightly, the closest approach of a straight edge spanning
 * the cone — a chord always cuts inside the arc it spans. Rather than carry
 * exact trigonometry for a term worth a few pixels, the test keeps half a
 * frame of margin, and `paint.test.ts` checks the predicate against brute
 * force across a spread of spins, tilts and magnifications. The margin is
 * measured rather than assumed: the test fails if it is too small.
 *
 * Conservative in the only direction that matters, exactly like
 * `beyondHorizon`. It may keep a polygon that turns out to draw nothing —
 * the clip in `paintSphere` discards it as it always did — but it can never
 * drop one with a pixel inside the frame.
 */
const SLACK = 1.5;

/**
 * The view's trigonometry, computed once for a whole coastline.
 *
 * Hoisted for the same reason `cameraDirection` is, and it is the same
 * rearrangement: spin and tilt are constant for a frame while the polygon
 * changes two and a half thousand times, so working them out inside
 * `outsideFrame` would put ten thousand redundant trigonometric calls into
 * every frame — inside the function whose entire job is to make frames
 * cheaper.
 */
export interface Basis {
  cosSpin: number;
  sinSpin: number;
  cosTilt: number;
  sinTilt: number;
  radius: number;
}

export function viewBasis(view: View): Basis {
  const spin = view.spin * TO_RADIANS;
  const tilt = view.tilt * TO_RADIANS;
  return {
    cosSpin: Math.cos(spin),
    cosTilt: Math.cos(tilt),
    radius: view.radius,
    sinSpin: Math.sin(spin),
    sinTilt: Math.sin(tilt),
  };
}

export function outsideFrame(cap: Cap, basis: Basis, frame: number): boolean {
  /*
   * The centroid projected straight from the cap's own unit vector.
   *
   * `project` takes degrees and rebuilds this vector with five trigonometric
   * calls; the cap already *is* the vector, so going back through latitude
   * and longitude would be an `asin` and an `atan2` per polygon per frame to
   * recover what is sitting in the argument. This is `project` with the
   * spin's angle-addition expanded and the vertex factored out.
   */
  const { cosSpin, sinSpin, cosTilt, sinTilt, radius } = basis;
  const facing = cap.x * cosSpin - cap.y * sinSpin;
  const x = radius * (cap.y * cosSpin + cap.x * sinSpin);
  const y = -radius * (cosTilt * cap.z - sinTilt * facing);

  return Math.hypot(x, y) - radius * cap.chord > frame * SLACK;
}
