/**
 * Generates the display copy for photographs imported before that existed.
 *
 * The originals are 9-13 MB. Next's image optimizer downloads the source once
 * per width it serves, and a cold gallery page requests fifteen thumbnails at
 * once — six of those fetches exceeded the optimizer's timeout and rendered
 * as broken images. This backfills a capped, re-encoded copy for each row and
 * points `display_url` at it. Originals are left untouched.
 *
 * Safe to re-run: rows that already have a display copy are skipped.
 */
import process from "node:process";
import { put } from "@vercel/blob";
import { sql } from "../src/lib/database.ts";
import { deriveFromBuffer } from "../src/lib/photos/derive.ts";

const MB = 1024 * 1024;

const rows = await sql`
  SELECT id, blob_url, blob_pathname FROM photos WHERE display_url IS NULL;
`;

if (rows.length === 0) {
  console.log("Every photo already has a display copy; nothing to do.");
  process.exit(0);
}

console.log(`Backfilling ${rows.length} photos.`);

for (const row of rows) {
  const id = row["id"] as string;
  const response = await fetch(row["blob_url"] as string);
  if (response.ok) {
    await backfill(id, row, response);
  } else {
    console.error(`  ${id}: could not fetch original (${response.status})`);
  }
}

console.log("Done.");

async function backfill(
  id: string,
  row: Record<string, unknown>,
  response: Response,
): Promise<void> {
  const original = Buffer.from(await response.arrayBuffer());
  const derived = await deriveFromBuffer(original);

  const name = (row["blob_pathname"] as string).split("/").pop() ?? `${id}.jpg`;
  const display = await put(`photos/display/${name}`, derived.display, {
    access: "public",
    addRandomSuffix: true,
    contentType: "image/jpeg",
  });

  await sql`
    UPDATE photos
    SET display_url = ${display.url},
        width = ${derived.width},
        height = ${derived.height},
        blur_data_url = ${derived.blur_data_url}
    WHERE id = ${id};
  `;

  const before = (original.byteLength / MB).toFixed(1);
  const after = (derived.display.byteLength / MB).toFixed(1);
  console.log(
    `  ${id}: ${before} MB -> ${after} MB (${derived.width}x${derived.height})`,
  );
}
