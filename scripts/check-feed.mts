/**
 * A read-only sanity check against the real database. It reproduces the feed
 * ORDER BY rather than importing the repository, because Node does not
 * resolve the `@/` alias that the app modules use.
 */
import { sql } from "../src/lib/database.ts";

const rows = await sql`
  SELECT p.id, p.title, p.is_opener, p.published_at, c.display_name
  FROM photos p JOIN contributors c ON c.id = p.author_id
  WHERE p.published_at IS NOT NULL AND c.revoked_at IS NULL
  ORDER BY p.is_opener DESC, p.published_at DESC;
`;

console.log(`feed order (${rows.length} photos):`);
for (const [i, row] of rows.entries()) {
  const pin = row["is_opener"] === true ? " [opener]" : "";
  console.log(
    `  ${String(i + 1).padStart(2)}. id=${String(row["id"]).padStart(2)} ${row["title"]}${pin}`,
  );
}

const views = await sql`
  SELECT v.image_id, v.view_count, p.title
  FROM image_views v LEFT JOIN photos p ON p.id = v.image_id
  ORDER BY v.view_count DESC LIMIT 5;
`;

console.log("\ntop view counts, joined to the imported photos:");
for (const row of views) {
  console.log(
    `  ${row["image_id"]}: ${row["view_count"]} views -> ${row["title"] ?? "NO MATCHING PHOTO"}`,
  );
}
