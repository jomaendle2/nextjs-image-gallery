import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Reading the source as text, for tests that assert *shape* rather than
 * behaviour.
 *
 * This is the approach `schema.test.ts` established and the security
 * invariants extended: some properties — "this column is never selected
 * here", "this handler is not a GET" — are about the form of the code, and a
 * behavioural test for them would need a database, a Stripe account and a
 * mail provider, and would therefore never run.
 *
 * Shared rather than copied because the subtle part is `allSourceFiles`,
 * whose exclusions decide what a whole class of test can see. That exact
 * thing drifted once already: the first version of one of these checks
 * looked at `src/lib` and `src/app` and forgot `src/components`, so a test
 * about partial coverage was itself partial.
 *
 * One invariant pins the exact set of files allowed to name either of the
 * two columns a membership pays for, and it matches text rather than code —
 * so an ordinary sentence using one of those words as a word fails it.
 * Reword rather than widening the allow-list; the list is the control.
 */

export const SRC = join(import.meta.dirname, "..");

/** Reads one file under `src`, by path segments. */
export function read(...parts: string[]): string {
  return readFileSync(join(SRC, ...parts), "utf8");
}

/**
 * Every `.ts`/`.tsx` file under `src`, so a new violation cannot hide in a
 * directory nobody thought to name. Test files are excluded: they quote the
 * very patterns they forbid.
 */
export function allSourceFiles(dir: string = SRC): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...allSourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith(".test.ts")) {
      found.push(full);
    }
  }
  return found;
}
