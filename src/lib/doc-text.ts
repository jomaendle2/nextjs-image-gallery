import { lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { codeUnder, GENERATED_BYTES, ROOT, rel, walk } from "./source-text";

/**
 * Reading the documentation as a tree, for the tests that hold it together.
 *
 * `source-text.ts` does this for code and states the reasoning; this is the
 * same idea pointed the other way. The machinery is shared rather than
 * copied because the subtle parts — which files count as documentation,
 * which are exempt, and what "this path exists" means — decide what two
 * whole test files can see, and a second copy of any of them would drift.
 *
 * Beside `source-text.ts` in `biome.json`'s override list for the same two
 * reasons it is: it reads the filesystem, so it needs `noNodejsModules` off,
 * and it declares regexes that only a directory walk uses, so it needs
 * `useTopLevelRegex` off. Nothing in the application imports it.
 */

export const DOCS = join(ROOT, "docs");

/**
 * The caption snapshots. Live database text written by `npm run recaption`
 * before it edits anything, kept so a run can be put back — data, not
 * documentation, and `.gitignore` says the same.
 *
 * Skipped by path rather than by name, so that a document written under one
 * of the real folders and happening to be called *snapshots* is not silently
 * exempt from everything by having picked an unlucky filename.
 */
const SNAPSHOTS = join(DOCS, "snapshots");

/**
 * The block `next dev` writes into `AGENTS.md` and re-adds if it is removed.
 * We do not control its contents or its length, so it is stripped before
 * anything reads or counts that file.
 */
export const GENERATED =
  /<!-- BEGIN:nextjs-agent-rules -->[\s\S]*?<!-- END:nextjs-agent-rules -->/;

/*
 * All global, so all used through `match` and `matchAll` only. `test()` on a
 * global regex advances `lastIndex` and would start skipping every other
 * file — silent partial coverage, which is the failure `source-text.ts` was
 * written about and which the docs checks have already had once, over
 * `.mts`. `GENERATED` above carries no `/g` and is safe to `test()`.
 */
export const SRC_PATH = /(?:src|scripts)\/[\w./[\]-]+\.(?:mts|mjs|tsx?)/g;
export const NPM_SCRIPT = /`npm run ([\w:-]+)(?: --[^`]*)?`/g;
export const DOC_PATH = /docs\/[\w./-]+\.md/g;

/**
 * A markdown file named without its folder — `roadmap.md` rather than
 * `docs/roadmap.md`.
 *
 * Added because the path pattern above, which requires the `docs/` prefix,
 * walked straight past two comments that named a document by bare filename;
 * both survived the move that deleted it. This is the same lesson the `.mts`
 * comment in `docs.test.ts` records, arriving a second time: a pattern only
 * catches the spelling it was written for, and the spelling somebody actually
 * used is the one it will not have been.
 */
export const BARE_DOC = /(?<![\w/.-])[\w-]+\.md\b/g;

/** Every markdown filename that exists anywhere we keep documentation. */
export function knownMarkdown(): Set<string> {
  return new Set(
    [...rootMarkdown(), ...markdownUnder()].map((file) => basename(file)),
  );
}
const MD_LINK = /(?<!!)\[[^\]\n]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
const REF_LINK = /^\s{0,3}\[[^\]\n]+\]:\s*(\S+)/gm;

interface Prose {
  file: string;
  text: string;
}

/** Every `.md` under `docs`, recursively, snapshots aside. */
export function markdownUnder(): string[] {
  return walk(
    DOCS,
    (entry) => entry.endsWith(".md"),
    (full) => full === SNAPSHOTS,
  );
}

/** The half of a file we wrote. Only `AGENTS.md` has another half. */
export function authored(file: string, text: string): string {
  return file === "AGENTS.md" ? text.replace(GENERATED, "") : text;
}

/** Every markdown file at the repository root, symlinks included. */
function rootMarkdown(): string[] {
  return readdirSync(ROOT)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => join(ROOT, entry));
}

/**
 * The configuration, which is prose too.
 *
 * `biome.json` was named here by hand, because it was the file that prompted
 * the rule: its restricted-import messages are read at the moment somebody is
 * blocked, and every one of them cites a document. Naming it fixed that one
 * file and left the rule shallower than its own reasoning — `tsconfig.json`
 * grew a comment pointing at `docs/architecture/toolchain.md` in the same
 * change that wrote this walk, and was outside it.
 *
 * By extension rather than by name, so the next config file is covered by
 * existing. Root level only: `node_modules` is below it, and the size limit
 * drops `package-lock.json`, which is 156 KB of resolved URLs and cites
 * nothing.
 */
function configFiles(): string[] {
  const roots = readdirSync(ROOT, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && /\.(?:json|mjs|ya?ml)$/.test(entry.name),
    )
    .map((entry) => join(ROOT, entry.name))
    .filter((file) => statSync(file).size <= GENERATED_BYTES);

  /*
   * Guarded, because a directory that is absent is not the same as a rule
   * that does not apply: without this, a checkout with no `.github` fails
   * every documentation test with an `ENOENT` naming a path nobody was
   * asking about.
   */
  const workflows = exists(".github")
    ? walk(join(ROOT, ".github"), (entry) => /\.ya?ml$/.test(entry))
    : [];

  return [...roots, ...workflows];
}

/**
 * Read once per process.
 *
 * Nine test cases across two files ask for one of these two collections, and
 * each call was a fresh directory walk plus a re-read of every file it found
 * — 1.7 MB of source for `pointers()`, at thirteen milliseconds a time. The
 * tree does not change while the suite runs, so the second read can only ever
 * agree with the first.
 *
 * Safe here and nowhere near the application: nothing outside the tests
 * imports this module, and a test process that outlives an edit to the
 * documentation does not exist.
 */
let CACHED_PROSE: Prose[] | undefined;
let CACHED_POINTERS: Prose[] | undefined;

/**
 * Every prose file in the repository.
 *
 * The root files are discovered rather than listed. A hard-coded three drifted
 * from `knownMarkdown` below within a day of both being written: `CLAUDE.md`
 * counted as a document that exists for one check while being invisible to
 * every other, which is the shape of hole this whole file is against.
 */
export function prose(): Prose[] {
  /*
   * Symlinks are not documents. `CLAUDE.md` points at `AGENTS.md`, so
   * following it would scan the same bytes under a second name and report
   * every finding twice. It still counts as a file that *exists* — see
   * `knownMarkdown` — because a comment naming it is naming something real.
   */
  CACHED_PROSE ??= [
    ...rootMarkdown().filter((file) => !lstatSync(file).isSymbolicLink()),
    ...markdownUnder(),
  ].map((file) => ({
    file: rel(file),
    text: authored(rel(file), readFileSync(file, "utf8")),
  }));
  return CACHED_PROSE;
}

/**
 * Every file that could hold a pointer into the documentation, with its text
 * — `src` and `scripts`, both, tests included. The `prose()` of the code side.
 *
 * Deliberately not `allSourceFiles`, and the difference is the point. That
 * function answers "where could a violation hide", and its exclusions are a
 * control: `.test.ts` is out because a test quotes the pattern it forbids.
 * This one answers "where could a stale path hide", and by those exclusions
 * it would miss most of them — nine of the twenty doc references in this
 * repository are in `scripts/*.mts`, which it does not walk at all, and
 * three more are in `*.test.ts` files, which it drops.
 *
 * A comment pointing at a document that moved is wrong wherever it sits —
 * including when it sits in configuration. `biome.json` carries the reason
 * for each restricted import as a message a developer reads at the moment
 * they are blocked, and every one of those names a document. Those messages
 * were outside this walk when they were written, so moving the file they
 * cite would have left the suite green.
 */
export function pointers(): Prose[] {
  CACHED_POINTERS ??= [
    ...codeUnder(join(ROOT, "src")),
    ...codeUnder(join(ROOT, "scripts")),
    ...configFiles(),
  ].map((file) => ({ file: rel(file), text: readFileSync(file, "utf8") }));
  return CACHED_POINTERS;
}

/**
 * Every reference matching `pattern` that `ok` rejects, as `file → ref`.
 *
 * Four checks had written this loop out, differing only in the pattern and
 * the predicate, and each had to re-derive the same two details: `new Set`,
 * because a document naming the same path twice should fail once, and
 * `match` rather than `test`, because these patterns are global and `test`
 * would advance `lastIndex` into the next file.
 *
 * The reason each check exists stays at the check. Only the loop is here.
 */
export function brokenRefs(
  entries: Prose[],
  pattern: RegExp,
  ok: (ref: string) => boolean,
): string[] {
  const broken: string[] = [];
  for (const { file, text } of entries) {
    /*
     * Group 1 where the pattern has one, the whole match otherwise. The npm
     * script check wanted the name without its `npm run` and backticks and
     * so wrote this loop out for a fifth time — without the `new Set`, so a
     * document naming the same command twice reported it twice.
     */
    const refs = [...text.matchAll(pattern)].map(
      (match) => match[1] ?? match[0],
    );
    for (const ref of new Set(refs)) {
      if (!ok(ref)) {
        broken.push(`${file} → ${ref}`);
      }
    }
  }
  return broken;
}

/**
 * Does this repo-relative path exist, spelled exactly this way?
 *
 * `existsSync` would be shorter and wrong. Half of the docs restructure was
 * case-changing renames — a SHOUTING-CASE filename became a kebab-case one
 * in a new folder — and on a case-insensitive checkout `existsSync` says yes
 * to the old spelling while CI, which is Linux, says no. A test whose answer
 * depends on the contributor's filesystem is worse than no test: it teaches
 * people that the red is flaky.
 *
 * Written without either spelling, because naming the old path here would
 * make this comment the last thing in the repository still pointing at it.
 */
export function exists(path: string): boolean {
  // Leading and trailing separators fall out here; the filter covers both.
  const segments = path.split("/").filter((part) => part.length > 0);
  if (segments.length === 0) {
    return false;
  }

  /*
   * Every segment, not only the last. The first version checked the filename
   * and let `dirname` reach the folders through `statSync`, which is exactly
   * as case-insensitive as the filesystem underneath it — so `docs/Architecture`
   * passed on a Mac and failed on CI, which is the failure this function was
   * written to prevent, moved one level up. The restructure that introduced
   * these folders is what made it reachable.
   */
  let here = ROOT;
  for (const segment of segments) {
    if (!listing(here).includes(segment)) {
      return false;
    }
    here = join(here, segment);
  }
  return true;
}

/** One directory's entries, or nothing if it is not a directory. */
function listing(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/**
 * Fenced blocks removed, for the checks where a fence means "an example".
 *
 * Deliberately not applied to the `src/` path check, which looks like an
 * inconsistency and is not: a fenced `node scripts/migrate.mts` is a command
 * somebody will paste and has to be right, whereas a fenced link is a
 * demonstration of link syntax. The fence changes what the text is for.
 */
function withoutFences(text: string): string {
  return text.replace(/^```[\s\S]*?^```/gm, "");
}

/**
 * Where a markdown link points, or `null` for "not ours to check".
 *
 * Resolved against the directory of the file it is written in, which is the
 * whole reason this is a function: `docs/architecture/security.md` reaching
 * `../operations/runbook.md` is the ordinary case in a tree with folders,
 * and was impossible in a flat one.
 *
 * Anchors are split off and the fragment dropped rather than checked.
 * Validating a heading slug means reproducing GitHub's slug algorithm, which
 * is a real check and a much more brittle one; it is out of scope on purpose
 * rather than by oversight.
 */
export function resolveLink(from: string, target: string): string | null {
  const bare = target.replace(/^<|>$/g, "").trim();
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(bare) || bare.startsWith("#")) {
    return null;
  }
  const [path] = bare.split("#");
  if (path === undefined || path.length === 0) {
    return null;
  }
  const decoded = decodeURIComponent(path);
  const full = decoded.startsWith("/")
    ? join(ROOT, decoded)
    : resolve(dirname(join(ROOT, from)), decoded);
  /*
   * `${ROOT}${sep}` rather than `ROOT`, so that a sibling checkout called
   * `…-old` is not read as being inside this one. A link that escapes the
   * repository is reported as written rather than resolved, because there is
   * nothing here it could sensibly be checked against.
   */
  return full.startsWith(`${ROOT}${sep}`) ? rel(full) : bare;
}

/** Every link target in a document, fenced examples left out. */
export function linksIn(text: string): string[] {
  const source = withoutFences(text);
  return [...source.matchAll(MD_LINK), ...source.matchAll(REF_LINK)]
    .map((match) => match[1])
    .filter((target): target is string => target !== undefined);
}
