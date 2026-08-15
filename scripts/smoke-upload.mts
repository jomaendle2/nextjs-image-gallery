/**
 * End-to-end check of the ingest path against a running dev server:
 * upload a blob, ask /api/photos/draft to read it back and derive from it,
 * assert the row landed as a draft, then clean both up.
 *
 * Usage:
 *   node --env-file=.env.local scripts/smoke-upload.mts <session-cookie> [origin]
 */
import process from "node:process";
import { del, put } from "@vercel/blob";
import sharp from "sharp";
import { sql } from "../src/lib/database.ts";

const [, , cookie, originArg] = process.argv;
if (!cookie) {
  console.error("Usage: smoke-upload.mts <gallery_session value> [origin]");
  process.exit(1);
}
const origin = originArg ?? "http://localhost:3000";

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
  body: JSON.stringify({ blobUrl: blob.url, pathname: blob.pathname }),
});

const body = (await response.json()) as Record<string, unknown>;
console.log(`draft route: ${response.status}`);
console.log(JSON.stringify(body, null, 2).slice(0, 500));

let failures = 0;
function check(label: string, ok: boolean): void {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) {
    failures += 1;
  }
}

const id = body["id"];
check("returned a draft id", typeof id === "string");
check("read the real dimensions", body["width"] === 1200);
check("read the real dimensions", body["height"] === 800);
check(
  "derived a hex colour",
  typeof body["bg_color"] === "string" && /^#[0-9a-f]{6}$/.test(body["bg_color"]),
);
check(
  "captured the camera",
  JSON.stringify(body["exif"]).includes("SMOKE TEST-1"),
);
check("captured ISO", JSON.stringify(body["exif"]).includes("800"));
check(
  "discarded GPS",
  !JSON.stringify(body["exif"]).toLowerCase().includes("gps") &&
    !JSON.stringify(body["exif"]).toLowerCase().includes("latitude"),
);

if (typeof id === "string") {
  const rows = await sql`SELECT published_at FROM photos WHERE id = ${id};`;
  check("row exists", rows.length === 1);
  check("row is a draft, not published", rows[0]?.["published_at"] === null);
  await sql`DELETE FROM photos WHERE id = ${id};`;
}

// A rejected SSRF attempt must not create anything.
const ssrf = await fetch(`${origin}/api/photos/draft`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: `gallery_session=${cookie}`,
  },
  body: JSON.stringify({
    blobUrl: "http://169.254.169.254/latest/meta-data/",
    pathname: "photos/evil.jpg",
  }),
});
check("refuses a non-blob url", ssrf.status === 400);

const anon = await fetch(`${origin}/api/photos/draft`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ blobUrl: blob.url, pathname: blob.pathname }),
});
check("refuses an anonymous caller", anon.status === 401);

await del(blob.url).catch(() => undefined);
console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
