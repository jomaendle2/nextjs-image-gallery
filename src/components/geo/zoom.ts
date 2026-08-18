import { unproject } from "./projection";

/**
 * The magnification, and the stops it moves between.
 *
 * Its own file because three places need it and none of them is the other's
 * parent: the canvas clamps a wheel and a pinch with it, the chrome around
 * the canvas puts the stops on buttons and on `+`/`-`, and the keyboard
 * handler steps through them. A constant that three modules agree on is a
 * module, not an export borrowed from whichever of them was written first.
 */

/**
 * The two magnifications, and the ceiling the wheel and the pinch stop at.
 *
 * `MAX_ZOOM` is where the finer data runs out rather than where the
 * arithmetic does, and the number is measured rather than assumed. This
 * paragraph used to claim a vertex every 0.07 degrees. Counting all 28,622
 * of them puts the median gap in `world-fine` at **0.264 degrees**, so the
 * data is nearly four times coarser than it was credited with.
 *
 * The overlay is `min(96vw, 74dvh)` and the sphere fills `FILL` of it, so on
 * a 1512x787 laptop the radius at 2.5x is about 640 CSS pixels — and that
 * median gap lands a little under **3 CSS pixels** apart. Past this the globe
 * magnifies a polygon rather than a coast.
 *
 * Both numbers are measured rather than reasoned about, which is the point:
 * the figure they replaced was wrong for long enough to be quoted as a
 * constraint, and a constraint nobody can reproduce is a guess with a
 * decimal point.
 *
 * That is why "more zoom" is not the answer to wanting a closer look: more
 *range* would show the reader the seams. What helps is more *stops* inside
 * the same range, and arriving somewhere worth looking at — see
 * `zoomFocus` in `gestures.ts`, which turns the point under the pointer
 * toward the middle as the sphere grows.
 *
 * **Four stops, evenly spaced.** With only 1 and 2.5, one press of `+` took
 * the whole sphere to maximum magnification — and since zoom magnifies
 * whatever sits at the centre, and the centre is usually open ocean, the
 * result was a featureless near-black disc with every mark off frame. The
 * most discoverable control on the overlay made the page look broken in one
 * click. Three intermediate presses of half a step each read as getting
 * closer to something, and give the focus drift somewhere to happen
 * gradually rather than all at once.
 */
export const ZOOM_STOPS = [1, 1.5, 2, 2.5] as const;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 2.5;

/**
 * How much of a wheel a doubling is worth.
 *
 * Exponential rather than additive, so a notch means the same thing at both
 * ends: zooming in and straight back out returns to where it started instead
 * of drifting, which additive steps do not.
 */
export const WHEEL_ZOOM = 0.0015;

/** Firefox reports wheel deltas in lines rather than pixels. */
export const LINE_HEIGHT = 16;

export function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

/** The next stop up, or back to the first once past the last. */
export function nextZoomStop(from: number): number {
  const next = ZOOM_STOPS.find((stop) => stop > from + 0.01);
  return next ?? ZOOM_STOPS[0];
}

/** The next stop down, or the first. */
export function previousZoomStop(from: number): number {
  const below = ZOOM_STOPS.filter((stop) => stop < from - 0.01);
  return below.at(-1) ?? ZOOM_STOPS[0];
}

/**
 * Where to turn the globe so that magnifying arrives at what the reader
 * pointed at.
 *
 * Zoom on this globe scales the sphere about its own centre — the porthole is
 * fixed, so magnifying fills the same circle with more earth. That makes the
 * centre pixel the only thing anybody can actually zoom *into*, and the
 * centre is usually open ocean: wheeling over South America magnified the
 * Atlantic and pushed South America off the frame. The gesture pointed at one
 * thing and the sphere delivered another.
 *
 * A globe cannot pan the way a map does, because the sphere stays centred. So
 * the analogue of "zoom towards the cursor" is to *rotate* towards it: the
 * point under the pointer is unprojected, and the view turns a share of the
 * way there. The share is the share of the *remaining* range this step
 * consumed, so a wheel run from 1 to `MAX_ZOOM` arrives with the target
 * centred and a single notch moves it a little.
 *
 * Returns null, and the caller leaves the view alone, when there is nothing
 * to aim at: zooming out (pulling back is a request to see more, and turning
 * at the same time moves what somebody is trying to get their bearings on),
 * or a pointer past the limb, where a wheel over the corner of the canvas
 * must not drag the globe somewhere arbitrary.
 *
 * Pure, and separated from the gesture plumbing that calls it, because it is
 * the only part with arithmetic worth checking on its own.
 */
export function focusedView({
  from,
  to,
  at,
  porthole,
  tiltLimit,
}: {
  /** The view as it stands, and the magnification it stands at. */
  from: { spin: number; tilt: number; zoom: number };
  /** The magnification being moved to. */
  to: number;
  /** The pointer, in centre-relative canvas pixels. */
  at: { x: number; y: number };
  /** The sphere's radius at zoom 1, which is what `at` was measured against. */
  porthole: number;
  /** How far from the equator the view may lean, from the caller's own rule. */
  tiltLimit: number;
}): { spin: number; tilt: number } | null {
  if (to <= from.zoom) {
    return null;
  }

  const target = unproject(at.x, at.y, {
    spin: from.spin,
    tilt: from.tilt,
    radius: porthole * from.zoom,
  });
  if (target === null) {
    return null;
  }

  /*
   * How much of what was left of the range this step used. At the top there
   * is nothing left to consume, so the share is forced to one and the last
   * step lands the target dead centre rather than asymptotically near it.
   */
  const remaining = MAX_ZOOM - from.zoom;
  const share =
    remaining <= 0.001 ? 1 : Math.min(1, (to - from.zoom) / remaining);

  /*
   * Spin is cyclic, and the way round matters: +350 degrees and -10 put the
   * same place in the middle, and one of them spins the earth almost all the
   * way round on a scroll notch.
   */
  let delta = (-target.lng - from.spin) % 360;
  if (delta > 180) {
    delta -= 360;
  }
  if (delta < -180) {
    delta += 360;
  }

  const wantTilt = Math.max(-tiltLimit, Math.min(tiltLimit, target.lat));
  return {
    spin: from.spin + delta * share,
    tilt: from.tilt + (wantTilt - from.tilt) * share,
  };
}
