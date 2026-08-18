/**
 * Where a latitude and a longitude land on screen, and nothing else.
 *
 * The bottom of the geo module and the only file in it that depends on
 * nothing: the painters, the back-face cull and the hit test all need to turn
 * a point on a sphere into a point on a canvas, and this is the one place
 * that arithmetic lives. Kept apart from `paint.ts` so that a reader chasing
 * a projection bug is not reading a file about `globalAlpha`, and so that the
 * cull in `caps.ts` can share the camera without importing a painter.
 */

export const TO_RADIANS = Math.PI / 180;

export interface Projected {
  x: number;
  y: number;
  /** True when the point is on the near side of the sphere. */
  visible: boolean;
}

/**
 * Where the viewer is standing, and how big the sphere is on screen.
 *
 * Passed as one object rather than three arguments because every painter in
 * `paint.ts` needs all of it and nothing there needs anything else. `tilt` is
 * the latitude facing the camera: zero looks at the equator edge-on, which is
 * the view a school globe is never photographed from.
 */
export interface View {
  spin: number;
  tilt: number;
  radius: number;
}

/**
 * Orthographic: the view from infinitely far away, which is what a globe
 * looks like.
 *
 * The full two-angle form rather than the equator-on shortcut the first
 * version used. `cos(c)` is the cosine of the angular distance from the
 * point facing the camera, so its sign is the whole visibility test — and
 * with a tilt in it, the sphere can be turned to face a photograph instead
 * of always facing the Gulf of Guinea.
 */
/**
 * The last tilt asked about, and its sine and cosine.
 *
 * `tilt` is constant for the whole of a frame while `lat` and `lng` change
 * with every vertex, so two of the five trigonometric calls below were being
 * recomputed some thirty thousand times a frame to produce the same two
 * numbers. Memoising on the value rather than on a frame counter keeps
 * `project` a pure function of its arguments — the cache cannot go stale,
 * because a different tilt simply misses it.
 */
let lastTilt = Number.NaN;
let lastCosTilt = 0;
let lastSinTilt = 0;

function tiltTrig(tilt: number): { cos: number; sin: number } {
  if (tilt !== lastTilt) {
    const phi0 = tilt * TO_RADIANS;
    lastTilt = tilt;
    lastCosTilt = Math.cos(phi0);
    lastSinTilt = Math.sin(phi0);
  }
  return { cos: lastCosTilt, sin: lastSinTilt };
}

export function project(lat: number, lng: number, view: View): Projected {
  const phi = lat * TO_RADIANS;
  const lambda = (lng + view.spin) * TO_RADIANS;

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const { cos: cosPhi0, sin: sinPhi0 } = tiltTrig(view.tilt);
  const cosLambda = Math.cos(lambda);

  return {
    x: view.radius * cosPhi * Math.sin(lambda),
    // Screen y grows downward; latitude grows upward.
    y: -view.radius * (cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosLambda),
    visible: sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosLambda > 0,
  };
}

/**
 * Where the camera is, as a unit vector in the same frame as the caps.
 *
 * This is `project`'s own visibility test with the vertex factored out: a
 * point is on the near side exactly when its direction has a positive dot
 * product with this one.
 */
export function cameraDirection(view: View): {
  x: number;
  y: number;
  z: number;
} {
  const { cos, sin } = tiltTrig(view.tilt);
  const spin = view.spin * TO_RADIANS;
  return { x: cos * Math.cos(spin), y: -cos * Math.sin(spin), z: sin };
}

/**
 * The reverse of `project`: which point on the sphere sits under a pixel.
 *
 * Orthographic projection is invertible in closed form, which is the whole
 * reason the zoom can aim at something. `rho` is the distance from the centre
 * in sphere radii, so anything past 1 is off the disc entirely and the
 * function says so with `null` rather than returning a nearby lie — a wheel
 * turned over the corner of the canvas must not drag the globe somewhere.
 *
 * `x` and `y` are relative to the centre of the sphere, in the same screen
 * pixels `project` returns, with `y` growing downward.
 *
 * The formulae are the standard inverse orthographic. `c` is the angular
 * distance from the point facing the camera; at `rho` of exactly zero that
 * angle is zero and the point under the pointer is the camera's own, so the
 * division guards against the degenerate centre pixel rather than trusting
 * `atan2` to produce something usable there.
 */
export function unproject(
  x: number,
  y: number,
  view: View,
): { lat: number; lng: number } | null {
  const px = x / view.radius;
  // Screen y grows downward; latitude grows upward — the same flip `project`
  // applies on the way out, undone here on the way in.
  const py = -y / view.radius;
  const rho = Math.hypot(px, py);

  /*
   * `!(rho <= 1)` rather than `rho > 1`, and the difference is NaN.
   *
   * A NaN fails every comparison, so `rho > 1` waves it straight through —
   * and then `asin(NaN)` is NaN, and the caller writes NaN into the spin and
   * tilt it keeps between frames. The globe renders nothing from that point
   * on, for the rest of the session, with no error and no way back.
   *
   * `radius` is zero whenever the canvas is measured mid-layout — the
   * overlay animates open from nothing — and a pointer exactly on the centre
   * line then makes `0 / 0`. Rare, permanent, and silent, which is the worst
   * combination; the fix is one character of logic.
   */
  if (!(rho <= 1)) {
    return null;
  }
  if (rho < 1e-9) {
    return { lat: view.tilt, lng: -view.spin };
  }

  const c = Math.asin(rho);
  const cosC = Math.cos(c);
  const sinC = Math.sin(c);
  const { cos: cosPhi0, sin: sinPhi0 } = tiltTrig(view.tilt);

  const lat =
    Math.asin(cosC * sinPhi0 + (py * sinC * cosPhi0) / rho) / TO_RADIANS;
  const lng =
    Math.atan2(px * sinC, rho * cosC * cosPhi0 - py * sinC * sinPhi0) /
    TO_RADIANS;

  // `project` adds the spin before rotating, so the inverse takes it back out.
  return { lat, lng: lng - view.spin };
}
