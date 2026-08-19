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
import { consumeApplyFlag, databaseHost } from "./guard.mts";

/*
 * The plan is printed before anything is written, so `--apply` is a decision
 * taken with the coordinates on screen rather than ahead of them.
 * `confirmDestructive` refuses too early for that — it exits before the rows
 * are read — so this borrows its flag and prints its own banner.
 */
const apply = consumeApplyFlag();
console.log(`\n  Target database: ${databaseHost()}`);
console.log(apply ? "  Mode: WRITING\n" : "  Mode: dry run (pass --apply)\n");

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

/**
 * Places named publicly by a photographer, drawn as a dot and nothing more.
 *
 * The difference from `PINS` above is the whole reason this is a second
 * table rather than four more rows in the first, and it is a difference
 * about consent rather than about data.
 *
 * `PINS` writes `precise_lat`/`precise_lng` as well — the member-only
 * column the form labels "Where you stood". That was defensible for the
 * fourteen photographs above because they are the operator's own, and
 * putting a landmark centre in your own row is a note to yourself.
 *
 * These four are somebody else's. Writing a centroid into "where you stood"
 * on another photographer's work would claim, to every paying member, a spot
 * they never marked — and it would flip `has_member_details`, so the
 * photograph would start advertising member content that consists entirely
 * of our guess. The coarse dot carries no such claim: `/globe` describes it
 * as roughly where somebody was, it is a cell about a kilometre across, and
 * it is derived here from a place name the photographer chose to publish. That is a restatement of what they already said, at lower
 * precision, which is the one direction this is safe in.
 *
 * If one of them wants an exact point, the picker is one click and it
 * overwrites this.
 */
const PLACES: Record<string, { at: [number, number]; note: string }> = {
  qIDJrB27r1Qf: { at: [-25.6866, -54.4445], note: "Iguazu Falls" },
  "-maJXk5ZP3nQ": { at: [-50.4967, -73.1377], note: "Perito Moreno glacier" },
  aAewyCdbMOf6: { at: [-50.9423, -73.4068], note: "Torres del Paine" },
  G6n1cUoBwg2b: { at: [-13.1631, -72.545], note: "Machu Picchu" },
};

const rows = await sql`
  SELECT id, title, location FROM photos WHERE published_at IS NOT NULL
  ORDER BY id;
`;

let marked = 0;
for (const row of rows) {
  const id = row["id"] as string;
  const pin = PINS[id];
  const place = PLACES[id];
  const entry = pin ?? place;

  if (entry === undefined) {
    console.log(`skip ${id} — no coordinate listed for "${row["location"]}"`);
  } else {
    await mark(id, entry, pin !== undefined, String(row["title"]));
    marked += 1;
  }
}

/** One photograph: the dot always, the member-only pair only for a `PINS`. */
async function mark(
  id: string,
  entry: { at: [number, number]; note: string },
  exact: boolean,
  title: string,
): Promise<void> {
  const [lat, lng] = entry.at;
  const coarse = coarsen(lat, lng);

  if (apply) {
    /*
     * Two statements rather than one with a conditional fragment: a tagged
     * template cannot be spliced into a value slot, and the difference
     * between them — whether the member-only pair is written at all — is
     * exactly the distinction the two tables exist to keep.
     */
    if (exact) {
      await sql`
        UPDATE photos
           SET precise_lat = ${lat}, precise_lng = ${lng},
               coarse_lat = ${coarse.lat}, coarse_lng = ${coarse.lng}
         WHERE id = ${id};
      `;
    } else {
      await sql`
        UPDATE photos
           SET coarse_lat = ${coarse.lat}, coarse_lng = ${coarse.lng}
         WHERE id = ${id};
      `;
    }
  }

  console.log(
    `${id.padStart(14)}  ${title.slice(0, 20).padEnd(20)}` +
      ` ${lat}, ${lng}  ->  ${coarse.lat}, ${coarse.lng}` +
      `   ${exact ? "dot + exact" : "dot only  "}  (${entry.note})`,
  );
}

console.log(
  `\n${apply ? "Marked" : "Would mark"} ${marked} of ${rows.length} published photographs.`,
);
if (!apply) {
  console.log("Dry run. Nothing was changed. Pass --apply to write.\n");
}
process.exit(0);
