/**
 * Marks the photographs that predate the map picker.
 *
 * Every published photograph already names a place publicly in its
 * `location` column, and several name a specific one in the title — Golden
 * Gate, Sugarloaf, Uluwatu, Cabo de São Vicente. This writes a point for
 * each so `/globe` and the per-photograph dot have something to draw, rather
 * than waiting for fourteen rows to be edited by hand.
 *
 * **These are places, not the spot each photographer stood on.** Where the
 * title names a landmark the point is that landmark, which is right to
 * within a few hundred metres; where it names only a town or an island, the
 * point is the town or the island. A photographer who wants theirs exact
 * should open the row and move it — that is what the picker is for, and it
 * overwrites this.
 *
 * The coarse pair is never typed here: it comes from `coarsen()`, exactly as
 * it does on a real save, so a backfilled row is indistinguishable from an
 * edited one.
 *
 * Safe to re-run, and it rewrites rather than skips — the table below is the
 * source of truth for these fourteen, so correcting an entry and running it
 * again is the way to fix one.
 */
import process from "node:process";
import { sql } from "../src/lib/database.ts";
import { coarsen } from "../src/lib/photos/coarsen.ts";

const PINS: Record<string, { at: [number, number]; note: string }> = {
  "1": { at: [-8.8206, 115.0889], note: "Bali — Uluwatu coast" },
  "2": { at: [37.7217, -8.7869], note: "Vila Nova de Milfontes — river mouth" },
  "3": { at: [-8.5069, 115.2625], note: "Bali — Ubud" },
  "4": { at: [-7.9256, 112.9457], note: "Bromo — Penanjakan viewpoint" },
  "5": { at: [48.6853, 9.0114], note: "Böblingen" },
  "6": { at: [-8.8291, 115.0849], note: "Uluwatu Temple cliffs" },
  "7": { at: [37.0233, -8.9977], note: "Sagres — Cabo de São Vicente" },
  "8": { at: [32.7157, -117.1611], note: "San Diego" },
  "9": { at: [9.512, 100.0136], note: "Koh Samui" },
  "10": { at: [-22.9492, -43.1545], note: "Rio — Sugarloaf Mountain" },
  "11": {
    at: [37.8199, -122.4783],
    note: "San Francisco — Golden Gate Bridge",
  },
  "12": { at: [38.7331, -109.5925], note: "Arches National Park" },
  "13": { at: [48.6853, 9.0114], note: "Böblingen" },
  "14": { at: [9.75, 100.03], note: "Koh Phangan" },
};

const rows = await sql`
  SELECT id, title, location FROM photos WHERE published_at IS NOT NULL
  ORDER BY id;
`;

let marked = 0;
for (const row of rows) {
  const id = row["id"] as string;
  const pin = PINS[id];
  if (pin === undefined) {
    console.log(`skip ${id} — no coordinate listed for "${row["location"]}"`);
  } else {
    const [lat, lng] = pin.at;
    const coarse = coarsen(lat, lng);
    await sql`
      UPDATE photos
         SET precise_lat = ${lat}, precise_lng = ${lng},
             coarse_lat = ${coarse.lat}, coarse_lng = ${coarse.lng}
       WHERE id = ${id};
    `;
    marked += 1;
    console.log(
      `${id.padStart(2)}  ${String(row["title"]).padEnd(20)}` +
        ` ${lat}, ${lng}  ->  ${coarse.lat}, ${coarse.lng}   (${pin.note})`,
    );
  }
}

console.log(`\nMarked ${marked} of ${rows.length} published photographs.`);
process.exit(0);
