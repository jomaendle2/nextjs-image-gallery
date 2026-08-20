/**
 * Says out loud which database is about to be written to, and refuses to
 * guess.
 *
 * Every `db:*` and `smoke:*` script runs with `--env-file=.env.local`, and
 * `.env.local` points at production. The smoke scripts `INSERT` and `DELETE`
 * contributors, photos and sessions; the only thing between a smoke run and
 * real people's work is a constant tag prefix and the author remembering
 * which shell they are in.
 *
 * There was no existing guard to inherit. The two production checks in the
 * repo — `preflight.mts` and `migrate.mts` — both *skip work* when not in
 * production, which is the opposite direction: they protect the deploy from
 * a missing environment, not the environment from a deploy.
 *
 * So this does the two things a guard can honestly do from inside the repo.
 * It **prints the host**, because "which database is `.env.local` pointing at
 * today" is a question nobody can answer from memory. And it **requires
 * `--apply`**, which turns an accident into a deliberate act. That pattern
 * came from a one-off migration script since deleted; `erase-contributor.mts`
 * is the fullest example of it now.
 *
 * What it cannot do is create a branch to run against. That is a dashboard
 * action, and pretending otherwise would be worse than saying so.
 */
import process from "node:process";

/** The host in `DATABASE_URL`, or a description of why there isn't one. */
export function databaseHost(): string {
  const url = process.env["DATABASE_URL"];
  if (url === undefined || url === "") {
    return "(DATABASE_URL is not set)";
  }
  try {
    return new URL(url).host;
  } catch {
    /*
     * Never the URL itself, on any path. It carries the password, and the
     * whole point of this function is that its result gets printed — into a
     * terminal, into a scrollback, into a pasted bug report.
     */
    return "(DATABASE_URL is not a URL)";
  }
}

/**
 * Refuses to continue unless `--apply` was passed, after naming the target.
 *
 * Called at the top of anything that writes. `what` is one short phrase
 * describing the damage, e.g. "create and delete contributors and photos".
 */
/**
 * Whether `--apply` was passed, removing it from `process.argv` on the way.
 *
 * Consumed, not merely read, and that is the whole point of it being a
 * function. Several of these scripts take positional arguments — an origin, a
 * webhook secret, an email address — with `const [, , arg] = process.argv`.
 * Leaving the flag in place meant `npm run smoke:pages -- --apply` set the
 * origin to the string "--apply" and every fetch failed, and
 * `smoke:membership` signed its fake webhooks with the HMAC key "--apply"
 * and reported signature failures that had nothing to do with what it tests.
 *
 * Shared rather than repeated because it is the part that was got wrong. The
 * two callers want different behaviour around it — one refuses immediately,
 * the other prints what it would do first — but both have to agree on what
 * the flag is and that it must not survive into the positionals.
 */
export function consumeApplyFlag(): boolean {
  const at = process.argv.indexOf("--apply");
  if (at === -1) {
    return false;
  }
  process.argv.splice(at, 1);
  return true;
}

export function confirmDestructive(what: string): void {
  const host = databaseHost();
  console.log(`\n  Target database: ${host}`);
  console.log(`  This will ${what}.\n`);

  if (!consumeApplyFlag()) {
    console.error(
      "  Refusing to run without --apply.\n" +
        "  Check the host above. If it is production, stop and point\n" +
        "  DATABASE_URL at a Neon branch first — see docs/operations/runbook.md.\n" +
        "\n" +
        "    npm run <script> -- --apply\n",
    );
    process.exit(1);
  }
}
