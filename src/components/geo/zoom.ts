/**
 * The magnification, and the two stops it moves between.
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
 * Two rather than a continuum of named steps because there are two things to
 * look at: the whole earth, and a coastline. `MAX_ZOOM` is where the finer
 * data runs out rather than where the arithmetic does — the fine coastline
 * carries a vertex every 0.07 degrees, which on the largest display anyone
 * is likely to use lands about three device pixels apart at 2.5x. Past that
 * the globe would magnify a polygon rather than a coast.
 */
export const ZOOM_STOPS = [1, 2.5] as const;
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
