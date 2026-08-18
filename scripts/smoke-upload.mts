/**
 * End-to-end check of the ingest path against a running dev server:
 * upload a blob, ask /api/photos/draft to read it back and derive from it,
 * assert the row landed as a draft, then clean both up.
 *
 * Usage:
 *   npm run smoke:upload
 *
 * It mints its own owner session and deletes it afterwards. It used to
 * require a cookie pasted in from dev tools, which is why nobody ran it —
 * and why it sat broken for a long stretch of commits, asserting on a
 * response shape that had changed underneath it. A check with a setup step
 * is a check that gets skipped, and a skipped check rots silently.
 */
import process from "node:process";
import { del, put } from "@vercel/blob";
import sharp from "sharp";
import { generateSecret, hashSecret } from "../src/lib/auth/secrets.ts";
import { sql } from "../src/lib/database.ts";
import { confirmDestructive } from "./guard.mts";
import { check, finish } from "./harness.mts";

confirmDestructive("create and delete photographs and blobs in this database");

const [, , originArg] = process.argv;
const origin = originArg ?? "http://localhost:3000";

/*
 * A real session row for the owner, exactly as signing in would create —
 * same table, same hashed secret, same expiry rules — so the route under
 * test cannot tell this apart from a person. Removed at the end.
 */
const cookie = generateSecret();
const owners = await sql`
  INSERT INTO sessions (id, contributor_id, email, expires_at)
  SELECT ${hashSecret(cookie)}, id, email, now() + interval '10 minutes'
  FROM contributors WHERE role = 'owner' AND revoked_at IS NULL
  RETURNING email;
`;
if (owners.length === 0) {
  console.error("No active owner to run as. Is the database seeded?");
  process.exit(1);
}

const image = await sharp({
  create: {
    width: 1200,
    height: 800,
    channels: 3,
    background: { r: 180, g: 90, b: 40 },
  },
})
  .withExif({
    IFD0: { Make: "SMOKE", Model: "TEST-1" },
    IFD2: { ISOSpeedRatings: "800", FNumber: "2.8" },
    IFD3: { GPSLatitude: "48/1 8/1 0/1", GPSLatitudeRef: "N" },
  })
  .jpeg()
  .toBuffer();

const blob = await put("photos/smoke-test.jpg", image, {
  access: "public",
  addRandomSuffix: true,
  contentType: "image/jpeg",
});
console.log(`uploaded ${blob.pathname}`);

const response = await fetch(`${origin}/api/photos/draft`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: `gallery_session=${cookie}`,
  },
  body: JSON.stringify({ blobUrl: blob.url }),
});

const body = (await response.json()) as Record<string, unknown>;
console.log(`draft route: ${response.status}`);
console.log(JSON.stringify(body, null, 2).slice(0, 500));

const id = body["id"];
check("returned a draft id", typeof id === "string");

/*
 * Everything below reads the row rather than the response.
 *
 * These assertions used to inspect the draft route's JSON, which once echoed
 * the whole derived object back. It now returns `{ id }` and nothing else,
 * because the old shape included the re-encoded JPEG as a Buffer and sent
 * megabytes of comma-separated integers on every upload. This script kept
 * asserting on the old shape and crashed — for weeks, unnoticed, because
 * nobody ran it.
 *
 * Reading the database is the better test anyway: what matters is what was
 * persisted, not what was echoed. A route could return perfect JSON and
 * store nothing.
 */
if (typeof id === "string") {
  const rows = await sql`
    SELECT published_at, width, height, bg_color, exif, display_pathname
    FROM photos WHERE id = ${id};`;
  const [row] = rows;
  check("row exists", rows.length === 1);
  check("row is a draft, not published", row?.["published_at"] === null);
  check("stored the real dimensions", row?.["width"] === 1200);
  check("stored the real dimensions", row?.["height"] === 800);
  check(
    "derived a hex colour",
    typeof row?.["bg_color"] === "string" &&
      /^#[0-9a-f]{6}$/.test(row["bg_color"] as string),
  );
  check(
    "recorded the display copy's pathname",
    typeof row?.["display_pathname"] === "string",
  );

  const exif = JSON.stringify(row?.["exif"] ?? null);
  check("captured the camera", exif.includes("SMOKE TEST-1"));
  check("captured ISO", exif.includes("800"));
  check(
    "never read the GPS block",
    !(
      exif.toLowerCase().includes("gps") ||
      exif.toLowerCase().includes("latitude")
    ),
  );

  /*
   * The same blob, a second time. Being on our own Blob host proves where a
   * file came from and not whose it is, and every published photograph's URL
   * is in the markup of the page that shows it — so without this refusal one
   * contributor can hand the endpoint another's URL and receive a row
   * attributed to themselves. Checked while the row still exists, because
   * that row is the thing doing the refusing.
   */
  const claimed = await fetch(`${origin}/api/photos/draft`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `gallery_session=${cookie}`,
    },
    body: JSON.stringify({ blobUrl: blob.url }),
  });
  check(
    "refuses a blob that already belongs to a photograph",
    claimed.status === 409,
  );

  await sql`DELETE FROM photos WHERE id = ${id};`;
}

// A rejected SSRF attempt must not create anything.
const ssrf = await fetch(`${origin}/api/photos/draft`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: `gallery_session=${cookie}`,
  },
  body: JSON.stringify({ blobUrl: "http://169.254.169.254/latest/meta-data/" }),
});
check("refuses a non-blob url", ssrf.status === 400);

const anon = await fetch(`${origin}/api/photos/draft`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ blobUrl: blob.url }),
});
check("refuses an anonymous caller", anon.status === 401);

await del(blob.url).catch(() => undefined);

/*
 * The session goes whether or not the checks passed. An earlier run of this
 * script died partway and left a draft row and two blobs in the production
 * database — the same database local development uses — so cleanup that only
 * happens on the happy path is not cleanup.
 */
await sql`DELETE FROM sessions WHERE id = ${hashSecret(cookie)};`;

finish();
