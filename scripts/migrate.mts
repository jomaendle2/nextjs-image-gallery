/**
 * Applies the schema. Run locally with `npm run db:migrate`, and
 * automatically by `vercel-build` before every deployment builds.
 *
 * Running on every build is safe by construction rather than by luck: every
 * statement in `MIGRATIONS` is additive and idempotent, and `schema.test.ts`
 * fails the build if one is added that is not. That property was always the
 * design — it just was not being used for anything, so the schema advanced
 * only when somebody remembered to run this by hand.
 *
 * Which meant a deploy could ship code ahead of the columns it queries. It
 * did not tonight, and only because the same database backs local
 * development and somebody had run this locally hours earlier.
 *
 * It fails the build if the database is unreachable, deliberately. A deploy
 * blocked by an outage is recoverable; a deploy that succeeds and then
 * cannot read a column it selects is a broken site with a green checkmark.
 *
 * **It refuses to run outside production, and that is new.** Preview,
 * development and production currently share one Neon database —
 * `docs/roadmap.md` §1 has this as the first thing to fix and it is a
 * dashboard setting rather than a code change. Until it is fixed, "runs on
 * every build" meant every *preview* build too: push a branch that adds a
 * statement to `MIGRATIONS`, and it executes against live data the moment
 * Vercel builds the preview — before review, before merge, and including the
 * data-touching statements already in the list, which rewrite `exif` and
 * backfill `display_pathname`.
 *
 * `preflight.mts` has gated on `VERCEL_ENV` since it was written. This
 * script never did, and the difference was not deliberate.
 *
 * The trade this makes is worth stating plainly, because it is a trade. A
 * preview branch that needs a new column now renders a broken preview
 * instead of migrating production: a 500 on a URL nobody has bookmarked,
 * against an unreviewed schema change on real rows. Set
 * `ALLOW_PREVIEW_MIGRATIONS=1` on the branch to opt back in, once you have
 * decided that is what you want. When preview gets its own branch database,
 * this whole block should go.
 */
import process from "node:process";
import {
  deploymentEnv,
  isProduction,
  onVercel,
} from "../src/lib/deployment.ts";
import { MIGRATIONS } from "../src/lib/schema.ts";

/**
 * Whether this build is allowed to change the schema.
 *
 * No platform at all means a local run — `npm run db:migrate` against a
 * developer's own database, which is the command's original purpose and must
 * keep working.
 *
 * `onVercel()` rather than `deploymentEnv() === undefined`, which is what
 * this asked first and is wrong in the one direction that matters here.
 * `deploymentEnv()` narrows to three known values and answers `undefined` for
 * anything else, so a Custom Environment — `VERCEL_ENV` set to the
 * environment's own name — was indistinguishable from a laptop, and a branch
 * build would have run all of `MIGRATIONS` against the shared database.
 */
function mayMigrate(): boolean {
  return (
    !onVercel() ||
    isProduction() ||
    process.env["ALLOW_PREVIEW_MIGRATIONS"] === "1"
  );
}

async function main(): Promise<void> {
  if (!mayMigrate()) {
    console.log(
      `migrate: ${deploymentEnv() ?? "unrecognised VERCEL_ENV"} build, ` +
        `skipping ${MIGRATIONS.length} statements.\n` +
        "migrate: preview shares the production database — see the note in this file.\n" +
        "migrate: set ALLOW_PREVIEW_MIGRATIONS=1 to run them anyway.",
    );
    return;
  }

  /*
   * Imported here rather than at the top, so that a build which is not going
   * to migrate never opens a connection — and never fails on a missing
   * `DATABASE_URL` it was not going to use. `database.ts` throws at import
   * time by design, which is right for every other caller and exactly wrong
   * for the one that has just decided to do nothing.
   */
  const { sql } = await import("../src/lib/database.ts");

  for (const statement of MIGRATIONS) {
    await sql.query(statement);
    console.log(`ok: ${statement.slice(0, 62).replace(/\s+/g, " ")}...`);
  }
  console.log(`Applied ${MIGRATIONS.length} statements.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
