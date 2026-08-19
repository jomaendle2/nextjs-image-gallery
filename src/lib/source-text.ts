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
 * The same text with comments removed, for invariants that are about code.
 *
 * Some of these checks ask "does this file *do* X"; others ask "does this
 * file *mention* X at all". The second kind is stricter on purpose — the
 * allow-list of files naming the paid columns is a control, and a sentence
 * that happens to use one of those words has to fail it so somebody rewords
 * rather than widening the list.
 *
 * But the first kind is defeated by its own documentation. Two invariants
 * were written, and failed immediately, against comments explaining why the
 * thing they forbid is forbidden: a paragraph saying "not
 * `NEXT_PUBLIC_MAPTILER_KEY`" reads to a regex exactly like doing it. A test
 * that punishes explaining the rule is a test that gets the explanation
 * deleted.
 */
export function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** The repository root, for the tests that read outside `src`. */
export const ROOT = join(SRC, "..");

/**
 * Every `.ts`/`.tsx` file under `src`, so a new violation cannot hide in a
 * directory nobody thought to name. Test files are excluded: they quote the
 * very patterns they forbid.
 *
 * The exclusion is `.test.ts` and not `.test.tsx`, which is exact rather than
 * careless — there are none of the latter, and widening it here would quietly
 * change what every invariant above can see.
 */
export function allSourceFiles(dir: string = SRC): string[] {
  return walk(
    dir,
    (entry) => /\.tsx?$/.test(entry) && !entry.endsWith(".test.ts"),
  );
}

/**
 * The traversal, once, with the policy left to the caller.
 *
 * `keep` decides on the filename and `skip` on the full path, because those
 * are the two shapes every caller has wanted: an extension, and one directory
 * or file that is output rather than source.
 *
 * Shared for the reason the docblock above gives about `allSourceFiles`. The
 * exclusions are the interesting part and belong at each call site; the
 * `readdirSync`/`statSync`/recurse is not, and there were three copies of it —
 * the third added by the tests that check the documentation, which is one more
 * place for a walk to quietly stop descending.
 */
export function walk(
  dir: string,
  keep: (entry: string) => boolean,
  skip: (full: string) => boolean = () => false,
): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (skip(full)) {
      // The caller's exclusion. `noContinue` is on, so this branch is empty.
    } else if (statSync(full).isDirectory()) {
      found.push(...walk(full, keep, skip));
    } else if (keep(entry)) {
      found.push(full);
    }
  }
  return found;
}
