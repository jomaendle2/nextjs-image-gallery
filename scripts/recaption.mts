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
 *   npm run recaption                      # report only
 *   npm run recaption -- --only 4,hnbSFpi3sFiB     # just these
 *   npm run recaption -- --apply 4,hnbSFpi3sFiB    # write, after snapshotting
 *   npm run recaption -- --restore FILE    # put a snapshot back
 *
 * **Only the owner's own photographs, unless `--everyone` is passed.** This
 * is the second thing the script learned, and the more serious one. The
 * gallery has more than one contributor, and a first run rewrote six
 * photographs belonging to somebody else — whose captions are published under
 * their name, and who was never asked. `docs/next-version.md` has stated the
 * rule since before any of this existed: *never publish generated text under
 * somebody's name unreviewed.* A batch script run by the site owner is
 * exactly the path that walks around it, because the owner's credentials
 * reach every row while their judgement covers only their own.
 *
 * The suggestion feature itself has never had this problem: it runs when a
 * photographer presses a button on their own photograph, and writes nothing
 * until they save.
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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  author: string;
  is_owner: boolean;
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
const everyone = args.includes("--everyone");
const restoreFrom = listAfter("--restore")?.[0];

const writing = applying || restoreFrom !== undefined;
console.warn(`database: ${databaseHost()}`);
console.warn(writing ? "MODE: writes" : "MODE: report only");

/**
 * Restoring is the whole point of taking a snapshot, and a snapshot you
 * cannot put back is a comfort rather than a safety net.
 *
 * Descriptions and tags only, matching what an apply writes — so a restore
 * cannot resurrect a title or a location that somebody has edited by hand
 * since. It runs before anything else and exits: there is nothing to compare
 * when the job is to undo a comparison.
 */
if (args.includes("--restore") && restoreFrom === undefined) {
  console.error("--restore needs the snapshot file to read.");
  process.exit(1);
}

if (restoreFrom !== undefined) {
  const saved = JSON.parse(readFileSync(restoreFrom, "utf8")) as {
    id: string;
    description: string;
    tags: string[];
  }[];
  const only = chosen ?? [];
  const rowsToPut =
    only.length === 0 ? saved : saved.filter((row) => only.includes(row.id));

  for (const row of rowsToPut) {
    await sql`
      UPDATE photos
      SET description = ${row.description}, tags = ${row.tags}::text[]
      WHERE id = ${row.id};`;
    console.warn(`restored ${row.id}`);
  }
  console.warn(
    `\n${rowsToPut.length} photographs restored from ${restoreFrom}.`,
  );
  process.exit(0);
}

const all = (await sql`
  SELECT p.id, p.title, p.description, p.location, p.display_url, p.exif,
         p.tags, c.display_name AS author, (c.role = 'owner') AS is_owner
  FROM photos p JOIN contributors c ON c.id = p.author_id
  ORDER BY p.created_at DESC;`) as unknown as Row[];

/*
 * Whose photographs these are, from `contributors.role` rather than from a
 * name in the environment.
 *
 * The first version of this guard read `OWNER_NAME`, which is set nowhere in
 * this repo — so it was inert: undefined meant "no scope" and every row was
 * in range, silently, which is the failure the guard was added to prevent.
 * A safety check that does nothing when unconfigured is worse than none,
 * because the comment above it says otherwise.
 *
 * `role = 'owner'` is the same identity `isOwner` uses everywhere else, it
 * is already in the database, and it survives a renamed display name.
 */
const mine = everyone ? all : all.filter((row) => row.is_owner);

if (mine.length < all.length) {
  console.warn(
    `scope: ${mine.length} of ${all.length} — ` +
      `${all.length - mine.length} belong to another photographer` +
      (everyone
        ? " and ARE INCLUDED (--everyone)."
        : " and are skipped. Their captions are published under their name; " +
          "pass --everyone only with their say-so."),
  );
}

const rows =
  chosen === null || chosen.length === 0
    ? mine
    : mine.filter((row) => chosen.includes(row.id));

/*
 * A mistyped id used to mean "0 photographs" after the snapshot had already
 * been written — a run that looked like it had decided something.
 */
if (chosen !== null && chosen.length > 0) {
  const missing = chosen.filter((id) => !rows.some((row) => row.id === id));
  if (missing.length > 0) {
    console.error(
      `Not found, or not in scope: ${missing.join(", ")}. ` +
        "Ids are the opaque ones printed by a report run.",
    );
    process.exit(1);
  }
}

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
   * Every row this run could ever write to, not only the ones it is writing
   * now. A snapshot that covers the subset is useless the second time
   * somebody applies a different subset from the same report.
   *
   * `mine`, though, and not `all`. The wider set was other contributors'
   * titles, descriptions and locations — unpublished drafts among them —
   * copied into a file under `docs/` by a script that never edits them, and
   * `docs/snapshots/` was not ignored. Scope is the same word here as it is
   * in the guard above: the rows this operator is allowed to change are the
   * rows worth keeping the originals of.
   */
  /*
   * Never over an existing file, and this is the whole value of the
   * snapshot rather than a detail of it. The first version named the file
   * from `STAMP ?? "latest"`, so a second apply on the same day wrote over
   * the first one's originals with text the first one had already replaced —
   * losing exactly what the snapshot exists to keep, and losing it quietly.
   * `STAMP` is still honoured for a readable name; a collision takes a
   * suffix rather than the file.
   */
  const base = `docs/snapshots/captions-${process.env["STAMP"] ?? "run"}`;
  let at = `${base}.json`;
  for (let n = 2; existsSync(at); n += 1) {
    at = `${base}-${n}.json`;
  }
  writeFileSync(
    at,
    `${JSON.stringify(
      mine.map(({ id, title, description, location, tags }) => ({
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
  console.warn(`snapshot: ${at} (${mine.length} rows)`);
}

let changed = 0;
let skipped = 0;

for (const row of rows) {
  /*
   * Checked, because the failure is silent and lands in the column. An
   * expired or 404 blob URL returns an HTML error body, and handing that to
   * a vision model as JPEG bytes produces a confident description of
   * nothing — which an apply run then writes over a real caption.
   */
  const response = await fetch(row.display_url);
  if (response.ok) {
    const image = new Uint8Array(await response.arrayBuffer());

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
  } else {
    console.warn(
      `\n${row.id}: display copy unreachable (${response.status}) — skipped`,
    );
    skipped += 1;
  }
}

console.warn(
  `\n${rows.length} photographs, ${changed} with something to change` +
    (skipped === 0 ? "." : `, ${skipped} skipped for an unreachable copy.`),
);
