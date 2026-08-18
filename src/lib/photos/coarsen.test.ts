import { describe, expect, it } from "vitest";
import { CELL_KM, coarsen, MAX_ERROR_KM } from "./coarsen";

/**
 * The privacy claim, as arithmetic.
 *
 * The picker tells a photographer that the public point is "the middle of a
 * square about a hundred kilometres across". That is a promise, and the only
 * thing that makes it one is this file: everything below measures real
 * ground distance with a haversine, rather than checking that the code does
 * what the code does.
 *
 * Deliberately black-box. Nothing here reimplements the grid — each test
 * finds cell edges by asking `coarsen` where they are, so the properties
 * survive a rewrite of the arithmetic and would fail a rewrite that quietly
 * disclosed more.
 */

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance, so "100 km" means kilometres on the ground. */
function haversineKm(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
): number {
  const dLat = toRadians(latB - latA);
  const dLng = toRadians(lngB - lngA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(latA)) *
      Math.cos(toRadians(latB)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Binary search for the edge of the cell a point sits in, by asking
 * `coarsen` which side of the boundary each probe falls on.
 *
 * `inside` is a point known to be in the cell; `outside` is one known not to
 * be. Returns a longitude (or latitude) within a metre of the boundary.
 */
function edge(
  inside: number,
  outside: number,
  sameCell: (value: number) => boolean,
): number {
  let near = inside;
  let far = outside;
  for (let step = 0; step < 60; step += 1) {
    const middle = (near + far) / 2;
    if (sameCell(middle)) {
      near = middle;
    } else {
      far = middle;
    }
  }
  return near;
}

/*
 * Both searches stay inside the real domain. Probing beyond it would measure
 * the clamp rather than the cell — `coarsen(91, …)` answers for the top row,
 * which would report a polar cell as half again as tall as it is, for
 * latitudes that do not exist.
 */

/** How wide the cell containing (lat, lng) is, measured at that latitude. */
function cellWidthKm(lat: number, lng: number): number {
  const cell = coarsen(lat, lng).lng;
  const same = (value: number): boolean => coarsen(lat, value).lng === cell;
  const west = same(-180) ? -180 : edge(lng, -180, same);
  const east = same(180) ? 180 : edge(lng, 180, same);
  return haversineKm(lat, west, lat, east);
}

/** How tall the cell containing (lat, lng) is. */
function cellHeightKm(lat: number, lng: number): number {
  const cell = coarsen(lat, lng).lat;
  const same = (value: number): boolean => coarsen(value, lng).lat === cell;
  const south = same(-90) ? -90 : edge(lat, -90, same);
  const north = same(90) ? 90 : edge(lat, 90, same);
  return haversineKm(south, lng, north, lng);
}

function errorKm(lat: number, lng: number): number {
  const point = coarsen(lat, lng);
  return haversineKm(lat, lng, point.lat, point.lng);
}

describe("CELL_KM", () => {
  /*
   * Not a style preference. Every published `coarse_lat`/`coarse_lng` was
   * computed with this value, so changing it moves every dot on the globe
   * and leaves the stored points disagreeing with the ones a fresh publish
   * would produce. That is a migration, not an edit — this test is here so
   * nobody discovers that afterwards.
   */
  it("is frozen at 100 km, because changing it needs a backfill", () => {
    expect(CELL_KM).toBe(100);
  });

  it("states an error bound that matches the cell diagonal", () => {
    // Half-diagonal of a CELL_KM square, which is the worst a centre can be.
    expect(MAX_ERROR_KM).toBeGreaterThanOrEqual(
      Math.hypot(CELL_KM / 2, CELL_KM / 2),
    );
  });
});

describe("the cell is never larger than it claims", () => {
  const latitudes: number[] = [];
  for (let lat = -85; lat <= 85; lat += 5) {
    latitudes.push(lat);
  }

  it.each(latitudes)("is at most 100 km wide at %d°", (lat: number) => {
    for (const lng of [-179, -90, -0.5, 17, 120, 179]) {
      /*
       * Half a metre of slack for the binary search, not for the maths. A
       * degree-rounding implementation would fail this by a hundredfold at
       * the equator, not by a metre.
       */
      expect(cellWidthKm(lat, lng)).toBeLessThanOrEqual(CELL_KM + 0.001);
    }
  });

  it.each(latitudes)("is at most 100 km tall at %d°", (lat: number) => {
    expect(cellHeightKm(lat, 8.5)).toBeLessThanOrEqual(CELL_KM + 0.001);
  });

  /*
   * The pole is where naive implementations go wrong in both directions:
   * degree-rounding discloses a 600-metre cell, and a grid that takes its
   * column count from the row *centre* wraps the whole polar row into one
   * cell hundreds of kilometres wide.
   */
  it("holds at the poles too", () => {
    for (const lat of [89.9, -89.9, 89.99, -89.99]) {
      expect(cellWidthKm(lat, 30)).toBeLessThanOrEqual(CELL_KM + 0.001);
      expect(cellHeightKm(lat, 30)).toBeLessThanOrEqual(CELL_KM + 0.001);
    }
  });
});

describe("no point is published further than MAX_ERROR_KM from the truth", () => {
  it.each([0, 45, 80, -45, -80])(
    "holds across a full sweep of longitude at %d°",
    (lat: number) => {
      for (let lng = -180; lng <= 180; lng += 0.37) {
        expect(errorKm(lat, lng)).toBeLessThanOrEqual(MAX_ERROR_KM);
      }
    },
  );

  it("holds at both poles", () => {
    for (const lat of [90, -90, 89.9, -89.9]) {
      for (const lng of [-180, -90, 0, 90, 180]) {
        expect(errorKm(lat, lng)).toBeLessThanOrEqual(MAX_ERROR_KM);
      }
    }
  });

  it("holds across a dense sweep of latitude", () => {
    for (let lat = -90; lat <= 90; lat += 0.31) {
      expect(errorKm(lat, 8.5417)).toBeLessThanOrEqual(MAX_ERROR_KM);
      expect(errorKm(lat, -122.4)).toBeLessThanOrEqual(MAX_ERROR_KM);
    }
  });
});

describe("the output is a coordinate", () => {
  it("stays in range at every corner of the domain", () => {
    for (const lat of [-90, -89.999, 0, 89.999, 90]) {
      for (const lng of [-180, -179.999, 0, 179.999, 180]) {
        const point = coarsen(lat, lng);
        expect(point.lat).toBeGreaterThanOrEqual(-90);
        expect(point.lat).toBeLessThanOrEqual(90);
        expect(point.lng).toBeGreaterThanOrEqual(-180);
        expect(point.lng).toBeLessThanOrEqual(180);
      }
    }
  });

  /*
   * The antimeridian is the one place an off-by-one shows up as a point in
   * the wrong hemisphere rather than as a slightly wrong point. 180 is the
   * east edge of the last column, not a column of its own.
   */
  it("puts both ends of the antimeridian in a real cell", () => {
    expect(coarsen(0, 180).lng).toBeLessThan(180);
    expect(coarsen(0, -180).lng).toBeGreaterThan(-180);
    expect(errorKm(0, 180)).toBeLessThanOrEqual(MAX_ERROR_KM);
    expect(errorKm(0, -180)).toBeLessThanOrEqual(MAX_ERROR_KM);
  });

  /*
   * Float artefacts are a fingerprint: `47.400000000000006` says more about
   * the input than `47.4` does, and a dot on a globe needs neither.
   */
  it("rounds to four places, so the output carries no float residue", () => {
    for (let lng = -180; lng < 180; lng += 1.13) {
      const { lat, lng: coarseLng } = coarsen(47.3769, lng);
      expect(lat).toBe(Math.round(lat * 10_000) / 10_000);
      expect(coarseLng).toBe(Math.round(coarseLng * 10_000) / 10_000);
    }
  });
});

describe("the same cell always gives the same point", () => {
  it("is deterministic", () => {
    expect(coarsen(47.3769, 8.5417)).toEqual(coarsen(47.3769, 8.5417));
  });

  /*
   * The behaviour that makes a globe honest as well as private: two
   * photographs from one valley must land on one dot, so the map cannot be
   * read as a trace of where somebody walked.
   */
  it("collapses nearby points onto one", () => {
    const a = coarsen(47.3769, 8.5417);
    const b = coarsen(47.3801, 8.5502);
    expect(b).toEqual(a);
  });

  it("still separates places that are genuinely far apart", () => {
    expect(coarsen(47.3769, 8.5417)).not.toEqual(coarsen(-8.7, 115.5));
  });

  /*
   * The output depends on the cell and on nothing else about the input, so
   * it cannot carry any information beyond which cell was hit.
   */
  it("gives one of a small, fixed set of answers per row", () => {
    const points = new Set<string>();
    for (let lng = -180; lng < 180; lng += 0.05) {
      const { lng: coarseLng } = coarsen(47.3769, lng);
      points.add(String(coarseLng));
    }
    // 360° of a row 100 km wide at ~47° latitude: about 270 columns.
    expect(points.size).toBeLessThan(400);
    expect(points.size).toBeGreaterThan(100);
  });
});
