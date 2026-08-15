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

export async function incrementViewCount(imageId: string): Promise<number> {
  try {
    const result = await sql`
      INSERT INTO image_views (image_id, view_count)
      VALUES (${imageId}, 1)
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

export async function getViewCount(imageId: string): Promise<number> {
  try {
    const result = await sql`
      SELECT view_count
      FROM image_views
      WHERE image_id = ${imageId};
    `;
    return (result[0]?.["view_count"] as number | undefined) ?? 0;
  } catch (error) {
    console.error("Error getting view count:", error);
    return 0;
  }
}

export async function getAllViewCounts(): Promise<
  { image_id: string; view_count: number }[]
> {
  try {
    const result = await sql`
      SELECT image_id, view_count
      FROM image_views
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
