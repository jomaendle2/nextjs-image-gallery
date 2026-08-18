import type { GlobePoint } from "@/lib/photos/globe";
import { project, type View } from "./projection";

/**
 * Where the photographs are on screen, and which one a pointer is at.
 *
 * The seam between the picture and the gesture. `paint.ts` draws whatever
 * this returns and `gestures.ts` tests a pointer against the same array, so
 * the two can never disagree about where a mark is — which is the whole
 * reason the placement is not simply done inside `drawPoints`.
 */

/**
 * How near a pointer has to be to a mark to count as pointing at it, in CSS
 * pixels, for a mouse and for a thumb.
 *
 * `DOT_HALO` in `paint.ts` is 11, so both forgive rather more than the mark
 * draws — which is the right way round, but only just. These deliberately
 * fall short of the 44px touch floor the rest of the site keeps: at the
 * unzoomed size two cells a hundred kilometres apart sit about five pixels
 * apart, and a 44px radius would make a whole coastline into one target. Zoom
 * is what separates crowded marks, and the copy in `GlobeStage` says so.
 */
export const HOVER_RADIUS = 18;
export const TAP_RADIUS = 24;

/**
 * One mark's position on screen, in CSS pixels from the centre of the canvas.
 */
export interface Mark {
  index: number;
  x: number;
  y: number;
}

/**
 * Where every near-side mark has landed, which is both what gets drawn and
 * what gets hit-tested.
 *
 * Split out of `drawPoints` so that the two share one projection pass rather
 * than each doing its own. The frame loop keeps the returned array in a ref;
 * the pointer handler reads that ref instead of re-projecting.
 *
 * The invariant is that the array is **at most one frame old**, not that the
 * globe has stopped: it is written in the same pass that paints, so it always
 * describes the picture the reader is currently looking at. The settle rule in
 * `GlobeCanvas` is what makes pointing at a mark *pleasant* — a target moving
 * at `SPIN_PER_SECOND` is a chase — but it is not what makes this correct.
 *
 * Worth stating precisely, because the stronger claim invited a wrong fix: if
 * hover ever needs to work on a turning globe, nothing here breaks.
 */
export function placeMarks(points: readonly GlobePoint[], view: View): Mark[] {
  const marks: Mark[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const at = point === undefined ? null : project(point.lat, point.lng, view);
    if (at?.visible) {
      marks.push({ index, x: at.x, y: at.y });
    }
  }
  return marks;
}

/**
 * The mark nearest a pointer, or null if the pointer is not near one.
 *
 * A linear scan, deliberately. There are a few hundred marks at most and this
 * runs on `pointermove`, which sounds alarming until it is counted: three
 * hundred squared distances is a few microseconds, against the several
 * milliseconds a spatial index would cost to build every time the view moves.
 *
 * Ties go to the earlier mark, and `placeMarks` preserves `groupIntoCells`
 * order — so where two cells overlap, the busier one wins, which is the same
 * rule that decides which dot draws on top.
 */
export function markNear(
  marks: readonly Mark[],
  x: number,
  y: number,
  within: number,
): Mark | null {
  let best: Mark | null = null;
  let bestDistance = within * within;

  for (const mark of marks) {
    const dx = mark.x - x;
    const dy = mark.y - y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      best = mark;
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * A client point in the centre-relative pixels the sphere works in.
 *
 * `project`, `unproject` and `markNear` all measure from the middle of the
 * canvas, because that is where the sphere is; the DOM measures from the top
 * left of the viewport. Three gestures cross that boundary — the hit test,
 * the wheel and the pinch — and each used to write the same four terms out,
 * which is three chances to drop a `/ 2`.
 *
 * Here rather than beside them because the conversion is the same knowledge
 * as `markNear`'s coordinate space, which this file already owns.
 *
 * The measured box comes back with the point, for the one caller that also
 * converts the other way: the hover card is positioned in canvas-local
 * pixels against a mark measured in centre-relative ones. Sharing the single
 * measurement keeps a second layout read off every `pointermove`.
 */
export function onSphere(
  canvas: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number; box: DOMRect } {
  const box = canvas.getBoundingClientRect();
  return {
    box,
    x: clientX - box.left - box.width / 2,
    y: clientY - box.top - box.height / 2,
  };
}
