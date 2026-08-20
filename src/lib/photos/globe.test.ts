import { describe, expect, it } from "vitest";
import {
  type GlobeCell,
  groupIntoCells,
  groupIntoPlaces,
  labelFor,
  toGlobePoints,
} from "./globe";
import type { GlobePointRow } from "./types";

/*
 * No `as GlobePointRow` cast, following `filter.test.ts`: a fixture built
 * from a partial and a full literal is one that fails loudly when the row
 * type grows a field, rather than quietly passing `undefined` through the
 * function under test.
 */
function row(over: Partial<GlobePointRow>): GlobePointRow {
  return {
    id: "p1",
    title: "Tide Lines",
    location: "Nusa Penida",
    coarse_lat: -8.7028,
    coarse_lng: 115.1637,
    ...over,
  };
}

describe("grouping published points into cells", () => {
  /*
   * The behaviour the whole page rests on. `coarsen` returns the centre of a
   * cell, so two photographs from one valley carry byte-identical numbers —
   * which is both the payload win and the right picture: a globe should not
   * trace somebody's walk.
   */
  it("collapses identical points onto one cell", () => {
    const cells = groupIntoCells([
      row({ id: "a" }),
      row({ id: "b" }),
      row({ id: "c" }),
    ]);
    expect(cells).toHaveLength(1);
    expect(cells[0]?.photos.map((photo) => photo.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps genuinely different places apart", () => {
    const cells = groupIntoCells([
      row({ id: "a" }),
      row({ id: "b", coarse_lat: 48.7891, coarse_lng: 9.4382 }),
    ]);
    expect(cells).toHaveLength(2);
  });

  it("carries the cell's own coordinates through unchanged", () => {
    const [cell] = groupIntoCells([row({})]);
    expect(cell?.lat).toBe(-8.7028);
    expect(cell?.lng).toBe(115.1637);
  });

  it("is empty for an empty gallery rather than throwing", () => {
    expect(groupIntoCells([])).toEqual([]);
  });
});

describe("the order the page is read in", () => {
  it("puts the busiest cell first", () => {
    const cells = groupIntoCells([
      row({ id: "a", coarse_lat: 48.7891, coarse_lng: 9.4382, location: "B" }),
      row({ id: "b" }),
      row({ id: "c" }),
    ]);
    expect(cells[0]?.photos).toHaveLength(2);
    expect(cells[1]?.photos).toHaveLength(1);
  });

  /*
   * The page is cached for an hour, so a tie left to whatever order the
   * query returned would reshuffle the list under a reader on every
   * revalidation, for no reason they could see. The comparison has to be
   * total.
   */
  it("breaks ties the same way every time, whatever order the rows arrive", () => {
    const rows = [
      row({ id: "a", location: "Sagres", coarse_lat: 37.1, coarse_lng: -9.5 }),
      row({ id: "b", location: "Bromo", coarse_lat: -7.8, coarse_lng: 112.6 }),
      row({ id: "c", location: "Arches", coarse_lat: 38.9, coarse_lng: -109 }),
    ];
    const forwards = groupIntoCells(rows).map((cell) => cell.key);
    const backwards = groupIntoCells([...rows].reverse()).map(
      (cell) => cell.key,
    );
    expect(forwards).toEqual(backwards);
    // And alphabetical by label, since every count here is one.
    expect(groupIntoCells(rows).map((cell) => cell.labels[0])).toEqual([
      "Arches",
      "Bromo",
      "Sagres",
    ]);
  });
});

describe("what a cell is called", () => {
  it("keeps each distinct name once, in the order it was first written", () => {
    const [cell] = groupIntoCells([
      row({ id: "a", location: "Uluwatu" }),
      row({ id: "b", location: "Bali" }),
      row({ id: "c", location: "Uluwatu" }),
      row({ id: "d", location: "Bali" }),
    ]);
    expect(cell?.labels).toEqual(["Uluwatu", "Bali"]);
  });

  it("ignores blank and whitespace-only locations", () => {
    const [cell] = groupIntoCells([
      row({ id: "a", location: null }),
      row({ id: "b", location: "   " }),
      row({ id: "c", location: "Bali" }),
    ]);
    expect(cell?.labels).toEqual(["Bali"]);
  });

  /*
   * "Near", always. The point is the centre of a square roughly a hundred
   * kilometres across, so a heading reading "Nusa Penida" would claim a
   * precision the data does not have — and being too blunt to find anything
   * with is the entire argument for publishing these.
   */
  it("never states a place as though the dot were on it", () => {
    const [cell] = groupIntoCells([row({})]);
    expect(labelFor(cell as GlobeCell)).toBe("Near Nusa Penida");
  });

  it("joins exactly two names and lets the count carry more", () => {
    const two = groupIntoCells([
      row({ id: "a", location: "Uluwatu" }),
      row({ id: "b", location: "Bali" }),
    ]);
    expect(labelFor(two[0] as GlobeCell)).toBe("Near Uluwatu and Bali");
  });

  it("says a shared country once", () => {
    /*
     * The first heading on `/globe` used to read "Near Bali, Indonesia and
     * Uluwatu, Bali, Indonesia" — a line that reads as a data bug on the page
     * whose whole subject is places, and wraps to two lines on a phone.
     * Photographers write the names they write; the joining is ours.
     */
    const cell = {
      key: "k",
      lat: 0,
      lng: 0,
      labels: ["Bali, Indonesia", "Uluwatu, Bali, Indonesia"],
      photos: [],
    };
    expect(labelFor(cell as GlobeCell)).toBe(
      "Near Bali and Uluwatu, Indonesia",
    );
  });

  it("keeps two unrelated places whole", () => {
    const cell = {
      key: "k",
      lat: 0,
      lng: 0,
      labels: ["Zurich, Switzerland", "Lisbon, Portugal"],
      photos: [],
    };
    expect(labelFor(cell as GlobeCell)).toBe(
      "Near Zurich, Switzerland and Lisbon, Portugal",
    );

    const three = groupIntoCells([
      row({ id: "a", location: "Uluwatu" }),
      row({ id: "b", location: "Bali" }),
      row({ id: "c", location: "Nusa Penida" }),
    ]);
    expect(labelFor(three[0] as GlobeCell)).toBe("Near Uluwatu");
  });

  it("still names a cell nobody wrote a location for", () => {
    const [cell] = groupIntoCells([row({ location: null })]);
    expect(labelFor(cell as GlobeCell)).toBe("Somewhere unnamed");
  });
});

describe("gathering cells into the places a person would name", () => {
  /*
   * Every case below is a real pair from the published set, with its measured
   * distance in the name. That is deliberate: this rule exists because of
   * what the data actually looks like, and a fixture invented to suit the
   * rule would not have caught the border case that shaped it.
   */
  const cells = (entries: readonly [string, number, number][]): GlobeCell[] =>
    entries.flatMap(([location, lat, lng], index) =>
      groupIntoCells([
        row({ coarse_lat: lat, coarse_lng: lng, id: `p${index}`, location }),
      ]),
    );

  it("gathers two cells that share a region and sit 40 km apart", () => {
    // The bug this rule was written for: `/globe` showed "Near Bali,
    // Indonesia" twice, because a kilometre-wide cell splits what a
    // hundred-kilometre one used to swallow.
    const places = groupIntoPlaces(
      cells([
        ["Bali, Indonesia", -8.7028, 115.1637],
        ["Bali, Indonesia", -8.3405, 115.092],
      ]),
    );
    expect(places).toHaveLength(1);
    expect(labelFor(places[0] ?? { labels: [] })).toBe("Near Bali, Indonesia");
  });

  it("gathers a narrower name into the wider one it sits inside", () => {
    const places = groupIntoPlaces(
      cells([
        ["Bali, Indonesia", -8.7028, 115.1637],
        ["Uluwatu, Bali, Indonesia", -8.8291, 115.0849],
      ]),
    );
    expect(places).toHaveLength(1);
    expect(labelFor(places[0] ?? { labels: [] })).toBe(
      "Near Bali and Uluwatu, Indonesia",
    );
  });

  /*
   * The case that rules out distance on its own, and the reason this
   * predicate looks at names at all.
   *
   * Glaciar Perito Moreno and Torres del Paine National Park are 53 km
   * apart — nearer than the two Bali cells above — and in different
   * countries. Any radius wide enough to gather Bali gathers these too, so
   * without the shared-name half of the rule `/globe` would grow a heading
   * that merges Argentina and Chile: a worse bug than the duplicate it was
   * introduced to fix.
   */
  it("keeps two nearby places in different countries apart", () => {
    const places = groupIntoPlaces(
      cells([
        ["Glaciar Perito Moreno, Argentina", -50.4967, -73.1377],
        ["Torres del Paine National Park, Chile", -50.9423, -73.4068],
      ]),
    );
    expect(places).toHaveLength(2);
  });

  it("keeps two cells in one country apart when they are far apart", () => {
    const places = groupIntoPlaces(
      cells([
        ["Sagres, Portugal", 37.0, -8.94],
        ["Vila Nova de Milfontes, Portugal", 37.72, -8.78],
      ]),
    );
    expect(places).toHaveLength(2);
  });

  /*
   * Transitivity, which the Bali cluster needs and no single pair provides:
   * the two "Bali, Indonesia" cells are 40 km apart and Uluwatu sits 1 km
   * from one of them, so all three arrive under one heading through a chain.
   *
   * Both orders, because the second one used to fail. Reversed, the cells at
   * the ends of the chain arrive first — 55 km apart, and so two groups by
   * the time the cell between them turns up. Joining that cell to whichever
   * group matched first left the other standing, and the duplicate "Near
   * Bali, Indonesia" heading came back. Which order the cells arrive in is
   * not the caller's to promise: `/globe` sorts them by how busy they are.
   */
  it("gathers a chain whichever end of it arrives first", () => {
    const chain: [string, number, number][] = [
      ["Bali, Indonesia", -8.7028, 115.1637],
      ["Uluwatu, Bali, Indonesia", -8.8291, 115.0849],
      ["Bali, Indonesia", -8.3405, 115.092],
    ];
    for (const order of [chain, [...chain].reverse()]) {
      const places = groupIntoPlaces(cells(order));
      expect(places).toHaveLength(1);
      expect(places[0]?.photos).toHaveLength(3);
    }
  });

  /*
   * A photographer may mark a spot without naming it. Folding that into a
   * neighbour would file the photograph under a place name its photographer
   * chose not to give it.
   */
  it("never gathers an unnamed cell into a named one", () => {
    const places = groupIntoPlaces(
      cells([
        ["Bali, Indonesia", -8.7028, 115.1637],
        ["", -8.7031, 115.164],
      ]),
    );
    expect(places).toHaveLength(2);
  });

  it("keeps every photograph exactly once", () => {
    const built = cells([
      ["Bali, Indonesia", -8.7028, 115.1637],
      ["Uluwatu, Bali, Indonesia", -8.8291, 115.0849],
      ["Taipei, Taiwan", 25.033, 121.5654],
      ["Glaciar Perito Moreno, Argentina", -50.4967, -73.1377],
    ]);
    const total = groupIntoPlaces(built).reduce(
      (sum, place) => sum + place.photos.length,
      0,
    );
    expect(total).toBe(built.length);
  });
});

describe("the payload stays small as the gallery grows", () => {
  function threeHundred(): GlobePointRow[] {
    const rows: GlobePointRow[] = [];
    for (let index = 0; index < 300; index += 1) {
      const cell = index % 120;
      rows.push(
        row({
          id: `photo-${index}`,
          title: `A photograph number ${index}`,
          location: `Place ${cell}`,
          coarse_lat: -80 + cell * 1.3,
          coarse_lng: -180 + cell * 2.9,
        }),
      );
    }
    return rows;
  }

  it("collapses three hundred photographs into a hundred and twenty places", () => {
    expect(groupIntoCells(threeHundred())).toHaveLength(120);
  });

  /*
   * The number that actually reaches a browser, and the reason `GlobePoint`
   * exists as a separate shape.
   *
   * The grouped list is rendered on the server and arrives as HTML, so the
   * ids and titles in `GlobeCell` never cross the wire. The canvas is a
   * client component, so whatever it is handed is serialised into the
   * payload — and handing it the full cells would ship about 33 KB for the
   * sake of three numbers a dot.
   *
   * This is the same trap `docs/next-version.md` §2 records for the gallery,
   * where the cost is 5.4 KB per photograph. Here the cost is per *place*,
   * which is what makes a globe affordable at all.
   */
  it("sends the canvas three numbers a place, not a photograph list", () => {
    const points = toGlobePoints(groupIntoCells(threeHundred()));
    expect(points).toHaveLength(120);
    expect(JSON.stringify(points).length).toBeLessThan(6000);
    expect(JSON.stringify(points)).not.toContain("photo-");
    expect(JSON.stringify(points)).not.toContain("Place");
  });

  it("counts every photograph exactly once across the cells", () => {
    const points = toGlobePoints(groupIntoCells(threeHundred()));
    const total = points.reduce((sum, point) => sum + point.count, 0);
    expect(total).toBe(300);
  });
});
