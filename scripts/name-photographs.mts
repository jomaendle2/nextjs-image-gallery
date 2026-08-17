/**
 * Moves the place out of the title and gives each photograph a name.
 *
 * Every photograph published before this was titled with its location —
 * "Uluwatu, Bali, Indonesia", "Vila Nova de Milfontes, Portugal" — because
 * there was nowhere else to put it. `location` existed and was NULL on all
 * fourteen, so the viewer showed the place twice under two different labels
 * and the gallery had no names in it at all.
 *
 * The names are short and plain on purpose: this site's own wordmark is
 * lowercase and its copy avoids flourish, so "Low Tide" belongs here and
 * "Whispers of the Atlantic" does not. Each was written after looking at the
 * photograph, which is why the two Böblingen frames — identical title and
 * identical description before this — end up as "One Branch" and "Looking
 * Up".
 *
 * Idempotent: a row is only rewritten while its title still equals the place
 * this script expects, so running it twice changes nothing the second time
 * and it cannot overwrite a name somebody has since edited by hand.
 *
 * Run once against production, kept because the mapping is the record of
 * what those fourteen photographs were called before.
 */
import process from "node:process";
import { sql } from "../src/lib/database.ts";
import { check, finish, section } from "./harness.mts";

interface Rename {
  id: string;
  /** The title as it stands today, and the guard against a second run. */
  was: string;
  title: string;
  location: string;
}

const RENAMES: readonly Rename[] = [
  {
    id: "1",
    was: "Bali, Indonesia",
    title: "Tide Lines",
    location: "Bali, Indonesia",
  },
  {
    id: "2",
    was: "Vila Nova de Milfontes, Portugal",
    title: "Low Tide",
    location: "Vila Nova de Milfontes, Portugal",
  },
  {
    id: "3",
    was: "Bali, Indonesia",
    title: "Pink Frangipani",
    location: "Bali, Indonesia",
  },
  {
    id: "4",
    was: "Bromo, Java, Indonesia",
    title: "Batok at Sunrise",
    location: "Bromo, Java, Indonesia",
  },
  {
    id: "5",
    was: "Böblingen, Germany",
    title: "One Branch",
    location: "Böblingen, Germany",
  },
  {
    id: "6",
    was: "Uluwatu, Bali, Indonesia",
    title: "The Cliff Edge",
    location: "Uluwatu, Bali, Indonesia",
  },
  {
    id: "7",
    was: "Sagres, Portugal",
    title: "Last Light",
    location: "Sagres, Portugal",
  },
  {
    id: "8",
    was: "San Diego, California",
    title: "Palm Fronds",
    location: "San Diego, California",
  },
  {
    id: "9",
    was: "Koh Samui, Thailand",
    title: "White Frangipani",
    location: "Koh Samui, Thailand",
  },
  {
    id: "10",
    was: "Rio de Janeiro, Brazil",
    title: "Sugarloaf",
    location: "Rio de Janeiro, Brazil",
  },
  {
    id: "11",
    was: "San Francisco, California",
    title: "Golden Gate",
    location: "San Francisco, California",
  },
  {
    id: "12",
    was: "Arches National Park, Utah",
    title: "Storm Clouds",
    location: "Arches National Park, Utah",
  },
  {
    id: "13",
    was: "Böblingen, Germany",
    title: "Looking Up",
    location: "Böblingen, Germany",
  },
  {
    id: "14",
    was: "Koh Phangan, Thailand",
    title: "Palms in the Breeze",
    location: "Koh Phangan, Thailand",
  },
];

const apply = process.argv.includes("--apply");

section(apply ? "Renaming" : "Dry run — pass --apply to write");

for (const r of RENAMES) {
  /*
   * A dry run reads; only `--apply` writes. Two statements rather than one
   * with a conditional, because a tagged-template fragment nested inside a
   * value slot is not a thing the driver interpolates — it would have been
   * sent as a parameter and quietly rewritten every title to the literal
   * string "title".
   */
  const rows = apply
    ? await sql`
        UPDATE photos SET title = ${r.title}, location = ${r.location}
        WHERE id = ${r.id} AND title = ${r.was}
        RETURNING id;`
    : await sql`SELECT id FROM photos WHERE id = ${r.id} AND title = ${r.was};`;

  check(
    `${r.id.padStart(2)}  ${r.was}  →  "${r.title}"`,
    rows.length === 1,
    rows.length === 0 ? "already renamed, or the title has changed" : "",
  );
}

finish();
