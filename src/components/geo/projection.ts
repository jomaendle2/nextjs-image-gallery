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
