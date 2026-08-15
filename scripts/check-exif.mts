/** Read-only: prove no location data reached the database. */
import { sql } from "../src/lib/database.ts";

const rows = await sql`
  SELECT p.id, p.title, p.width, p.height, p.exif, c.display_name
  FROM photos p JOIN contributors c ON c.id = p.author_id
  ORDER BY p.created_at DESC LIMIT 3;
`;

for (const row of rows) {
  const exif = JSON.stringify(row["exif"] ?? null);
  const leak = /gps|latitude|longitude/i.test(exif);
  console.log(`${row["display_name"]} — ${row["title"] || "(untitled)"}`);
  console.log(`  ${row["width"]}x${row["height"]}`);
  console.log(`  exif: ${exif}`);
  console.log(`  location data present: ${leak ? "YES — LEAK" : "no"}`);
}
