import type { GlobePoint } from "@/lib/photos/globe";

/**
 * Everything drawn on the globe, kept away from the component that owns the
 * canvas.
 *
 * The React shell is about lifecycle: sizing to the device pixel ratio,
 * running the frame loop, releasing a pointer. This is about a sphere. They
 * shared a file until the sphere grew a body, a graticule and filled land,
 * at which point neither half was readable next to the other.
 *
 * No colour anywhere in here. The caller sets one `fillStyle` and one
 * `strokeStyle` from the canvas element's own computed colour, and every
 * function below varies nothing but `globalAlpha` — which is what keeps a
 * canvas inside a design system whose colours live in a stylesheet.
 */

const TO_RADIANS = Math.PI / 180;

const ALPHA_BODY = 0.05;
const ALPHA_LAND = 0.1;
const ALPHA_COAST = 0.26;
const ALPHA_BORDER = 0.11;
const ALPHA_GRATICULE = 0.07;
const ALPHA_HALO = 0.18;
const ALPHA_RING = 0.55;

/** Every 30 degrees: twelve meridians and five parallels, the classic globe. */
const GRATICULE_STEP = 30;
/** How finely a graticule line is walked. Three degrees is smooth at any size. */
const GRATICULE_RESOLUTION = 3;

const DOT_CORE = 2.4;
const DOT_RING = 5.5;
const DOT_HALO = 11;

export interface Projected {
  x: number;
  y: number;
  /** True when the point is on the near side of the sphere. */
  visible: boolean;
}

/**
 * Where the viewer is standing, and how big the sphere is on screen.
 *
 * Passed as one object rather than three arguments because every painter
 * below needs all of it and nothing below needs anything else. `tilt` is the
 * latitude facing the camera: zero looks at the equator edge-on, which is
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
export function project(lat: number, lng: number, view: View): Projected {
  const phi = lat * TO_RADIANS;
  const phi0 = view.tilt * TO_RADIANS;
  const lambda = (lng + view.spin) * TO_RADIANS;

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosPhi0 = Math.cos(phi0);
  const sinPhi0 = Math.sin(phi0);
  const cosLambda = Math.cos(lambda);

  return {
    x: view.radius * cosPhi * Math.sin(lambda),
    // Screen y grows downward; latitude grows upward.
    y: -view.radius * (cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosLambda),
    visible: sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosLambda > 0,
  };
}

/**
 * Lays a ring onto the sphere, pushing whatever is round the back out to the
 * horizon.
 *
 * This is what makes filled continents possible, and it is the one genuinely
 * subtle piece of arithmetic here. Clipping a polygon at the limb properly
 * means finding both crossings and closing the shape along the horizon arc;
 * get it wrong and continents flicker inside out as the sphere turns, which
 * is why the first version of this drew open strokes and no fill at all.
 *
 * Pushing a hidden vertex radially out to the limb instead costs three lines
 * and produces a shape that already follows the horizon, because the horizon
 * is where every hidden point lands. The seam it leaves is a chord across the
 * back of the sphere, which nobody can see, and the caller clips to the disc
 * so nothing escapes even where the approximation is loosest.
 */
function layOnSphere(
  polygon: readonly (readonly number[])[],
  view: View,
): { path: Path2D; anyVisible: boolean } {
  const path = new Path2D();
  let anyVisible = false;

  /*
   * Every ring of the polygon goes into one `Path2D`: the exterior first,
   * then its holes. Filled with `evenodd`, that is what cuts the Caspian, the
   * Great Lakes and Baikal out of the land instead of painting them as part
   * of it — which the first version did, because it flattened polygons into
   * a list of rings and lost which was which.
   */
  for (const ring of polygon) {
    anyVisible = traceRing(path, ring, view) || anyVisible;
    path.closePath();
  }

  return { path, anyVisible };
}

/** One ring onto the path. True if any of it was on the near side. */
function traceRing(path: Path2D, ring: readonly number[], view: View): boolean {
  let anyVisible = false;
  for (let index = 0; index < ring.length; index += 2) {
    const point = project(ring[index + 1] ?? 0, ring[index] ?? 0, view);
    const scale = point.visible
      ? 1
      : view.radius / (Math.hypot(point.x, point.y) || 1);
    anyVisible = anyVisible || point.visible;
    if (index === 0) {
      path.moveTo(point.x * scale, point.y * scale);
    } else {
      path.lineTo(point.x * scale, point.y * scale);
    }
  }
  return anyVisible;
}

/** One graticule line, stopped wherever it passes behind the sphere. */
function walk(
  path: Path2D,
  from: number,
  to: number,
  at: (value: number) => Projected,
): void {
  let drawing = false;
  for (let value = from; value <= to; value += GRATICULE_RESOLUTION) {
    const point = at(value);
    if (!point.visible) {
      drawing = false;
    } else if (drawing) {
      path.lineTo(point.x, point.y);
    } else {
      path.moveTo(point.x, point.y);
      drawing = true;
    }
  }
}

/**
 * Meridians and parallels, at the threshold of visible.
 *
 * The single thing that makes a disc read as a sphere. Without it the
 * continents are a pattern on a circle and the eye has nothing to tell it
 * the surface curves; with it, at seven percent opacity, it is unmistakable
 * and nobody consciously notices it is there.
 */
export function drawGraticule(
  context: CanvasRenderingContext2D,
  view: View,
): void {
  context.globalAlpha = ALPHA_GRATICULE;
  const path = new Path2D();

  for (let lng = -180; lng < 180; lng += GRATICULE_STEP) {
    walk(path, -90, 90, (lat) => project(lat, lng, view));
  }
  for (let lat = -60; lat <= 60; lat += GRATICULE_STEP) {
    walk(path, -180, 180, (lng) => project(lat, lng, view));
  }

  context.stroke(path);
}

/**
 * Filled land under a brighter coastline, which is what gives it substance.
 *
 * The rings arrive as an argument rather than being imported here, so this
 * module holds no opinion about which coastline it is drawing. That is what
 * lets the expanded globe swap in the four-times-finer set without a second
 * copy of any of this, and what keeps `world-fine.ts` out of the bundle:
 * nothing in the static import graph names it.
 */
export function drawLand(
  context: CanvasRenderingContext2D,
  view: View,
  land: readonly (readonly (readonly number[])[])[],
): void {
  for (const polygon of land) {
    const { path, anyVisible } = layOnSphere(polygon, view);
    if (anyVisible) {
      context.globalAlpha = ALPHA_LAND;
      context.fill(path, "evenodd");
      context.globalAlpha = ALPHA_COAST;
      context.stroke(path);
    }
  }
}

/**
 * Country borders, as open strokes at about a third of the coastline's
 * weight.
 *
 * Fainter on purpose. A coastline is a fact about the planet and a border is
 * a fact about people; on a photograph gallery's globe the planet is the
 * subject, and borders are here so that somewhere reads as somewhere. Loud
 * enough to find Switzerland, quiet enough that nobody reads the picture as a
 * claim about anywhere.
 *
 * Never closed and never filled — see `WORLD_BORDERS_FINE`. Points behind the
 * sphere break the line rather than being pushed to the limb, because a
 * border has no interior to preserve and a stroke dragged along the horizon
 * would draw a country that is not there.
 */
export function drawBorders(
  context: CanvasRenderingContext2D,
  view: View,
  borders: readonly (readonly number[])[],
): void {
  context.globalAlpha = ALPHA_BORDER;
  const path = new Path2D();
  for (const line of borders) {
    let drawing = false;
    for (let index = 0; index < line.length; index += 2) {
      const point = project(line[index + 1] ?? 0, line[index] ?? 0, view);
      if (!point.visible) {
        drawing = false;
      } else if (drawing) {
        path.lineTo(point.x, point.y);
      } else {
        path.moveTo(point.x, point.y);
        drawing = true;
      }
    }
  }
  context.stroke(path);
}

/**
 * A halo the size of the uncertainty, an open ring at its edge, and a small
 * solid centre.
 *
 * The same three marks as `WorldDot`, so a photograph's detail sheet and the
 * globe say the same thing the same way. The ring is the load-bearing one: a
 * filled dot draws honest arithmetic as a precise claim, and an outline says
 * "somewhere in here", which is what a cell centre actually means.
 */
export function drawPoints(
  context: CanvasRenderingContext2D,
  points: readonly GlobePoint[],
  view: View,
): void {
  for (const point of points) {
    const at = project(point.lat, point.lng, view);
    if (at.visible) {
      context.globalAlpha = ALPHA_HALO;
      context.beginPath();
      context.arc(at.x, at.y, DOT_HALO, 0, Math.PI * 2);
      context.fill();

      context.globalAlpha = ALPHA_RING;
      context.beginPath();
      context.arc(at.x, at.y, DOT_RING, 0, Math.PI * 2);
      context.stroke();

      context.globalAlpha = 1;
      context.beginPath();
      context.arc(at.x, at.y, DOT_CORE, 0, Math.PI * 2);
      context.fill();
    }
  }
}

/**
 * The body of the sphere, lit from the upper left and falling away to the
 * limb.
 *
 * One light, from the direction light comes from in most of the photographs
 * on this site. Without it the disc is a flat hole that the continents float
 * in, and no amount of detail painted on top reads as round.
 */
export function drawBody(
  context: CanvasRenderingContext2D,
  radius: number,
  ink: string,
): void {
  const gradient = context.createRadialGradient(
    -radius * 0.4,
    -radius * 0.45,
    radius * 0.05,
    0,
    0,
    radius,
  );
  gradient.addColorStop(0, ink);
  gradient.addColorStop(1, "transparent");

  context.globalAlpha = ALPHA_BODY;
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = ink;
}
