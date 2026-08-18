import type { GlobePointRow } from "./types";

/**
 * Turning a list of published points into the handful of places they are.
 *
 * **Clustering is the payload design, not a visual nicety.** `coarsen`
 * already collapses everything within about a hundred kilometres onto one
 * identical point, so the rows arriving here are mostly duplicates — three
 * hundred photographs are perhaps a hundred and twenty distinct cells.
 * Grouping on the way out is the difference between a page that scales with
 * the gallery and one that scales with the world.
 *
 * | photographs | cells | JSON |
 * | ---: | ---: | ---: |
 * | 14 | ≤ 14 | ~1.5 KB |
 * | 300 | ~120 | ~12 KB |
 * | 1000 | ~300 | ~30 KB |
 *
 * Pure, and separate from both the query and the page, so the grouping can
 * be tested without a database or a renderer.
 */

/** One coarsened cell, and the photographs that landed in it. */
export interface GlobeCell {
  /**
   * Stable identity, and the tiebreaker of last resort when two cells hold
   * the same number of photographs under the same first label.
   */
  key: string;
  lat: number;
  lng: number;
  /**
   * What the photographers called this place, in their own words, deduped.
   *
   * **No reverse geocoding.** It would mean a seventh processor and a
   * request per cell, to produce a worse answer: "Nusa Penida" is what the
   * person who was there chose to write, and an API would offer
   * "Klungkung Regency" or the name of the nearest airport.
   *
   * Empty when nobody in the cell named a place, which is allowed — a
   * photographer may mark a spot without writing a location.
   */
  labels: string[];
  photos: { id: string; title: string }[];
}

/**
 * The key is the rounded pair rather than a hash: two rows from one cell
 * carry byte-identical numbers because `coarsen` returns the cell centre, so
 * string equality is exact grouping rather than an approximation of it.
 */
function keyOf(row: GlobePointRow): string {
  return cellKeyOf(row.coarse_lat, row.coarse_lng);
}

/**
 * The same key, from a bare pair of coordinates.
 *
 * Exported because two things now have to agree on cell identity across a
 * cache boundary: the page, which renders cells to HTML, and `/api/globe`,
 * which is fetched when the globe is expanded and revalidates on its own
 * clock. Matching those two by array position would work exactly until a
 * photograph was published between one revalidation and the other, at which
 * point every index past it shifts by one and a thumbnail from Bali appears
 * over Iceland — a bug that would only ever show up in production, an hour
 * after a deploy, to whoever happened to be looking.
 *
 * The key is the rounded pair rather than a hash for the reason `keyOf`
 * gives: `coarsen` returns the cell centre, so two rows from one cell carry
 * byte-identical numbers and string equality is exact.
 */
export function cellKeyOf(lat: number, lng: number): string {
  return `${lat},${lng}`;
}

/**
 * Groups published points into cells, busiest first.
 *
 * The order is what the page reads down and what decides which dot draws on
 * top, so it has to be total: photograph count, then the first label
 * alphabetically, then the key. Sorting by count alone would leave two
 * equal cells in whatever order the query happened to return, and the page
 * is cached for an hour — so a tie that resolved differently on each
 * revalidation would reshuffle the list under a reader for no reason.
 */
export function groupIntoCells(rows: readonly GlobePointRow[]): GlobeCell[] {
  const cells = new Map<string, GlobeCell>();

  for (const row of rows) {
    const key = keyOf(row);
    const existing = cells.get(key);
    const cell = existing ?? {
      key,
      lat: row.coarse_lat,
      lng: row.coarse_lng,
      labels: [],
      photos: [],
    };
    if (existing === undefined) {
      cells.set(key, cell);
    }

    const label = row.location?.trim() ?? "";
    if (label !== "" && !cell.labels.includes(label)) {
      cell.labels.push(label);
    }
    cell.photos.push({ id: row.id, title: row.title });
  }

  return [...cells.values()].sort(compareCells);
}

function compareCells(a: GlobeCell, b: GlobeCell): number {
  if (a.photos.length !== b.photos.length) {
    return b.photos.length - a.photos.length;
  }
  const byLabel = (a.labels[0] ?? "").localeCompare(b.labels[0] ?? "");
  return byLabel === 0 ? a.key.localeCompare(b.key) : byLabel;
}

/**
 * Three numbers per cell, which is all a dot needs.
 *
 * The distinction matters more than it looks. `GlobeCell` carries every
 * photograph's id and title, and at three hundred photographs that is about
 * 33 KB of JSON — but it never crosses the wire, because the list is
 * rendered on the server and arrives as HTML. The canvas is a client
 * component, so whatever it is handed *is* serialised into the payload, and
 * handing it the full cells would put those 33 KB into every visit for the
 * sake of three numbers a dot.
 *
 * About 4 KB at three hundred photographs, and it grows with places rather
 * than with photographs.
 */
export interface GlobePoint {
  lat: number;
  lng: number;
  count: number;
}

export function toGlobePoints(cells: readonly GlobeCell[]): GlobePoint[] {
  return cells.map((cell) => ({
    lat: cell.lat,
    lng: cell.lng,
    count: cell.photos.length,
  }));
}

/**
 * What to call a cell in a sentence.
 *
 * "Near", always, and never the bare place name. The point is the centre of
 * a square about a hundred kilometres across, so a heading reading "Nusa
 * Penida" would claim a precision the data does not have — and the whole
 * argument for publishing these at all is that they are too blunt to find
 * anything with. Two names are joined; beyond that the count carries it.
 *
 * "Somewhere unnamed" when nobody in the cell wrote a location: a
 * photographer may mark a spot without naming it, and the dot still belongs
 * on the map.
 */
export function labelFor(cell: GlobeCell): string {
  const [first, second] = cell.labels;
  if (first === undefined) {
    return "Somewhere unnamed";
  }
  if (second === undefined || cell.labels.length > 2) {
    return `Near ${first}`;
  }
  return `Near ${joinPlaces(first, second)}`;
}

/**
 * Two place names, without saying the shared part twice.
 *
 * Photographers write "Bali, Indonesia" and "Uluwatu, Bali, Indonesia", and
 * naively joining them produced the first heading on `/globe`: *"Near Bali,
 * Indonesia and Uluwatu, Bali, Indonesia"* — a line that reads as a data bug
 * on the page whose whole subject is places, and wraps to two lines on a
 * phone.
 *
 * The rule is only about the tail. Place names in this data run
 * narrowest-first, so a shared suffix is the country or the region both
 * photographs sit in — it is said once, at the end, where it belongs. Nothing
 * is dropped from the middle, and two names sharing nothing are joined
 * exactly as before.
 */
function joinPlaces(first: string, second: string): string {
  const a = first.split(",").map((part) => part.trim());
  const b = second.split(",").map((part) => part.trim());

  let shared = 0;
  while (
    shared < a.length - 1 &&
    shared < b.length - 1 &&
    a.at(-1 - shared) === b.at(-1 - shared)
  ) {
    shared += 1;
  }

  if (shared === 0) {
    return `${first} and ${second}`;
  }

  const tail = a.slice(a.length - shared);
  const headA = a.slice(0, a.length - shared);
  let headB = b.slice(0, b.length - shared);

  /*
   * One name may sit inside the other. "Bali, Indonesia" and "Uluwatu, Bali,
   * Indonesia" share the country, and once that is pulled out the second is
   * still "Uluwatu, Bali" against a first of "Bali" — so the shorter name
   * appears twice in one heading, which is the thing that looked like a bug.
   * Where the remainder ends with the whole of the other, say it once.
   */
  if (
    headA.length > 0 &&
    headB.length > headA.length &&
    headB.slice(headB.length - headA.length).join(",") === headA.join(",")
  ) {
    headB = headB.slice(0, headB.length - headA.length);
  }

  return `${headA.join(", ")} and ${[...headB, ...tail].join(", ")}`;
}
