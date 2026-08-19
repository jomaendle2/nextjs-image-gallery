import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  authored,
  BARE_DOC,
  brokenRefs,
  current,
  DOC_PATH,
  DOCS,
  exists,
  GENERATED,
  knownMarkdown,
  linksIn,
  markdownUnder,
  pointers,
  prose,
  rel,
  resolveLink,
} from "./doc-text";
import { ROOT } from "./source-text";

/**
 * The shape of the documentation, as the few things a test can hold.
 *
 * `docs.test.ts` holds what a document claims about the code. This holds
 * every pointer — between documents, and from code back into them — and the
 * arrangement they are all written for.
 *
 * The arrangement is the point. `AGENTS.md` is short because it defers:
 * three lines about the design system rather than the design system. That is
 * only safe if a deferral to a file that has moved fails like a 404 rather
 * than reading as a sentence that is still true. Prose rots quietly; a
 * pointer can be made to rot loudly, and every check here is one way of
 * making that so.
 */

/**
 * The three files a document may be reached from.
 *
 * Three rather than one so that `AGENTS.md` does not have to name every
 * dated record individually — it defers to `docs/README.md`, which defers to
 * the archive's own index. One hop each, hard-coded rather than computed as
 * full reachability, because full reachability lets two orphans link to each
 * other and call themselves indexed.
 */
const INDEXES = ["AGENTS.md", "docs/README.md", "docs/archive/README.md"];

/**
 * What `AGENTS.md` may cost, in lines of our own writing.
 *
 * The map is useful because it can be read in one screenful before deciding
 * where to go. An `AGENTS.md` that explains things is a second copy of the
 * documentation with nothing checking it against the first — which is the
 * failure the whole tree is arranged to avoid.
 *
 * 120 for a target of about 100. A ceiling with no headroom gets raised the
 * first time somebody adds a legitimate line, and a limit that moves is not
 * a limit.
 */
const AGENTS_CEILING = 120;

describe("every pointer between documents resolves", () => {
  it("every relative link resolves to a file", () => {
    const broken: string[] = [];
    for (const entry of prose()) {
      for (const target of linksIn(entry.text)) {
        const path = resolveLink(entry.file, target);
        if (path !== null && !exists(path)) {
          broken.push(`${entry.file} → ${target}`);
        }
      }
    }

    expect(
      broken,
      "A link that 404s on GitHub is the cheapest possible broken promise. " +
        "If the document moved, fix it here and in the index that names " +
        "it, together. A site route is not a link — write it in inline " +
        "code, as the routes table does.",
    ).toEqual([]);
  });

  /*
   * The form a link does not cover, and the commoner one here: a document
   * naming a sibling in backticks in the middle of a sentence.
   */
  it("every docs/ path named in prose resolves", () => {
    expect(
      brokenRefs(current(), DOC_PATH, exists),
      "Name the document where it now lives. If the sentence is about a " +
        "record that was archived, describe it and link the archive — do " +
        "not keep the old path alive in prose.",
    ).toEqual([]);
  });
});

describe("the code's pointers into the documentation resolve", () => {
  /*
   * The direction nothing checked, and the one that fails most quietly. A
   * broken link is noticed by a reader; a comment naming a document that
   * moved is read by whoever is deepest in the code and least able to go
   * looking for it.
   *
   * Comments are *not* stripped here, which departs from the house habit and
   * is worth stating. `code()` exists so that a test asking whether a file
   * *does* something is not defeated by a comment *explaining* it. This asks
   * about the explanation: a path in a comment is a pointer, and so is one
   * in a `console.error` an operator reads while something is already
   * broken — `scripts/guard.mts` and `scripts/preflight.mts` each have one.
   * Strip either and most of what this exists for disappears.
   */
  it("every docs/ path named under src or scripts resolves", () => {
    expect(
      brokenRefs(pointers(), DOC_PATH, exists),
      "The document moved and this comment did not. Update it: a pointer " +
        "in code is read by whoever is deepest in the code and least able " +
        "to go looking.",
    ).toEqual([]);
  });

  /*
   * The same question asked of the spelling that omits the folder. Two
   * comments named the roadmap by its bare filename, with no path in front of
   * it, and the check above — which requires one — read past both. They were
   * still naming the file it had been called before the restructure, an hour
   * after everything else had been updated.
   *
   * Note what this rules out: a comment cannot illustrate a stale pointer by
   * writing one. The `code()` helper exists because a test that punishes
   * explaining its own rule gets the explanation deleted — the answer here is
   * to describe the filename rather than spell it, which costs a clause and
   * keeps the check free of exemptions.
   */
  it("every bare markdown filename names a document that exists", () => {
    const known = knownMarkdown();

    expect(
      brokenRefs(pointers(), BARE_DOC, (name) => known.has(name)),
      "That document does not exist under any folder. Name it by its path " +
        "so the check above can see it too, and so a reader knows where to " +
        "look.",
    ).toEqual([]);
  });
});

describe("the tree has the shape the map describes", () => {
  it("every document is reachable from an index", () => {
    const linked = new Set(
      INDEXES.flatMap((index) => {
        const text = authored(index, readFileSync(join(ROOT, index), "utf8"));
        return linksIn(text)
          .map((target) => resolveLink(index, target))
          .filter((path): path is string => path !== null);
      }),
    );

    const orphans = markdownUnder()
      .map(rel)
      .filter((path) => !(INDEXES.includes(path) || linked.has(path)));

    expect(
      orphans,
      "A document nothing links to is one nobody will find and nobody will " +
        "update. Link it from docs/README.md, or from the archive's index " +
        "if it is a record.",
    ).toEqual([]);
  });

  /*
   * The indexes are hard-coded above, which is only honest if the chain
   * between them is real. Without these two edges a reader following
   * `AGENTS.md` never reaches the archive, and the list quietly becomes
   * three unrelated roots.
   */
  it("the indexes form a chain", () => {
    expect(readFileSync(join(ROOT, "AGENTS.md"), "utf8")).toContain(
      "docs/README.md",
    );
    expect(readFileSync(join(DOCS, "README.md"), "utf8")).toContain(
      "archive/README.md",
    );
  });

  it("AGENTS.md is a map, not an encyclopaedia", () => {
    const raw = readFileSync(join(ROOT, "AGENTS.md"), "utf8");

    /*
     * Asserted before the strip, for two reasons. The block's own text says
     * that deleting it from a diff only recreates the uncommitted change, so
     * a missing one is worth a named failure rather than a mystery. And if
     * Next ever renames the markers, the strip becomes a silent no-op — at
     * which point the ceiling starts counting somebody else's lines.
     */
    expect(
      GENERATED.test(raw),
      "The generated nextjs-agent-rules block is gone. `next dev` will put " +
        "it back; commit it with the change rather than deleting it.",
    ).toBe(true);

    const lines = authored("AGENTS.md", raw).trim().split("\n").length;
    expect(
      lines,
      `AGENTS.md is ${lines} lines of our own. It is the table of ` +
        "contents, not the encyclopaedia — move the detail into docs/ and " +
        "point at it from here.",
    ).toBeLessThanOrEqual(AGENTS_CEILING);
  });

  /*
   * Two files that are both nominally the entry point, disagreeing, is the
   * exact failure a single map exists to prevent.
   */
  it("CLAUDE.md delegates rather than duplicating", () => {
    expect(readFileSync(join(ROOT, "CLAUDE.md"), "utf8").trim()).toBe(
      "@AGENTS.md",
    );
  });
});
