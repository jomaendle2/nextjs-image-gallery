/**
 * Every page renders.
 *
 * The gap this fills: the unit tests read source text and the other smoke
 * scripts drive API routes, so until now *nothing* actually rendered a page.
 * A server component that throws — a bad import, a null nobody guarded, a
 * client component that cannot serialise its props — produced a green suite
 * and a broken site, and the first person to find out would have been a
 * visitor.
 *
 * It caught its own reason for existing immediately: written while splitting
 * `PhotoList` into three components, which no test rendered before or after.
 *
 * Deliberately shallow. It asserts a 200 and one string that only appears if
 * the page really got as far as its own content — not the layout, which
 * renders even when the page beneath it fails. Depth belongs in the other
 * scripts; this is the check that the lights come on.
 *
 *   npm run smoke:pages
 */
import process from "node:process";
import { generateSecret, hashSecret } from "../src/lib/auth/secrets.ts";
import { sql } from "../src/lib/database.ts";
import { confirmDestructive } from "./guard.mts";
import { check, finish } from "./harness.mts";

confirmDestructive(
  "create and delete contributors and photographs in this database",
);

const [, , originArg] = process.argv;
const origin = originArg ?? "http://localhost:3000";

async function renders(
  route: string,
  marker: string,
  auth?: string,
): Promise<void> {
  const res = await fetch(`${origin}${route}`, {
    headers: auth === undefined ? {} : { Cookie: auth },
    redirect: "manual",
  });
  const html = res.status === 200 ? await res.text() : "";

  if (res.status !== 200) {
    check(route, false, `status ${res.status}`);
    return;
  }
  /*
   * Next renders an error boundary *with* a 200 when a client component
   * throws during hydration setup, so status alone is not enough.
   */
  if (html.includes("Application error")) {
    check(route, false, "rendered an error boundary");
    return;
  }
  check(
    route,
    html.includes(marker),
    html.includes(marker) ? "" : `no "${marker}"`,
  );
}

// A short-lived owner session, so the authoring pages can be reached.
const secret = generateSecret();
const rows = await sql`
  SELECT id, email FROM contributors WHERE role = 'owner' LIMIT 1;`;
const owner = rows[0] as { id: string; email: string } | undefined;
if (owner === undefined) {
  console.error("No owner contributor; run the migration and seed first.");
  process.exit(1);
}
await sql`
  INSERT INTO sessions (id, contributor_id, email, expires_at)
  VALUES (${hashSecret(secret)}, ${owner.id}, ${owner.email},
          now() + interval '5 minutes');`;
const cookie = `gallery_session=${secret}`;

try {
  console.log("Public pages");
  await renders("/", "</html>");
  await renders("/photographers", "Photographers");
  /*
   * Checked against the *list*, not the canvas. The globe is an enhancement
   * over a grouped list of links that renders on the server, and this
   * asserts the half that has to work with no JavaScript at all.
   */
  await renders("/globe", "Where these were taken");
  await renders("/membership", "member");
  await renders("/subscribe", "email");
  await renders("/contribute", "Sign in");
  await renders("/contribute/apply", "Apply");

  console.log("Legal pages");
  await renders("/imprint", "Imprint");
  await renders("/privacy", "Privacy");
  await renders("/terms", "Terms");

  console.log("Signed in as the owner");
  await renders("/contribute/photos", "Search by title or location", cookie);
  await renders("/contribute/photos", "Filter by status", cookie);
  await renders("/contribute/admin", "Every photograph", cookie);
  await renders("/contribute/invite", "Invite a photographer", cookie);
} finally {
  await sql`DELETE FROM sessions WHERE id = ${hashSecret(secret)};`;
}

finish();
