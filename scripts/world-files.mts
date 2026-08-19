/**
 * What `build-world.mts` writes, kept apart from how it works.
 *
 * The generator is arithmetic: fetch, simplify, round. This is prose — four
 * file headers explaining to whoever opens the generated data why it exists,
 * how large it is and what may import it. Together they were more than half
 * of a file whose subject is Ramer–Douglas–Peucker, and they are the half
 * that changes for editorial reasons rather than numerical ones.
 *
 * Functions of the already-serialised data rather than constants, so that
 * The serialisers live here too, for the same reason: turning a ring of
 * numbers into the text of a module is this file's subject, and the
 * generator upstream is only interested in which numbers survive.
 */

/** A `[lng, lat]` pair, as everything here passes them around. */
export type Point = [number, number];
/** A polygon: its exterior ring, then any holes. */
export type Polygon = Point[][];

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
/**
 * Rounding, shared by the simplifier upstream and the writers here.
 *
 * It lives in this module rather than in the generator because the generator
 * imports this one — putting it the other way round would be a cycle, and a
 * second copy would be a number two files could disagree about.
 */
export function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function toPath(
  polygons: Polygon[],
  north: number,
  south: number,
): string {
  const clamp = (lat: number): number => Math.min(north, Math.max(south, lat));
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
export function toLiteral(polygons: Polygon[]): string {
  return polygons
    .map(
      (polygon) =>
        `  [${polygon.map((ring) => `[${ring.flat().join(",")}]`).join(",")}],`,
    )
    .join("\n");
}

export const asLines = (lines: Point[][]): string =>
  lines.map((line) => `  [${line.flat().join(",")}],`).join("\n");

export function provenanceOf(SOURCE: string, today: string): string {
  return ` * Source: Natural Earth 1:10m physical / land (\\\`ne_10m_land\\\`), public
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
}

export function pathFile(
  provenance: string,
  pathJson: string,
  PATH_NORTH: number,
  PATH_SOUTH: number,
): string {
  return `/**
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
  ${pathJson};
`;
}

export function globeFile(provenance: string, land: string): string {
  return `/**
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
${land}
];
`;
}

export function fineFile(
  provenance: string,
  land: string,
  borders: string,
): string {
  return `/**
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
${land}
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
${borders}
];
`;
}

export function finestFile(
  provenance: string,
  land: string,
  borders: string,
): string {
  return `/**
 * The coastline again, finer still, for a globe somebody has zoomed into.
 *
${provenance}
 */

/**
 * **Never import this statically, and never eagerly.**
 *
 * The largest file in this repository by some margin, and the one with the
 * narrowest audience: it is fetched only when a reader zooms past the point
 * where \`world-fine\` runs out, which takes a deliberate pinch or three
 * presses of \`+\`. Opening the globe does not load it. Turning the globe
 * does not load it. Wanting a closer look does.
 *
 * That is the whole justification for its size. The zoom ceiling is set by
 * how far apart the vertices are on screen — past roughly 2.7 CSS pixels a
 * globe magnifies a polygon rather than a coast — so a closer look is not a
 * rendering setting, it is more coastline, and there is no tolerance that
 * buys it cheaply. \`build-world.mts\` records the measured curve.
 *
 * \`world.test.ts\` holds its ceiling and asserts that nothing reaches it
 * except by \`import()\`.
 */
export const WORLD_LAND_FINEST: readonly (readonly (readonly number[])[])[] = [
${land}
];

/** Country borders at the matching tolerance. See \`WORLD_BORDERS_FINE\`. */
export const WORLD_BORDERS_FINEST: readonly (readonly number[])[] = [
${borders}
];
`;
}
