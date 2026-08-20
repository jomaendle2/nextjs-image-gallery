import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

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
export function allSourceFiles(): string[] {
  return walk(
    SRC,
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
  /*
   * `withFileTypes`, so that asking whether an entry is a directory costs
   * nothing. The obvious spelling stats every entry — and then a caller whose
   * `skip` stats for size, which is the only kind of `skip` anybody has
   * written, stats all of them a second time.
   *
   * Directories are tested against `skip` and files against `keep` first, so
   * a size limit is asked only about files that would otherwise be returned.
   * Both orders matter to a live caller: `markdownUnder` skips a whole
   * directory, and `codeUnder` skips by a size that means nothing for one.
   */
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skip(full)) {
        found.push(...walk(full, keep, skip));
      }
    } else if (keep(entry.name) && !skip(full)) {
      found.push(full);
    }
  }
  return found;
}

/**
 * How large a source file can be before it is taken to be generated data.
 *
 * The coastline tiers under `src/lib/geo` are 70 KB, 495 KB and 2.5 MB of
 * coordinate arrays; the largest thing anybody has written by hand here is
 * 31 KB. Scanning the three of them was about a quarter of what the
 * documentation tests cost, and for a check that matches text it is worse
 * than useless: a bare filename found inside a two-megabyte float array is a
 * false positive, not a finding.
 *
 * By size rather than by name, and that is not squeamishness — `world.test.ts`
 * asserts that no module mentions the heavy tiers outside a dynamic import,
 * so a list of them here would break the invariant that keeps them out of the
 * bundle. Size is also what actually matters, and it needs no maintenance
 * when a fourth tier is generated.
 */
export const GENERATED_BYTES = 64 * 1024;

/**
 * Every hand-written code file under one directory, generated data aside.
 *
 * `src` and `scripts` are both spelled `.ts`/`.tsx` and `.mts`/`.mjs` in
 * different proportions, and every caller that has wanted one has wanted the
 * other — so the extension set lives here rather than being split by
 * directory at each call site, which is how the second caller came to read
 * three megabytes of coordinates looking for an environment variable.
 */
export function codeUnder(dir: string): string[] {
  return walk(
    dir,
    (entry) => /\.(?:tsx?|mts|mjs)$/.test(entry),
    (full) => statSync(full).size > GENERATED_BYTES,
  );
}

/** Repo-relative and posix, the one spelling every check compares in. */
export function rel(absolute: string): string {
  return absolute
    .slice(ROOT.length + 1)
    .split(sep)
    .join("/");
}
