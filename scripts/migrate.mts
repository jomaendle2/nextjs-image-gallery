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
 */
import process from "node:process";
import { sql } from "../src/lib/database.ts";
import { MIGRATIONS } from "../src/lib/schema.ts";

async function main(): Promise<void> {
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
