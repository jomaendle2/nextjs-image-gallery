import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { ROOT, walk } from "./source-text";

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
 * The archive, and the one exemption in any of this.
 *
 * An archived document is a statement about a past state — what was true in
 * August, what a review found, what a plan intended. Holding it to the
 * present would mean editing it whenever the code moves, and a record edited
 * to keep a test quiet is not a record. That edit is the thing the exemption
 * exists to prevent.
 *
 * A directory rule rather than a list of files, unlike `NO_STYLESHEET` in
 * `design.test.ts`, and for the opposite reason: there, growth is supposed
 * to hurt, because each entry is a decision. Here the archive grows by
 * design and a per-file list would make every archival a two-file edit.
 *
 * What is *not* exempt is links. A sentence describing August is history; a
 * link is a promise to whoever clicks it now, and a promise that 404s is
 * broken however old the page is. The archive's own `README.md` is not a
 * record at all — it is the index into them — so it is held to everything.
 */
const ARCHIVE = "docs/archive";

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

/** Repo-relative and posix, the one spelling every check compares in. */
export function rel(absolute: string): string {
  return absolute
    .slice(ROOT.length + 1)
    .split(sep)
    .join("/");
}

/** Every `.md` under `docs`, recursively, snapshots aside. */
export function markdownUnder(dir: string = DOCS): string[] {
  return walk(
    dir,
    (entry) => entry.endsWith(".md"),
    (full) => full === SNAPSHOTS,
  );
}

/** The half of a file we wrote. Only `AGENTS.md` has another half. */
export function authored(file: string, text: string): string {
  return file === "AGENTS.md" ? text.replace(GENERATED, "") : text;
}

/** Every markdown file at the repository root. */
function rootMarkdown(): string[] {
  return readdirSync(ROOT)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => join(ROOT, entry));
}

/**
 * Every prose file in the repository.
 *
 * The root files are discovered rather than listed. A hard-coded three drifted
 * from `knownMarkdown` below within a day of both being written: `CLAUDE.md`
 * counted as a document that exists for one check while being invisible to
 * every other, which is the shape of hole this whole file is against.
 */
export function prose(): Prose[] {
  return [...rootMarkdown(), ...markdownUnder()].map((file) => ({
    file: rel(file),
    text: authored(rel(file), readFileSync(file, "utf8")),
  }));
}

/**
 * Whether a document is a record rather than a claim about now.
 *
 * On the repo-relative path with its separator, not `startsWith` against the
 * folder's own name. The folder name is a prefix of any sibling whose name
 * merely begins the same way — a hyphenated note file beside it, a directory
 * that pluralises it — and either would have been silently exempted from
 * every check in `docs.test.ts` by nothing more than a well-chosen filename.
 * An exemption that can be claimed by accident is not an exemption.
 *
 * Asked of the path rather than stored on the record, because a field that
 * says the same thing is a second place for the answer to live.
 */
function isHistorical(relative: string): boolean {
  return (
    relative.startsWith(`${ARCHIVE}/`) && basename(relative) !== "README.md"
  );
}

/** Live prose: everything the present tense is answerable for. */
export function current(): Prose[] {
  return prose().filter((entry) => !isHistorical(entry.file));
}

/**
 * Every file that could hold a pointer into the documentation — `src` and
 * `scripts`, both, tests included.
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
function allPointerFiles(): string[] {
  return [
    ...codeUnder(join(ROOT, "src")),
    ...codeUnder(join(ROOT, "scripts")),
    join(ROOT, "biome.json"),
  ];
}

/**
 * How large a source file can be before it is taken to be generated data.
 *
 * The coastline tiers under `src/lib/geo` are 70 KB, 495 KB and 2.5 MB of
 * coordinate arrays; the largest thing anybody has written by hand here is
 * 31 KB. Scanning the three of them for documentation pointers was about a
 * quarter of what these tests cost, and it was worse than useless: a bare
 * filename matched inside a two-megabyte float array is a false positive,
 * not a finding.
 *
 * By size rather than by name, and that is not squeamishness — `world.test.ts`
 * asserts that no module mentions the heavy tiers outside a dynamic import,
 * so a list of them here would break the invariant that keeps them out of the
 * bundle. Size is also what actually matters, and it needs no maintenance
 * when a fourth tier is generated.
 */
const GENERATED_BYTES = 64 * 1024;

function codeUnder(dir: string): string[] {
  return walk(
    dir,
    (entry) => /\.(?:tsx?|mts|mjs)$/.test(entry),
    (full) => statSync(full).size > GENERATED_BYTES,
  );
}

/** Every pointer file, with its text — the `prose()` of the code side. */
export function pointers(): Prose[] {
  return allPointerFiles().map((file) => ({
    file: rel(file),
    text: readFileSync(file, "utf8"),
  }));
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
    for (const ref of new Set(text.match(pattern) ?? [])) {
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
