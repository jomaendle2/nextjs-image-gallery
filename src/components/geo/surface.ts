/**
 * The drawing surface, kept the size of the box it is drawn in.
 *
 * Its own module because the loop in `GlobeCanvas` had grown a subtlety that
 * reads as boilerplate, and boilerplate is where a subtlety goes to be
 * deleted by the next person: **assigning `canvas.width` resets the canvas.**
 * The specification says so unconditionally — assigning the value it already
 * holds still discards the bitmap, reallocates it, and clears every piece of
 * context state. So the two lines that look like "make sure it is the right
 * size" were, on a globe that repaints sixty times a second, throwing away a
 * four-megapixel buffer and building a new one for each frame.
 *
 * Guarding that is a comparison. Having somewhere to write down *why* it is
 * guarded is a file.
 */

/**
 * The device pixel ratio to draw at, capped.
 *
 * Two is the point past which nobody can see the difference and everybody
 * pays for it: a three-times display would quadruple the pixel count of
 * every frame against a coastline whose vertices are already further apart
 * than the pixels drawing them.
 */
export function drawRatio(devicePixelRatio: number): number {
  return Math.min(devicePixelRatio || 1, 2);
}

/**
 * Size the backing bitmap to its CSS box, and say whether that changed it.
 *
 * The caller needs the answer because a reset canvas has lost its transform
 * and its stroke colour. `GlobeCanvas` re-establishes both every frame
 * regardless, so it ignores the result — but a caller that adjusts rather
 * than re-establishes would be wrong without it, and the honest signature
 * for "this may have wiped your context" is one that returns whether it did.
 */
export function fitSurface(
  canvas: { width: number; height: number },
  cssWidth: number,
  cssHeight: number,
  ratio: number,
): boolean {
  const width = Math.round(cssWidth * ratio);
  const height = Math.round(cssHeight * ratio);
  if (canvas.width === width && canvas.height === height) {
    return false;
  }
  canvas.width = width;
  canvas.height = height;
  return true;
}
