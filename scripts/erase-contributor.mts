/**
 * Erases a photographer and everything of theirs, for real.
 *
 * The GDPR says a person can ask to be deleted. This repository could not do
 * it. `setContributorRevoked` only writes `revoked_at` and drops their
 * sessions — which is right for revocation, and is not erasure: the row, the
 * address, the photographs and both blobs per photograph all remain.
 *
 * Nor could it be done by hand. `photos.author_id` references
 * `contributors(id)` with no `ON DELETE`, so a raw DELETE in the Neon console
 * is refused until the photographs go; and deleting the photographs by hand
 * orphans their blobs permanently, because `deletePhoto` deletes the row and
 * _returns_ the two pathnames for its caller to clean up. The one function
 * that does clean them up, `deleteBlobs`, is module-private inside a
 * `"use server"` file, so nothing outside that file can call it.
 *
 * So this is a script rather than an admin button, deliberately: erasure is
 * rare, irreversible, and worth typing a command for.
 *
 * Dry run by default, following `name-photographs.mts` and the guard.
 *
 *   npm run erase-contributor -- someone@example.com
 *   npm run erase-contributor -- someone@example.com --apply
 */
import process from "node:process";
import { del } from "@vercel/blob";
import { normaliseEmail } from "../src/lib/auth/slug.ts";
import { sql } from "../src/lib/database.ts";
import { databaseHost } from "./guard.mts";
import { check, finish, section } from "./harness.mts";

const [, , emailArg] = process.argv;
const apply = process.argv.includes("--apply");

if (emailArg === undefined || emailArg.startsWith("--")) {
  console.error(
    "Usage: npm run erase-contributor -- someone@example.com [--apply]",
  );
  process.exit(1);
}

const address = normaliseEmail(emailArg);

console.log(`\n  Target database: ${databaseHost()}`);
console.log(`  Contributor: ${address}`);
console.log(apply ? "  Mode: ERASING\n" : "  Mode: dry run (pass --apply)\n");

const found = await sql`
  SELECT id, slug, display_name, revoked_at
  FROM contributors WHERE email = ${address};
`;
const [contributor] = found;

/*
 * Refusing rather than reporting nothing is the point. "No such address"
 * printed next to a green run reads as "done", and the one thing worse than
 * failing to erase somebody is believing you have.
 */
if (contributor === undefined) {
  console.error(`  No contributor with the address ${address}. Nothing done.`);
  process.exit(1);
}

const id = contributor["id"] as string;
section(`${contributor["display_name"]} (${contributor["slug"]})`);

const photos = await sql`
  SELECT id, blob_pathname, display_pathname, is_opener, published_at
  FROM photos WHERE author_id = ${id};
`;
const invitees = await sql`
  SELECT id, email FROM contributors WHERE invited_by = ${id};
`;

/*
 * The opener is global and unscoped: `setOpener` writes
 * `is_opener = (id = $1)` across the whole table, so there is exactly one and
 * nothing reassigns it when its photograph disappears. Erasing whoever holds
 * it leaves the gallery with none.
 *
 * Detected and reported rather than reassigned. Which photograph opens the
 * site is an editorial decision, and a script quietly promoting whatever sorts
 * first would be making it on somebody's behalf.
 */
const opener = photos.find((row) => row["is_opener"] === true);

for (const photo of photos) {
  const paths = [photo["blob_pathname"], photo["display_pathname"]].filter(
    (path): path is string => typeof path === "string" && path !== "",
  );
  console.log(
    `  photo ${photo["id"]}: ${paths.length} blob(s) — ${paths.join(", ")}`,
  );
}
console.log(`\n  ${photos.length} photograph(s)`);
console.log(`  ${invitees.length} contributor(s) they invited`);
if (opener !== undefined) {
  console.log(
    `\n  ** This person holds the opener (photo ${opener["id"]}). **\n` +
      "  Erasing them leaves the gallery with no opening photograph.\n" +
      "  Choose a new one from /contribute/admin afterwards.",
  );
}

if (!apply) {
  console.log("\n  Dry run. Nothing was changed. Pass --apply to erase.\n");
  process.exit(0);
}

section("Erasing");

/*
 * Blobs first, and outside the row deletions.
 *
 * A blob whose row is gone is unreachable and unfindable — nothing in the
 * database points at it any more, so it is billed forever and cannot be
 * matched back to anybody. A row whose blob is already gone is merely a
 * broken image for the moment before it too is deleted. So the order is the
 * one whose failure is recoverable.
 */
for (const photo of photos) {
  const paths = [photo["blob_pathname"], photo["display_pathname"]].filter(
    (path): path is string => typeof path === "string" && path !== "",
  );
  for (const path of paths) {
    try {
      await del(path);
      check(`blob ${path}`, true);
    } catch (error) {
      /*
       * Reported, not thrown. One already-deleted blob must not leave the
       * person's row and address in the database — a half-finished erasure
       * is the worst outcome here, and `finish` will still exit non-zero so
       * nobody reads this as clean.
       */
      check(`blob ${path}`, false, String(error));
    }
  }
}

const removed =
  await sql`DELETE FROM photos WHERE author_id = ${id} RETURNING id;`;
check(
  `deleted ${removed.length} photograph row(s)`,
  removed.length === photos.length,
);

/*
 * `invited_by` is the second FK into this row, and it is the reason a plain
 * DELETE fails even after the photographs are gone. Nulled rather than
 * cascaded: the people they invited are their own contributors, and losing
 * their accounts because somebody else asked to be forgotten would be a new
 * harm done in the name of preventing one.
 */
const orphaned = await sql`
  UPDATE contributors SET invited_by = NULL WHERE invited_by = ${id}
  RETURNING id;
`;
check(`cleared invited_by on ${orphaned.length} contributor(s)`, true);

/*
 * By address, not by id. `login_tokens.contributor_id` is null for a token
 * minted to somebody who had no contributors row at the time, and `sessions`
 * resolves through the address as well — so deleting by id alone would leave
 * a live credential behind for an address that no longer exists.
 */
await sql`DELETE FROM sessions WHERE email = ${address};`;
await sql`DELETE FROM login_tokens WHERE email = ${address} OR contributor_id = ${id};`;
check("deleted sessions and login tokens", true);

const gone = await sql`DELETE FROM contributors WHERE id = ${id} RETURNING id;`;
check("deleted the contributor row", gone.length === 1);

const left = await sql`SELECT 1 FROM contributors WHERE email = ${address};`;
check("the address is no longer in contributors", left.length === 0);

if (opener !== undefined) {
  const openers = await sql`SELECT 1 FROM photos WHERE is_opener = true;`;
  check(
    "an opening photograph still exists",
    openers.length > 0,
    "choose one from /contribute/admin",
  );
}

finish();
