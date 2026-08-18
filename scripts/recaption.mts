/**
 * Re-runs the suggestion over every photograph and shows what changed.
 *
 * Written because three things about the suggestion changed at once — the
 * model, the prompt now knowing the photographer's own Location, and a
 * description schema that is allowed to name a place it was told — and every
 * caption on the site predates all three. A feature that only improves
 * photographs uploaded *after* it shipped has improved a gallery nobody is
 * looking at yet.
 *
 * **It does not decide anything.** It writes a report, and a person reads it.
 * That is not timidity about automation, it is what the field is: the
 * description is alt text, read aloud in place of the photograph to somebody
 * who cannot see it, published under a photographer's name. "The new one
 * scores better" is not a sentence anything here can honestly say, and a
 * model grading its own homework is the least trustworthy possible judge of
 * it. So the run produces a diff, and applying it takes a second command with
 * an explicit list.
 *
 * The snapshot is the part that matters most and is easiest to skip. Captions
 * live in one mutable column with no history: overwrite one and the original
 * is gone from this database, from the build output — which bakes in none of
 * it — and from git, which never had it. This was learned the direct way,
 * by overwriting one before the script existed. So the first thing an apply
 * run does is write every current caption to a file, and it refuses to
 * continue if it cannot.
 *
 *   npm run recaption                      # every photograph, report only
 *   npm run recaption -- --only 4,13       # just these
 *   npm run recaption -- --apply 4,13      # write these, after snapshotting
 *
 * Applying writes `description` and `tags` — **never the title**, though the
 * report shows the suggested one. That asymmetry is the main thing this
 * script learned. Read down a full run and the two fields go opposite ways:
 * the descriptions improve almost without exception, because most of them
 * were written as captions rather than as alt text and several break the
 * site's own stated voice ("Lovely palm trees", "Beautiful coastal landscape
 * in Portugal") or say nothing at all ("Aerial view of pale waves"). The
 * titles get worse — "Looking Up" becomes "Blossom Against Blue", "The Cliff
 * Edge" becomes "Cliffs of Uluwatu", "Tide Lines" becomes "Breaking Line".
 *
 * Which makes sense once stated: a description is a *function*, and there is
 * a right answer that a careful model can find. A title is a person naming
 * their own work, and there is no right answer to find — only theirs. So the
 * suggested title stays in the report, where a photographer can take it if
 * they like it, and out of the database.
 *
 * It never publishes, unpublishes, or touches a location or a pin either —
 * the place a photographer chose is theirs, and the pin is the one field
 * here that is also a dot on a public map.
 *
 * Cached pages carry a one-hour revalidate, so an applied change reaches the
 * site within the hour rather than at once. Nothing here can shorten that
 * from outside Next.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import process from "node:process";
import { suggestForPhotograph } from "../src/lib/ai/suggest.ts";
import { shapeSuggestion } from "../src/lib/ai/suggestion.ts";
import { sql } from "../src/lib/database.ts";
import { databaseHost } from "./guard.mts";

interface Row {
  id: string;
  title: string;
  description: string;
  location: string | null;
  display_url: string;
  exif: unknown;
  tags: string[];
}

const args = process.argv.slice(2);

/** `--apply 4,13` or `--only 4,13`; the flag's value is the id list. */
function listAfter(flag: string): string[] | null {
  const at = args.indexOf(flag);
  if (at === -1) {
    return null;
  }
  const raw = args[at + 1];
  if (raw === undefined || raw.startsWith("--")) {
    return [];
  }
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "");
}

const applying = args.includes("--apply");
const chosen = listAfter("--apply") ?? listAfter("--only");

console.warn(`database: ${databaseHost()}`);
console.warn(applying ? "MODE: apply (writes)" : "MODE: report only");

const all = (await sql`
  SELECT id, title, description, location, display_url, exif, tags
  FROM photos
  ORDER BY created_at DESC;`) as unknown as Row[];

const rows =
  chosen === null || chosen.length === 0
    ? all
    : all.filter((row) => chosen.includes(row.id));

if (applying) {
  if (chosen === null || chosen.length === 0) {
    console.error(
      "Refusing to apply to everything. Pass the ids you reviewed: " +
        "--apply 4,13",
    );
    process.exit(1);
  }
  mkdirSync("docs/snapshots", { recursive: true });
  /*
   * Every row, not only the ones being written. A snapshot that covers the
   * subset is a snapshot that is useless the second time somebody applies a
   * different subset from the same report.
   */
  const at = `docs/snapshots/captions-${process.env["STAMP"] ?? "latest"}.json`;
  writeFileSync(
    at,
    `${JSON.stringify(
      all.map(({ id, title, description, location, tags }) => ({
        id,
        title,
        description,
        location,
        tags,
      })),
      null,
      2,
    )}\n`,
  );
  console.warn(`snapshot: ${at} (${all.length} rows)`);
}

let changed = 0;

for (const row of rows) {
  const image = new Uint8Array(
    await (await fetch(row.display_url)).arrayBuffer(),
  );

  const fresh = shapeSuggestion(
    await suggestForPhotograph({
      image,
      exif: row.exif as never,
      /*
       * The photographer's own place, exactly as the route sends it. Without
       * this the comparison would be against a prompt the site no longer
       * runs, which is the one thing that would make the whole report
       * meaningless.
       */
      location: row.location,
    }).complete,
  );

  const titleMoved = fresh.title !== row.title;
  const descriptionMoved = fresh.description !== row.description;
  if (titleMoved || descriptionMoved || fresh.tags.length > 0) {
    changed += 1;
  }

  console.warn(`\n${"=".repeat(72)}`);
  console.warn(`${row.id}  ${row.location ?? "(no location)"}`);
  console.warn(`  title  was: ${row.title}`);
  console.warn(
    `         now: ${fresh.title}${titleMoved ? "  (suggestion only)" : "   (same)"}`,
  );
  console.warn(`  desc   was: ${row.description}`);
  console.warn(
    `         now: ${fresh.description}${descriptionMoved ? "" : "   (same)"}`,
  );
  console.warn(`  tags   was: ${JSON.stringify(row.tags)}`);
  console.warn(`         now: ${JSON.stringify(fresh.tags)}`);

  if (applying) {
    await sql`
      UPDATE photos
      SET description = ${fresh.description},
          tags = ${fresh.tags}::text[]
      WHERE id = ${row.id};`;
    console.warn("  → description and tags written; title left alone");
  }
}

console.warn(
  `\n${rows.length} photographs, ${changed} with something to change.`,
);
