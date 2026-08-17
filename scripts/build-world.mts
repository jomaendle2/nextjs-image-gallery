/**
 * Regenerates `src/lib/geo/world.ts` from Natural Earth's 110m land layer.
 *
 * Run by hand, not by the build:
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-world.mts
 *
 * The coastline of the world changes about as often as this file needs to,
 * so the output is committed as data and this exists to make the provenance
 * checkable rather than to run on every deploy. It fetches over the network
 * and writes one file; nothing else imports it.
 *
 * Deliberately not a dependency. `mapshaper`, `topojson-client` and `d3-geo`
 * would each do part of this in fewer lines, and all three would land in
 * `package.json` forever for a job that runs approximately never. The arc
 * decoding is twenty lines and the simplification is thirty.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/**
 * world-atlas' `land-110m`, which is Natural Earth 1:110m `ne_110m_land`
 * quantized into TopoJSON. Natural Earth is public domain.
 */
const SOURCE = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json";

/**
 * Two levels, because the two consumers want different things.
 *
 * `WORLD_PATH` is drawn at about 160 px wide behind a single dot, where a
 * fjord is one subpixel; `WORLD_RINGS` is drawn on a globe somebody can look
 * at. Shipping the detailed version to every photograph's detail sheet would
 * cost four times the bytes for detail nobody can see.
 */
const PATH_TOLERANCE = 0.9;
const RINGS_TOLERANCE = 0.28;

/** Rings smaller than this in bounding-box degrees are dropped outright. */
const PATH_MIN_SPAN = 4;
const RINGS_MIN_SPAN = 1.2;

interface Topology {
  arcs: number[][][];
  transform: { scale: [number, number]; translate: [number, number] };
  objects: {
    land: {
      geometries: { type: string; arcs: number[][][] | number[][] }[];
    };
  };
}

type Point = [number, number];

/** TopoJSON stores arcs as quantized deltas; this puts them back in degrees. */
function decodeArcs(topology: Topology): Point[][] {
  const [scaleX, scaleY] = topology.transform.scale;
  const [translateX, translateY] = topology.transform.translate;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx = 0, dy = 0]): Point => {
      x += dx;
      y += dy;
      return [x * scaleX + translateX, y * scaleY + translateY];
    });
  });
}

/**
 * TopoJSON writes a reversed arc as `-index - 1` rather than `-index`,
 * because zero has no negative. Arcs joined end to end share a point, so
 * every arc after the first drops its own.
 */
function ringFrom(indices: number[], arcs: Point[][]): Point[] {
  const points: Point[] = [];
  for (const index of indices) {
    const arc = arcs[index < 0 ? -index - 1 : index];
    if (arc !== undefined) {
      const ordered = index < 0 ? [...arc].reverse() : arc;
      points.push(...(points.length > 0 ? ordered.slice(1) : ordered));
    }
  }
  return points;
}

function span(ring: Point[]): number {
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  return Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
}

/** Perpendicular distance from `point` to the segment `start`–`end`. */
function deviation(point: Point, start: Point, end: Point): number {
  const [px, py] = point;
  const [ax, ay] = start;
  const [bx, by] = end;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = Math.min(
    1,
    Math.max(0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** The point in `(first, last)` furthest off the chord, or -1 if none is. */
function furthest(
  ring: Point[],
  first: number,
  last: number,
  tolerance: number,
): number {
  const start = ring[first];
  const end = ring[last];
  if (start === undefined || end === undefined) {
    return -1;
  }
  let worst = tolerance;
  let at = -1;
  for (let index = first + 1; index < last; index += 1) {
    const point = ring[index];
    const distance = point === undefined ? 0 : deviation(point, start, end);
    if (distance > worst) {
      worst = distance;
      at = index;
    }
  }
  return at;
}

/** Ramer–Douglas–Peucker, iterative so a long coastline cannot blow the stack. */
function simplify(ring: Point[], tolerance: number): Point[] {
  if (ring.length < 3) {
    return ring;
  }
  const keep = new Array<boolean>(ring.length).fill(false);
  keep[0] = true;
  keep[ring.length - 1] = true;
  const stack: [number, number][] = [[0, ring.length - 1]];

  while (stack.length > 0) {
    const segment = stack.pop();
    if (segment === undefined) {
      break;
    }
    const [first, last] = segment;
    const at = furthest(ring, first, last, tolerance);
    if (at !== -1) {
      keep[at] = true;
      stack.push([first, at], [at, last]);
    }
  }

  return ring.filter((_, index) => keep[index] === true);
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function prepare(
  input: Point[][],
  tolerance: number,
  minSpan: number,
  places: number,
): Point[][] {
  return input
    .filter((ring) => span(ring) >= minSpan)
    .map((ring) => simplify(ring, tolerance))
    .filter((ring) => ring.length >= 4)
    .map((ring) =>
      ring.map(([x, y]): Point => [round(x, places), round(y, places)]),
    );
}

/**
 * An SVG path in the `0 0 360 180` box: `x = lng + 180`, `y = 90 - lat`.
 *
 * Equirectangular, which is to say no projection at all — the consumer draws
 * a dot at the same two subtractions, so the picture and the point cannot
 * disagree about where anything is.
 */
function toPath(input: Point[][]): string {
  return input
    .map((ring) =>
      ring
        .map(
          ([x, y], index) =>
            `${index === 0 ? "M" : "L"}${round(x + 180, 1)} ${round(90 - y, 1)}`,
        )
        .join("")
        .concat("Z"),
    )
    .join("");
}

const response = await fetch(SOURCE);
if (!response.ok) {
  throw new Error(`${SOURCE} answered ${response.status}`);
}
const source = (await response.json()) as Topology;
const decoded = decodeArcs(source);

const allRings: Point[][] = [];
for (const geometry of source.objects.land.geometries) {
  const polygons = (
    geometry.type === "Polygon"
      ? [geometry.arcs as number[][]]
      : (geometry.arcs as number[][][])
  ) as number[][][];
  for (const polygon of polygons) {
    for (const indices of polygon) {
      allRings.push(ringFrom(indices, decoded));
    }
  }
}

const pathRings = prepare(allRings, PATH_TOLERANCE, PATH_MIN_SPAN, 1);
const globeRings = prepare(allRings, RINGS_TOLERANCE, RINGS_MIN_SPAN, 2);

const today = new Date().toISOString().slice(0, 10);
const file = `/**
 * The coastline of the world, as data.
 *
 * Source: Natural Earth 1:110m physical / land (\`ne_110m_land\`), public
 * domain, taken from world-atlas' TopoJSON build of it:
 * ${SOURCE}
 *
 * Generated ${today} by \`scripts/build-world.mts\`:
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-world.mts
 *
 * **Do not edit by hand.** Re-run the script instead — it is the only record
 * of where these numbers came from, and a hand-edited coastline is one
 * nobody can check against anything.
 *
 * No npm dependency backs this. \`d3-geo\` (~28 KB) and \`topojson-client\`
 * would each be a runtime dependency for something that changes about as
 * often as the shape of the continents; the projection at both call sites is
 * arithmetic, so there is nothing left for a library to do.
 *
 * \`world.test.ts\` holds a byte ceiling on this file, so swapping in the 10m
 * dataset — which is thirty times the size and looks almost identical at the
 * sizes drawn here — fails rather than quietly landing in every page.
 *
 * Two exports in one module, and they are wildly different sizes — about
 * 3.6 KB gzipped against about 12.8 KB. Nothing here has a side effect, so a
 * page importing only \`WORLD_PATH\` gets only \`WORLD_PATH\`; that is the whole
 * reason the constants are plain and top-level. If tree-shaking ever stops
 * working, the symptom is the detail sheet of every photograph carrying a
 * globe's worth of coastline, and the fix is to split this in two.
 *
 * Biome does not format this file (see \`biome.json\`). Generated data laid
 * out one number per line would be forty thousand lines of diff nobody
 * reads.
 */

/**
 * Land as one SVG path in the box \`0 0 360 180\`, where \`x = lng + 180\` and
 * \`y = 90 - lat\`.
 *
 * Simplified hard, because its only consumer draws it about 160 px wide
 * behind a single dot. Equirectangular, which is to say not projected at
 * all: the dot is placed with the same two subtractions, so the picture and
 * the point cannot disagree.
 */
export const WORLD_PATH =
  ${JSON.stringify(toPath(pathRings))};

/**
 * The same coastlines as closed rings of \`[lng, lat]\`, for the globe, which
 * projects them itself and therefore needs the points rather than a path.
 *
 * Flat pairs rather than nested arrays: half the JSON punctuation, and the
 * consumer walks them two at a time anyway.
 */
export const WORLD_RINGS: readonly (readonly number[])[] = [
${globeRings.map((ring) => `  [${ring.flat().join(",")}],`).join("\n")}
];
`;

const out = join(import.meta.dirname, "..", "src", "lib", "geo", "world.ts");
writeFileSync(out, file);

const points = globeRings.reduce((total, ring) => total + ring.length, 0);
console.log(
  [
    `wrote ${out}`,
    `  path:  ${pathRings.length} rings, ${toPath(pathRings).length} chars`,
    `  globe: ${globeRings.length} rings, ${points} points`,
    `  file:  ${file.length} bytes raw, ${gzipSync(file).length} gzipped`,
  ].join("\n"),
);
