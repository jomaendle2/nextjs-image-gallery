/**
 * The public half of a photographer's pin: a point deliberately too blunt to
 * find anything with.
 *
 * A pin is two stored precisions, not one. The exact point a photographer
 * marked is member-only and never enters a public query; this is what the
 * globe draws, and it is computed once at publish time rather than derived
 * on read — deriving it would mean the public query naming the exact
 * columns, which is exactly the thing the member gate rests on never
 * happening.
 *
 * Storing it also makes it stable. A published dot must not move because
 * somebody later tuned the arithmetic below.
 *
 * Pure by design: no imports, no I/O, no clock. The privacy argument for
 * this feature lives in this file, so this file should be readable on its
 * own.
 */

/**
 * The target cell width, in kilometres.
 *
 * **Frozen once anything is published.** Changing it moves every dot on the
 * globe and needs a backfill of every stored coarse point, so
 * `coarsen.test.ts` pins the value — the point is not that any number is
 * sacred but that changing it has to be a decision somebody makes on purpose.
 *
 * It was 100 until the globe learned to magnify. At 1x a hundred-kilometre
 * cell is about three pixels and reads as exact; by 8x it is twenty, and a
 * dot sitting twenty pixels off the headland it names does not read as
 * "roughly here", it reads as wrong. The blur had not changed — the picture
 * had simply become good enough to show it.
 *
 * One kilometre keeps the shape of the promise and drops the visible error to
 * a fifth of a pixel at the deepest stop. What it still refuses to say is the
 * part that matters: a kilometre names a beach, a ridge or a stretch of road,
 * and not a door, a viewpoint or a parked car. The exact point remains
 * member-only and is still never part of a public query.
 */
export const CELL_KM = 1;

/**
 * The worst distance between a real point and the point published for it.
 *
 * A cell is at most `CELL_KM` across on both axes, so the furthest a corner
 * can sit from the centre is `sqrt(0.5² + 0.5²)` ≈ 0.707 km. Rounded *up*,
 * because this number is quoted to photographers as a guarantee and a
 * guarantee may overstate what it protects but must never understate it.
 *
 * The picker quotes this constant rather than a number typed into a sentence,
 * so what a photographer is told cannot drift away from what the code does.
 */
export const MAX_ERROR_KM = 1;

/** Mean length of a degree of latitude. Longitude shrinks with `cos(lat)`. */
const KM_PER_DEGREE = 111.32;

/** Constant everywhere, unlike a degree of longitude. */
const LAT_STEP = CELL_KM / KM_PER_DEGREE;

const ROWS = Math.ceil(180 / LAT_STEP);

const FULL_TURN = 360;

/** Four places ≈ 11 m, still an order of magnitude below the blur, and short in JSON. */
const PLACES = 10_000;

export interface CoarsePoint {
  lat: number;
  lng: number;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function round4(value: number): number {
  return Math.round(value * PLACES) / PLACES;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * The nearest point on the map that is deliberately not where you stood.
 *
 * **Not decimal rounding.** A degree of longitude is 111 km at the equator
 * and 5.8 km at 87°N, so `toFixed(1)` would give Bali an 11 km cell and
 * Svalbard a 0.6 km one — a hundredfold difference in how much is disclosed,
 * decided by latitude rather than by anybody's policy. Rounding also leaves
 * float artefacts (`47.400000000000006`) that fingerprint the input.
 *
 * Instead: a grid of constant-height rows, each cut into a whole number of
 * columns chosen so no cell is wider than `CELL_KM` anywhere along that row.
 * The column count comes from the row edge *nearest the equator*, which is
 * where a row is widest — taking the row's centre instead would let the
 * equator-facing edge of a high-latitude row exceed the target.
 *
 * Near the poles the count collapses toward a handful of cells per row, so
 * the failure mode inverts: high latitudes become *more* private rather than
 * less, which is the opposite of what degree-rounding does.
 *
 * The result is a function of the cell and of nothing else about the input,
 * so two photographs from the same spot collapse to one identical point.
 * That is also the right visual behaviour — a globe should not trace
 * somebody's walk. At a kilometre it collapses a viewpoint rather than a
 * valley, so a day spent moving around one area now reads as a few marks
 * where it used to read as one; `globe.ts` groups them for the headings.
 */
export function coarsen(lat: number, lng: number): CoarsePoint {
  const row = clamp(Math.floor((lat + 90) / LAT_STEP), 0, ROWS - 1);
  const low = -90 + row * LAT_STEP;
  /*
   * 180 is not a multiple of `LAT_STEP`, so the last row runs off the top of
   * the sphere. Clipping it here rather than clamping the centre afterwards
   * keeps the published point inside the row it actually describes.
   */
  const high = Math.min(90, low + LAT_STEP);

  const widest = Math.min(Math.abs(low), Math.abs(high));
  const columns = Math.max(
    1,
    Math.ceil((FULL_TURN * Math.cos(toRadians(widest))) / LAT_STEP),
  );
  const columnWidth = FULL_TURN / columns;

  // `lng === 180` is the east edge of the last column, not a column of its own.
  const column = clamp(Math.floor((lng + 180) / columnWidth), 0, columns - 1);

  return {
    lat: round4((low + high) / 2),
    lng: round4(-180 + (column + 0.5) * columnWidth),
  };
}
