/**
 * How does the authoring page actually behave at N photographs?
 *
 * Every claim about the ceiling was reasoning from a page with sixteen rows
 * on it. "It does not scale for many photographs" is the most repeated piece
 * of feedback this project has had, and answering it with an estimate was
 * the wrong kind of answer twice over — an estimate cannot be wrong in
 * public, and it cannot be re-run after a change.
 *
 * So: insert synthetic rows for a throwaway contributor, measure the real
 * page through a real session, delete everything. Re-run it after any change
 * to the list rather than reasoning about the cost again.
 *
 * Two deliberate safeguards. The rows are DRAFTS, so nothing can reach the
 * public gallery even if this dies halfway; and the cleanup is in a
 * `finally`, so it runs when an assertion throws.
 *
 * It borrows a real blob URL from an existing photograph. With a synthetic
 * host `next/image` throws, the page 500s, and the first version of this
 * measured the size of the error overlay — which grew with the row count
 * convincingly enough to look like a real reading.
 *
 *   npm run probe:scale
 */
import process from "node:process";
import { generateSecret, hashSecret } from "../src/lib/auth/secrets.ts";
import { sql } from "../src/lib/database.ts";
import { confirmDestructive } from "./guard.mts";

confirmDestructive(
  "create and delete hundreds of synthetic photographs, then a contributor and its session, in this database",
);

const counts = [50, 150, 300, 600];
const email = `scale-probe-${process.pid}@example.invalid`;
const slug = `scale-probe-${process.pid}`;

// A real blob URL, so next/image accepts the host — with a synthetic one it
// throws and the page 500s, which measures the error overlay rather than the
// page.
const sample = await sql`
  SELECT blob_url, blob_pathname, display_url, display_pathname, blur_data_url
  FROM photos WHERE published_at IS NOT NULL LIMIT 1;`;
const seed = sample[0] as Record<string, string | null>;

const author = `probe-${process.pid}`;
await sql`
  INSERT INTO contributors (id, email, display_name, slug, role)
  VALUES (${author}, ${email}, 'Scale Probe', ${slug}, 'contributor');`;

const secret = generateSecret();
await sql`
  INSERT INTO sessions (id, contributor_id, email, expires_at)
  VALUES (${hashSecret(secret)}, ${author}, ${email}, now() + interval '20 minutes');`;
const cookie = `gallery_session=${secret}`;

async function measure(label: string): Promise<void> {
  // Two fetches; report the second, so compilation is not counted.
  await fetch("http://localhost:3000/contribute/photos", {
    headers: { Cookie: cookie },
  });
  const started = performance.now();
  const res = await fetch("http://localhost:3000/contribute/photos", {
    headers: { Cookie: cookie },
  });
  const html = await res.text();
  const ms = Math.round(performance.now() - started);
  const kb = Math.round(html.length / 1024);
  console.log(
    `  ${label.padStart(4)} rows: ${String(kb).padStart(5)} KB   ${String(ms).padStart(5)} ms   ${res.status}`,
  );
}

try {
  let total = 0;
  console.log("Authoring page, signed in, server-rendered HTML:");
  for (const target of counts) {
    await sql`
      INSERT INTO photos
        (id, blob_url, blob_pathname, display_url, display_pathname,
         width, height, blur_data_url,
         bg_color, title, description, author_id)
      SELECT
        'probe-' || ${author} || '-' || g,
        ${seed["blob_url"]},
        'probe/' || ${author} || '/' || g || '.jpg',
        -- display_url is NOT NULL and is what every page now renders from.
        -- These rows exist to be counted, not looked at, so they point at the
        -- same borrowed URL; the pathname is still per-row because it is
        -- uniquely indexed. (No backticks in here: this is inside a tagged
        -- template, and one would end the literal.)
        ${seed["blob_url"]},
        'probe/' || ${author} || '/' || g || '-display.jpg',
        1200, 800,
        ${seed["blur_data_url"]},
        '#101418',
        'Probe photograph ' || g,
        'A synthetic row used only to measure the page.',
        ${author}
      FROM generate_series(${total + 1}::int, ${target}::int) AS g;`;
    total = target;
    await measure(String(target));
  }
} finally {
  await sql`DELETE FROM photos WHERE author_id = ${author};`;
  await sql`DELETE FROM sessions WHERE contributor_id = ${author};`;
  await sql`DELETE FROM contributors WHERE id = ${author};`;
  const left =
    await sql`SELECT count(*)::int AS n FROM photos WHERE author_id = ${author};`;
  console.log(
    `\ncleaned up, ${(left[0] as { n: number }).n} probe rows remain`,
  );
}
