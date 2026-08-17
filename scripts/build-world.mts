/**
 * Regenerates the committed coastline in `src/lib/geo` from Natural Earth.
 *
 * Run by hand, not by the build:
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-world.mts
 *
 * The coastline of the world changes about as often as this file needs to, so
 * the output is committed as data and this exists to make the provenance
 * checkable rather than to run on every deploy. It fetches eighteen megabytes
 * over the network and writes two files; nothing else imports it.
 *
 * Deliberately not a dependency. `mapshaper`, `topojson-client` and `d3-geo`
 * would each do part of this in fewer lines, and all three would sit in
 * `package.json` forever for a job that runs approximately never. Reading
 * GeoJSON is ten lines and the simplification is thirty.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/**
 * Natural Earth 1:10m physical / land, the finest they publish. Public
 * domain, served from jsDelivr's GitHub mirror.
 *
 * 10m rather than 50m or 110m, and the reasoning has been the same each time
 * this moved: source resolution and output size are independent knobs here.
 * The simplifier below decides how many vertices survive; the source decides
 * only *which* vertices it has to choose from. A pre-generalised source is
 * somebody else's simplification, made for a scale that is not this one, and
 * simplifying it again compounds two approximations — which is why 110m gave
 * an oval Africa at every tolerance, and why 50m gave a Norway with no
 * fjords.
 *
 * Starting from the real coastline and doing the cutting here means every
 * vertex that survives is where the coast actually is. The cost is a slower
 * script and nothing else: the committed output is exactly what the
 * tolerances below say, and `world.test.ts` holds a ceiling on each file.
 */
const SOURCE =
  "https://cdn.jsdelivr.net/gh/martynafford/natural-earth-geojson@master/10m/physical/ne_10m_land.json";

/**
 * Country borders, as lines rather than as country polygons.
 *
 * `ne_10m_admin_0_countries` is the obvious layer and the wrong one: it is
 * every country as a filled shape, which means every shared border stored
 * twice and roughly ten times the data, to produce a picture in which the
 * only thing visible is the borders. The boundary-lines layer is what is
 * actually wanted.
 *
 * **Only the expanded globe draws these.** At 420px a border is noise laid
 * over a coastline; at 900px it is the difference between a landmass and a
 * world with people in it. So they live in `world-fine.ts` with the rest of
 * the on-demand detail, and no page pays for them until somebody opens the
 * globe.
 *
 * Land boundaries only. The maritime ones are mostly straight lines through
 * open water, which on a globe read as scratches on the lens.
 */
const BORDERS =
  "https://cdn.jsdelivr.net/gh/martynafford/natural-earth-geojson@master/10m/cultural/ne_10m_admin_0_boundary_lines_land.json";

/**
 * How much coastline survives, per consumer: degrees of tolerance for
 * Ramer–Douglas–Peucker, and the smallest bounding-box span worth keeping.
 *
 * Each pair comes from the size the thing is actually drawn at.
 *
 * - The flat map is about 300px for a whole world, so a degree is a quarter
 *   of a pixel and there is nothing to gain below about a fifth of one.
 * - The inline globe shows half the world across 420px — roughly three times
 *   the detail per degree.
 * - The expanded globe is twice that again, and is the only place where a
 *   fiftieth of a degree is something an eye can find.
 */
const RECIPES = {
  path: { tolerance: 0.55, minSpan: 0.9, places: 1 },
  globe: { tolerance: 0.28, minSpan: 0.6, places: 2 },
  fine: { tolerance: 0.07, minSpan: 0.22, places: 3 },
  /*
   * Borders are thinner than coasts and forgive more, and a lower span bar
   * keeps the small enclaves that make the picture read as real.
   */
  borders: { tolerance: 0.08, minSpan: 0.15, places: 3 },
} as const;

/**
 * The band the flat map draws, in degrees of latitude.
 *
 * Equirectangular has no way to draw a pole: a polygon whose edge lies along
 * latitude -90 becomes a rectangle the full width of the world, so Antarctica
 * rendered as a detached bar across the bottom and the Arctic islands smeared
 * into another along the top. That is what made the first version look
 * broken, and no amount of styling fixes a bar.
 *
 * So the map is cropped, which is what every well-made world graphic does.
 * The band ends at 74 N and 56 S: it holds Iceland, Lofoten, southern
 * Greenland, Alaska and Tierra del Fuego, and leaves out the high Arctic —
 * which matters because equirectangular stretches longitude by `1/cos(lat)`,
 * so at 80 N the Canadian archipelago is smeared nearly six times its real
 * width and the top of the map becomes horizontal hatching.
 *
 * Shapes lying entirely outside the band are dropped rather than clamped, for
 * the same reason: flattening two dozen small islands onto the crop line
 * draws two dozen stacked horizontal strokes.
 */
const PATH_NORTH = 74;
const PATH_SOUTH = -56;

/**
 * Antarctica, dropped from everything.
 *
 * On the flat map it is the crop's whole reason. On the globe it fails
 * differently and just as visibly: the limb trick that makes filled
 * continents possible pushes hidden vertices radially out to the horizon, and
 * a ring closing *across* the pole has a whole edge of points that all want
 * the same place — so they fan into spokes converging under Australia.
 *
 * Nothing is lost that anybody will look for. No photograph in this gallery
 * is south of here, and a globe of somebody's travels is not a reference
 * atlas.
 */
const ANTARCTIC = -60;

type Point = [number, number];
/** Exterior ring first, then any holes. Lakes are holes. */
type Polygon = Point[][];

interface Recipe {
  tolerance: number;
  minSpan: number;
  places: number;
}

interface GeoJson {
  features: {
    geometry: {
      type: string;
      coordinates: number[][] | number[][][] | number[][][][];
    };
  }[];
}

/**
 * GeoJSON rather than TopoJSON: no arc decoding, and a polygon arrives with
 * its holes attached.
 *
 * The holes matter less than it sounds, and the honest number is worth
 * writing down because the first version of this comment guessed and was
 * wrong. Of 4064 polygons in `ne_10m_land`, exactly **one** has a hole: the
 * Caspian. Every other inland water is either cut into the outline as a
 * concavity or simply not in this layer at all, so "the Great Lakes were
 * being painted as land" was never true — they are not in the data.
 *
 * One hole is still worth carrying. Painted solid, it is a Caspian-shaped
 * piece of land in the middle of Asia, which is exactly the sort of thing
 * that makes a map read as wrong without anybody being able to say why.
 */
function readPolygons(geo: GeoJson): Polygon[] {
  const polygons: Polygon[] = [];
  for (const feature of geo.features) {
    const { type, coordinates } = feature.geometry;
    const many = (
      type === "Polygon"
        ? [coordinates as number[][][]]
        : (coordinates as number[][][][])
    ) as number[][][][];
    for (const polygon of many) {
      polygons.push(
        polygon.map((ring) => ring.map(([x = 0, y = 0]): Point => [x, y])),
      );
    }
  }
  return polygons;
}

/**
 * Borders arrive as open lines rather than closed rings, and are read
 * separately so they never get closed. A border joined back to its own start
 * is a country-shaped outline, which is the thing this layer exists to avoid.
 */
function readLines(geo: GeoJson): Point[][] {
  const lines: Point[][] = [];
  for (const feature of geo.features) {
    const { type, coordinates } = feature.geometry;
    const many = (
      type === "LineString"
        ? [coordinates as number[][]]
        : (coordinates as number[][][])
    ) as number[][][];
    for (const line of many) {
      lines.push(line.map(([x = 0, y = 0]): Point => [x, y]));
    }
  }
  return lines;
}

function span(ring: Point[]): number {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return Math.max(maxX - minX, maxY - minY);
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

/**
 * Simplifies a whole polygon, keeping its holes.
 *
 * A hole is filtered on its own span like any other ring, so a lake too small
 * to draw is dropped rather than becoming a one-pixel speck of background
 * inside a continent. In this dataset that filter only ever has the Caspian
 * to consider.
 */
function prepare(
  polygons: Polygon[],
  recipe: Recipe,
  cropNorth?: number,
): Polygon[] {
  const { tolerance, minSpan, places } = recipe;
  const out: Polygon[] = [];

  for (const polygon of polygons) {
    const [exterior, ...holes] = polygon;
    const skip =
      exterior === undefined ||
      span(exterior) < minSpan ||
      exterior.every(([, y]) => y <= ANTARCTIC) ||
      (cropNorth !== undefined && exterior.every(([, y]) => y >= cropNorth));

    if (!skip) {
      const rings = [exterior, ...holes.filter((hole) => span(hole) >= minSpan)]
        .map((ring) => simplify(ring, tolerance))
        .filter((ring) => ring.length >= 4)
        .map((ring) =>
          ring.map(([x, y]): Point => [round(x, places), round(y, places)]),
        );
      if (rings.length > 0) {
        out.push(rings);
      }
    }
  }
  return out;
}

/**
 * An SVG path in `x = lng + 180`, `y = 90 - lat`.
 *
 * Equirectangular, which is to say no projection at all — the consumer draws
 * a mark with the same two subtractions, so the picture and the point cannot
 * disagree about where anything is.
 *
 * Every ring of every polygon goes into one path, and the component fills it
 * with `evenodd`, which is what cuts the Caspian out. Winding order would do
 * the same under `nonzero`, but only if the source is consistent about it,
 * and trusting that is how a Caspian-shaped piece of land appears.
 *
 * Latitude is clamped into the drawn band rather than the ring being clipped
 * against it. Clipping properly means closing the cut edge along the crop
 * line; clamping lays the stray vertices flat along the edge, where the frame
 * covers them.
 */
function toPath(polygons: Polygon[]): string {
  const clamp = (lat: number): number =>
    Math.min(PATH_NORTH, Math.max(PATH_SOUTH, lat));
  return polygons
    .flat()
    .map((ring) =>
      ring
        .map(
          ([x, y], index) =>
            `${index === 0 ? "M" : "L"}${round(x + 180, 1)} ${round(90 - clamp(y), 1)}`,
        )
        .join("")
        .concat("Z"),
    )
    .join("");
}

/** `[[ring, ring], [ring]]`, each ring a flat run of lng/lat pairs. */
function toLiteral(polygons: Polygon[]): string {
  return polygons
    .map(
      (polygon) =>
        `  [${polygon.map((ring) => `[${ring.flat().join(",")}]`).join(",")}],`,
    )
    .join("\n");
}

function vertices(polygons: Polygon[]): number {
  return polygons.reduce(
    (total, polygon) =>
      total + polygon.reduce((sum, ring) => sum + ring.length, 0),
    0,
  );
}

const response = await fetch(SOURCE);
if (!response.ok) {
  throw new Error(`${SOURCE} answered ${response.status}`);
}
const all = readPolygons((await response.json()) as GeoJson);

const borderResponse = await fetch(BORDERS);
if (!borderResponse.ok) {
  throw new Error(`${BORDERS} answered ${borderResponse.status}`);
}
const borderLines = readLines((await borderResponse.json()) as GeoJson)
  .filter((line) => span(line) >= RECIPES.borders.minSpan)
  .filter((line) => !line.every(([, y]) => y <= ANTARCTIC))
  .map((line) => simplify(line, RECIPES.borders.tolerance))
  .filter((line) => line.length >= 2)
  .map((line) =>
    line.map(([x, y]): Point => [
      round(x, RECIPES.borders.places),
      round(y, RECIPES.borders.places),
    ]),
  );

const pathPolygons = prepare(all, RECIPES.path, PATH_NORTH);
const globePolygons = prepare(all, RECIPES.globe);
const finePolygons = prepare(all, RECIPES.fine);

const today = new Date().toISOString().slice(0, 10);
const provenance = ` * Source: Natural Earth 1:10m physical / land (\\\`ne_10m_land\\\`), public
 * domain:
 * ${SOURCE}
 *
 * Generated ${today} by \\\`scripts/build-world.mts\\\`:
 *
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-world.mts
 *
 * **Do not edit by hand.** Re-run the script — it is the only record of where
 * these numbers came from, and a hand-edited coastline is one nobody can
 * check against anything.
 *
 * Biome does not format these files (see \\\`biome.json\\\`). Generated data laid
 * out one number per line would be a hundred thousand lines of diff nobody
 * reads.`;

/*
 * Three files, not one, and the split is the performance guarantee.
 *
 * These are wildly different sizes and reach wildly different numbers of
 * pages. A single module with three exports would leave that entirely to
 * tree-shaking — which does work, and which nobody would notice had stopped
 * working, because the symptom is a slower page rather than a broken one.
 * Separate modules make it structural: a page that imports the path cannot
 * receive the globe, whatever the bundler decides.
 *
 *   world-path.ts  ~7 KB    every gallery page, for the mark in a detail sheet
 *   world.ts       ~24 KB   `/globe` only
 *   world-fine.ts  ~120 KB  fetched by `import()` when the globe is opened
 */

const pathFile = `/**
 * The flat world, as one SVG path.
 *
${provenance}
 */

/**
 * The box \`WORLD_PATH\` is drawn in, as an SVG \`viewBox\`.
 *
 * Exported rather than typed into the component, because the two have to
 * agree exactly. The path is cropped to a band of latitude, and a component
 * assuming the full sphere would draw the band stretched over it and put
 * every mark in the wrong place.
 */
export const WORLD_VIEW_BOX = "0 ${90 - PATH_NORTH} 360 ${PATH_NORTH - PATH_SOUTH}";

/** The band the map covers. A point outside it must be clamped, not drawn. */
export const WORLD_NORTH = ${PATH_NORTH};
export const WORLD_SOUTH = ${PATH_SOUTH};

/**
 * Land as one SVG path, where \`x = lng + 180\` and \`y = 90 - lat\`.
 *
 * **Must be filled with \`fill-rule: evenodd\`.** The Caspian is in here as an
 * inner ring, and under the default \`nonzero\` an inconsistently wound source
 * paints it as a piece of land in the middle of Asia.
 *
 * Its own module because it is the only part of this data that reaches every
 * gallery page, and it must not be able to drag the globe's coastline along
 * with it.
 */
export const WORLD_PATH =
  ${JSON.stringify(toPath(pathPolygons))};
`;

const file = `/**
 * The coastline of the world, for the globe.
 *
${provenance}
 */

/**
 * Land as polygons of closed rings of \`[lng, lat]\`, for the globe, which
 * projects them itself and needs points rather than a path.
 *
 * Three levels deep, and the middle one is the reason: a polygon is its
 * exterior followed by its holes, so the renderer can cut the Caspian out
 * instead of painting it. Flat number runs at the bottom — half the JSON
 * punctuation, and the consumer walks them two at a time anyway.
 *
 * Reached from \`/globe\` and nowhere else. The flat map lives in
 * \`world-path.ts\`, and keeping them apart is what stops a photograph's
 * detail sheet paying for a sphere it does not draw.
 */
export const WORLD_LAND: readonly (readonly (readonly number[])[])[] = [
${toLiteral(globePolygons)}
];
`;

const fine = `/**
 * The same coastline, several times finer, for the expanded globe only.
 *
${provenance}
 */

/**
 * **Never import this statically.** It is several times the size of
 * everything else in \`src/lib/geo\` put together, and it exists for one
 * interaction: opening the globe full-screen, where the sphere is twice the
 * diameter and a fourteenth of a degree stops being invisible.
 * \`GlobeCanvas\` fetches it with a dynamic \`import()\` on that click and never
 * before, which is the same bargain the contributor page makes with the map
 * library.
 *
 * \`world.test.ts\` asserts both halves: this file is much larger than
 * \`world.ts\`, and nothing in the codebase reaches it except by \`import()\`.
 */
export const WORLD_LAND_FINE: readonly (readonly (readonly number[])[])[] = [
${toLiteral(finePolygons)}
];

/**
 * Country borders as open polylines of \`[lng, lat]\`, flat pairs like the
 * coastline.
 *
 * Open, and it matters: these are strokes, never fills. Closing them would
 * turn every shared border into two overlapping country outlines, which is
 * twice the ink and twice the data for a worse picture.
 *
 * Drawn far fainter than the coast. A coastline is a fact about the planet
 * and a border is a fact about people, and on a photograph gallery's globe
 * the planet is the subject — these are here so that somewhere reads as
 * somewhere, not so anybody can measure a claim.
 */
export const WORLD_BORDERS_FINE: readonly (readonly number[])[] = [
${borderLines.map((line) => `  [${line.flat().join(",")}],`).join("\n")}
];
`;

const geo = join(import.meta.dirname, "..", "src", "lib", "geo");
writeFileSync(join(geo, "world-path.ts"), pathFile);
writeFileSync(join(geo, "world.ts"), file);
writeFileSync(join(geo, "world-fine.ts"), fine);

console.log(
  [
    "wrote world-path.ts, world.ts and world-fine.ts",
    `  path:  ${pathPolygons.length} shapes, ${toPath(pathPolygons).length} chars`,
    `  globe: ${globePolygons.length} shapes, ${vertices(globePolygons)} points`,
    `  fine:  ${finePolygons.length} shapes, ${vertices(finePolygons)} points`,
    `  bord:  ${borderLines.length} lines`,
    `  world-path.ts ${gzipSync(pathFile).length} gzipped  (every gallery page)`,
    `  world.ts      ${gzipSync(file).length} gzipped  (/globe only)`,
    `  world-fine.ts ${gzipSync(fine).length} gzipped  (on demand)`,
  ].join("\n"),
);
