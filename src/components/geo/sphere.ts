import type { Mark } from "./marks";
import {
  drawBody,
  drawBorders,
  drawGraticule,
  drawLand,
  drawPoints,
} from "./paint";
import type { View } from "./projection";

/**
 * One whole sphere, in the order its layers have to go down.
 *
 * Between `paint.ts`, which knows how to draw a coastline but not what else
 * is on the globe, and `GlobeCanvas`, whose job is timing and sizing. This
 * file is the picture: which layers, in which order, clipped to what. It sat
 * inside the frame loop until the loop was doing both, which is the shape a
 * render loop grows into if nobody stops it.
 */

/** Polygons of rings of flat lng/lat pairs. A hole is the Caspian. */
export type Land = readonly (readonly (readonly number[])[])[];
/** Open polylines. Country borders, drawn only on the expanded globe. */
export type Borders = readonly (readonly number[])[];

export interface Detailed {
  land: Land;
  borders: Borders;
}

/** Fraction of the canvas the sphere fills, leaving the rim somewhere to sit. */
export const FILL = 0.88;

export const ALPHA_LIMB = 0.16;

export function paintSphere(
  context: CanvasRenderingContext2D,
  view: View,
  ink: string,
  content: {
    detailed: Detailed | null;
    coarse: Land | null;
    marks: readonly Mark[];
    /**
     * The circle the picture is cut to, which is the sphere at rest and stays
     * put once the sphere grows past it.
     */
    frame: number;
    highlighted: number | null;
  },
): void {
  /*
   * Everything is clipped to the frame, the body included. At rest the frame
   * *is* the sphere and this is the disc it always was; magnified, the sphere
   * overflows a circle that does not move, which is what looking at part of a
   * globe through a porthole does.
   *
   * The limb arithmetic in `paint.ts` is close rather than exact, and a hard
   * edge is what turns "close" into "a sphere". Magnification helps it twice
   * over: the approximation is only loose near the limb, and the limb is the
   * first thing to leave the frame.
   */
  context.save();
  context.beginPath();
  context.arc(0, 0, content.frame, 0, Math.PI * 2);
  context.clip();

  drawBody(context, view.radius, ink);
  drawGraticule(context, view);
  /*
   * Neither set has arrived on the first frame or two, and a globe with a
   * body, a graticule and a rim but no coastline is a perfectly good globe to
   * hold for a moment. The alternative — waiting for land before painting
   * anything — would replace a sphere gaining detail with a blank square.
   */
  const land = content.detailed?.land ?? content.coarse;
  if (land !== null) {
    drawLand(context, view, land, content.frame);
  }
  if (content.detailed !== null) {
    drawBorders(context, view, content.detailed.borders);
  }
  drawPoints(context, content.marks, content.highlighted);

  context.restore();

  /*
   * The rim last, so nothing paints over it — and only while there is a rim
   * to draw. Once the sphere is wider than the frame the limb is off the
   * picture, and stroking the frame instead would draw a circle that is not
   * the edge of anything.
   */
  if (view.radius <= content.frame) {
    context.globalAlpha = ALPHA_LIMB;
    context.beginPath();
    context.arc(0, 0, view.radius, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
  }
}
