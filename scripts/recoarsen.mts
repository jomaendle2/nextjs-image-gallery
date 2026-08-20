/**
 * Rewrites every published dot after `CELL_KM` changed.
 *
 * A coarse point is stored, not derived — deliberately, so that a published
 * dot cannot move because somebody later tuned the arithmetic. The cost of
 * that decision is this script: when the arithmetic *is* tuned on purpose,
 * nothing on the globe changes until every row is put through the new
 * `coarsen()`. `coarsen.test.ts` has a tripwire that exists to make somebody
 * read this sentence before it is needed.
 *
 *     npm run db:recoarsen            # prints the plan
 *     npm run db:recoarsen -- --apply # writes it
 *
 * **The exact point is the input, and there is no substitute for it.**
 * Re-coarsening an already-coarse point is the one thing this must not do:
 * a 100 km cell centre put through a 1 km grid produces a tidy 1 km cell
 * that is still up to 71 km from where the photograph was taken. It would
 * look precise and be exactly as wrong as before, which is worse than
 * leaving it visibly blunt. So rows are only rewritten where
 * `precise_lat`/`precise_lng` survive.
 *
 * Rows without them are the photographs whose photographer chose "public
 * only" in the picker: the exact point was never stored, and no cell size
 * recovers it. They are listed rather than touched, because the honest
 * summary of this migration is "these ones cannot be fixed here" and a
 * script that silently skipped them would not say so.
 *
 * `backfill-pins.mts` is the other half, and is run first: it holds the
 * original coordinates for the photographs that predate the picker,
 * including four that have a published place name but no exact point, so it
 * can re-derive what this cannot.
 */
import process from "node:process";
import { sql } from "../src/lib/database.ts";
import { CELL_KM, coarsen, MAX_ERROR_KM } from "../src/lib/photos/coarsen.ts";
import { consumeApplyFlag, databaseHost } from "./guard.mts";

const apply = consumeApplyFlag();
console.log(`\n  Target database: ${databaseHost()}`);
console.log(`  Cell: ${CELL_KM} km, worst error ${MAX_ERROR_KM} km`);
console.log(apply ? "  Mode: WRITING\n" : "  Mode: dry run (pass --apply)\n");

const rows = await sql`
  SELECT id, title, location, precise_lat, precise_lng, coarse_lat, coarse_lng
    FROM photos
   WHERE coarse_lat IS NOT NULL OR precise_lat IS NOT NULL
   ORDER BY id;
`;

/** Great-circle distance, so a reported move is metres on the ground. */
function kmBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

let rewritten = 0;
let unchanged = 0;
const stranded: string[] = [];

for (const row of rows) {
  const id = row["id"] as string;
  const title = String(row["title"]);
  const preciseLat = row["precise_lat"] as number | null;
  const preciseLng = row["precise_lng"] as number | null;

  if (preciseLat === null || preciseLng === null) {
    stranded.push(`${id} — "${title}" (${String(row["location"])})`);
  } else {
    const next = coarsen(preciseLat, preciseLng);
    const oldLat = row["coarse_lat"] as number | null;
    const oldLng = row["coarse_lng"] as number | null;
    const moved =
      oldLat === null || oldLng === null
        ? null
        : kmBetween({ lat: oldLat, lng: oldLng }, next);

    if (moved !== null && moved < 0.001) {
      unchanged += 1;
    } else {
      const by = moved === null ? "new" : `${moved.toFixed(1)} km`;
      console.log(`  ${id} — ${title}: dot moves ${by}`);
      if (apply) {
        await sql`
          UPDATE photos
             SET coarse_lat = ${next.lat}, coarse_lng = ${next.lng}
           WHERE id = ${id};
        `;
      }
      rewritten += 1;
    }
  }
}

console.log(
  `\n  ${rewritten} rewritten, ${unchanged} already correct, ${stranded.length} cannot be`,
);

if (stranded.length > 0) {
  console.log(
    "\n  No exact point was ever stored for these, so there is nothing here to",
  );
  console.log(
    "  recompute from. Run `npm run db:backfill-pins -- --apply` first: it",
  );
  console.log(
    "  holds a published place name for each and re-derives the dot from that,",
  );
  console.log(
    "  which is the one direction this is safe in. Anything it does not list",
  );
  console.log(
    "  can only be fixed by the photographer marking the spot again:\n",
  );
  for (const line of stranded) {
    console.log(`    ${line}`);
  }
}

if (!apply) {
  console.log("\n  Nothing was written. Pass --apply.\n");
}

process.exit(0);
