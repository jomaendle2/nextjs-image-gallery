import type { GlobePointRow } from "./types";

/**
 * Turning a list of published points into the handful of places they are.
 *
 * **Clustering is the payload design, not a visual nicety.** `coarsen`
 * collapses everything inside one cell onto one identical point, so rows
 * arriving here from the same spot are duplicates and grouping on the way
 * out is what keeps the payload proportional to places rather than to
 * photographs.
 *
 * It used to do far more of the work than it does now. At a hundred
 * kilometres a cell swallowed a whole region, and three hundred photographs
 * collapsed to perhaps a hundred and twenty points; at a kilometre it
 * swallows a viewpoint, so a day spent walking around one bay arrives as
 * several points rather than one. The grouping still earns its place — a
 * gallery accumulates repeat visits to the same few spots — but the ratio it
 * buys is closer to two-to-one than three-to-one, and the honest way to read
 * the table below is as a floor rather than a forecast.
 *
 * | photographs | cells | JSON |
 * | ---: | ---: | ---: |
 * | 14 | ≤ 14 | ~1.5 KB |
 * | 300 | ~200 | ~20 KB |
 * | 1000 | ~650 | ~65 KB |
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
 * How near two cells have to be before they are spoken of as one place, and
 * the other half of the rule.
 *
 * **This is not `CELL_KM`, and the difference is the whole point of the
 * function below.** A coarsening cell answers "what is safe to publish"; a
 * grouping radius answers "what would a person call one place". Those were
 * the same number for as long as `CELL_KM` was 100, purely by accident — a
 * hundred-kilometre cell happened to swallow a region, so grouping came free
 * and nobody had to name it.
 *
 * Shrinking the cell to a kilometre for accuracy separated them, and the
 * separation arrived as a bug: `/globe` grew two headings both reading "Near
 * Bali, Indonesia", because two cells forty kilometres apart are two cells
 * and one place. The fix is not a larger cell — that would hand back the
 * accuracy the small one bought — but a second constant, doing the job the
 * first one was never actually for.
 *
 * **Distance alone is not enough, and the data says so.** Measured over the
 * published set, Glaciar Perito Moreno and Torres del Paine National Park sit
 * 53 km apart across the Argentina–Chile border. Any radius wide enough to
 * gather the Bali cells is wide enough to gather those two, and a heading
 * merging two countries is a worse bug than the one being fixed.
 *
 * So a pair must be near *and* share a trailing part of their names —
 * "California", "Thailand", "Bali, Indonesia". Place names in this data run
 * narrowest-first, so a shared suffix is the region or country both sit in,
 * which is precisely the thing that makes "one place" true. Names sharing
 * nothing stay apart however close they are.
 *
 * 50 km because that is what the measured set asks for: it gathers Bali with
 * Uluwatu at 1 km and with itself at 40, Koh Phangan with Koh Samui at 27,
 * Half Moon Bay with San Francisco at 39 — and stops short of the border pair
 * at 53. It is a judgement about headings, not about privacy, and nothing
 * downstream of it can widen a published dot.
 */
const GROUP_KM = 50;

/** Mean radius, which is all a proximity test needs. */
const EARTH_KM = 6371;

function kmBetween(a: GlobeCell, b: GlobeCell): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_KM * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The trailing parts two names have in common: "Bali, Indonesia" and none. */
function sharedTail(first: string, second: string): number {
  const a = first.split(",").map((part) => part.trim().toLowerCase());
  const b = second.split(",").map((part) => part.trim().toLowerCase());
  let shared = 0;
  while (
    shared < a.length &&
    shared < b.length &&
    a.at(-1 - shared) === b.at(-1 - shared)
  ) {
    shared += 1;
  }
  return shared;
}

/**
 * Whether two cells belong under one heading: near enough, and named as part
 * of the same larger place by whoever wrote the labels.
 *
 * An unnamed cell joins nothing. It has no region to share, and quietly
 * folding "Somewhere unnamed" into a neighbour would put a photograph under a
 * place name its photographer chose not to give it.
 */
function samePlace(a: GlobeCell, b: GlobeCell): boolean {
  if (a.labels.length === 0 || b.labels.length === 0) {
    return false;
  }
  if (kmBetween(a, b) > GROUP_KM) {
    return false;
  }
  return a.labels.some((one) =>
    b.labels.some((other) => sharedTail(one, other) > 0),
  );
}

/**
 * One or more cells that a reader would call a single place.
 *
 * **Cells are what the globe draws; places are what the page lists.** Keeping
 * them as separate types rather than merging the cells outright is what lets
 * both be right at once: the canvas still gets one dot per cell, each sitting
 * within a kilometre of where a photograph was actually taken and worth
 * magnifying to 16x, while the list beside it says "Near Bali and Uluwatu,
 * Indonesia" once. Merging the cells instead would move every dot to a group
 * centroid — up to twenty kilometres out for the Bali cluster, which is
 * eleven pixels at the top of the zoom range, and exactly the drift the last
 * three commits went to some trouble to remove.
 */
export interface GlobePlaceGroup {
  key: string;
  labels: string[];
  photos: { id: string; title: string }[];
}

/**
 * Gathers cells into the places a person would name, busiest first.
 *
 * Transitive by construction, which is what the Bali case needs: the two
 * cells labelled "Bali, Indonesia" are 40 km apart and "Uluwatu, Bali,
 * Indonesia" sits 1 km from one of them, so all three arrive under one
 * heading through a chain rather than through any single pair being close.
 *
 * A linear scan over cells, quadratic in the worst case. That is the right
 * shape here — this runs once per revalidation over a list measured in
 * hundreds, and a spatial index would be more code than the thing it indexes.
 * The threshold to revisit it is the same one `/api/globe` records for
 * splitting its payload.
 */
export function groupIntoPlaces(
  cells: readonly GlobeCell[],
): GlobePlaceGroup[] {
  const groups: GlobeCell[][] = [];

  for (const cell of cells) {
    /*
     * Every group it touches, not the first — that is what makes the chain
     * transitive rather than merely usually transitive. Uluwatu and the
     * northern Bali cell are 55 km apart, so they are two groups until the
     * cell between them arrives; joining that cell to whichever group matched
     * first leaves the other standing, and the page grows back the duplicate
     * heading. A cell belonging to two groups is the evidence that they were
     * one group all along, and the only moment that evidence exists is now.
     */
    const matched = groups.filter((group) =>
      group.some((member) => samePlace(member, cell)),
    );
    const [into, ...rest] = matched;

    if (into === undefined) {
      groups.push([cell]);
    } else {
      into.push(cell);
      for (const other of rest) {
        into.push(...other);
        groups.splice(groups.indexOf(other), 1);
      }
    }
  }

  return groups
    .map((group) => {
      const labels: string[] = [];
      for (const cell of group) {
        for (const label of cell.labels) {
          if (!labels.includes(label)) {
            labels.push(label);
          }
        }
      }
      return {
        // The busiest cell's key, so a group keeps a stable identity as long
        // as its cells do — and one that is already a valid cell key. Cells
        // arrive busiest first and a merge appends, so the head of a group is
        // still the first of its cells to have been seen.
        key: (group[0] ?? { key: "" }).key,
        labels,
        photos: group.flatMap((cell) => cell.photos),
      };
    })
    .sort(comparePlaces);
}

function comparePlaces(a: GlobePlaceGroup, b: GlobePlaceGroup): number {
  if (a.photos.length !== b.photos.length) {
    return b.photos.length - a.photos.length;
  }
  const byLabel = (a.labels[0] ?? "").localeCompare(b.labels[0] ?? "");
  return byLabel === 0 ? a.key.localeCompare(b.key) : byLabel;
}

/**
 * What to call a cell in a sentence.
 *
 * "Near", always, and never the bare place name. The point is the centre of
 * a square about a kilometre across, so a heading reading "Nusa Penida"
 * would claim a precision the data does not have.
 *
 * The word stays even though the cell shrank by two orders of magnitude, and
 * it is worth saying why rather than treating it as leftover caution: the
 * argument for publishing these at all is that they are blunt on purpose,
 * and a kilometre is still a beach rather than a spot on it. Dropping "Near"
 * would turn a deliberately imprecise point into a claim about an address,
 * which is the one thing this data must never be read as.
 *
 * Two names are joined; beyond that the count carries it.
 *
 * "Somewhere unnamed" when nobody in the cell wrote a location: a
 * photographer may mark a spot without naming it, and the dot still belongs
 * on the map.
 */
export function labelFor(cell: { labels: readonly string[] }): string {
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
