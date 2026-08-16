import process from "node:process";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env["DATABASE_URL"];

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

export const sql = neon(connectionString);

/**
 * Memoized so the `CREATE TABLE IF NOT EXISTS` round trip happens once per
 * warm instance instead of once per request. Under Fluid Compute a single
 * instance serves many requests, so this removes a database round trip from
 * the critical path of nearly every call.
 */
let initPromise: Promise<void> | null = null;

export function initDatabase(): Promise<void> {
  initPromise ??= (async () => {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS image_views (
          id SERIAL PRIMARY KEY,
          image_id VARCHAR(255) UNIQUE NOT NULL,
          view_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
    } catch (error) {
      // Allow a later request to retry rather than caching the failure.
      initPromise = null;
      console.error("Error initializing database:", error);
    }
  })();

  return initPromise;
}

/**
 * Counts a view, but only for a photograph that exists.
 *
 * The `WHERE EXISTS` is the whole point. This is written from an endpoint
 * that anyone on the internet may call, and the insert used to accept any
 * string up to 255 characters as an image id — so a few minutes of scripting
 * could fill the table with rows for photographs that never existed. Those
 * rows are not merely untidy: `getAllViewCounts` is fetched by every visitor
 * to the gallery, so junk here becomes payload for everybody.
 *
 * Gating on `photos` makes the table self-limiting: at most one row per
 * photograph, and nothing a caller invents can add to it. Rows left from
 * before contributors existed keep their counts; they simply stop growing,
 * which is right, because the images they refer to are no longer served.
 */
export async function incrementViewCount(imageId: string): Promise<number> {
  try {
    const result = await sql`
      INSERT INTO image_views (image_id, view_count)
      SELECT ${imageId}, 1
      WHERE EXISTS (SELECT 1 FROM photos WHERE id = ${imageId})
      ON CONFLICT (image_id) DO UPDATE SET
        view_count = image_views.view_count + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING view_count;
    `;
    return (result[0]?.["view_count"] as number | undefined) ?? 0;
  } catch (error) {
    console.error("Error incrementing view count:", error);
    return 0;
  }
}

/**
 * Every count the gallery could actually display, and nothing else.
 *
 * Joined to `photos` rather than selected outright: this response goes to
 * every visitor, and the bare table also holds rows from the gallery's
 * static-asset days whose images are no longer served. Sending those was
 * paying bandwidth on every page load to describe photographs nobody can
 * see.
 */
export async function getAllViewCounts(): Promise<
  { image_id: string; view_count: number }[]
> {
  try {
    const result = await sql`
      SELECT v.image_id, v.view_count
      FROM image_views v
      JOIN photos p ON p.id = v.image_id
      WHERE p.published_at IS NOT NULL
    `;

    return result.map((row) => ({
      image_id: row["image_id"] as string,
      view_count: row["view_count"] as number,
    }));
  } catch (error) {
    console.error("Error getting all view counts:", error);
    return [];
  }
}
