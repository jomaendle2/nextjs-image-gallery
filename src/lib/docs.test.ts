import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  current,
  DOC_PATH,
  exists,
  linksIn,
  NPM_SCRIPT,
  prose,
  resolveLink,
  SRC_PATH,
} from "./doc-text";
import { ROOT } from "./source-text";

/**
 * Keeps the documentation honest about things that can be checked.
 *
 * Three documents went stale during one evening's work, all written
 * carefully, and two of them ended up asserting the opposite of the truth —
 * that opening a sign-in link spends it, that a missing mail key fails
 * silently, that checkout refuses anonymous callers. Every one described a
 * real behaviour at the moment it was written and was invalidated by a later
 * change that nobody thought to re-read prose for.
 *
 * Code has a typechecker and a test suite standing between it and drift.
 * Prose has somebody remembering to look, and the more confident the prose
 * the less likely anybody does.
 *
 * Only mechanically checkable claims can be defended this way — a file that
 * exists, a script that is really in `package.json`, a count that matches.
 * The genuinely dangerous rot is semantic and no test will catch it. But
 * these are the cheap half, and a document whose file paths are wrong is
 * usually a document whose explanations are wrong too.
 *
 * This file holds the claims a document makes about the world. The claims
 * the world makes about documents — a comment naming a path — are in
 * `docs-tree.test.ts`, along with the shape of the tree itself.
 */

describe("the documentation refers to things that exist", () => {
  /*
   * Catches a rename or a deletion, which is the commonest way a document
   * starts lying: the explanation stays plausible while the path it points
   * at has moved.
   */
  it("every src/ and scripts/ path mentioned is real", () => {
    const broken: string[] = [];
    for (const { file, text } of current()) {
      /*
       * `.mts` matters and was missing from the first version of this
       * pattern — every operational script in this repository uses it, so
       * the check silently covered nothing it was written for. Caught by
       * renaming a referenced file and finding the test still green.
       */
      const paths = text.match(SRC_PATH);
      for (const path of new Set(paths ?? [])) {
        if (!exists(path)) {
          broken.push(`${file} → ${path}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("every npm script mentioned is defined", () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
    };
    const defined = new Set(Object.keys(pkg.scripts));

    const missing: string[] = [];
    for (const { file, text } of current()) {
      /*
       * The trailing-argument form matters and was missing: the pattern
       * required a backtick straight after the name, so `npm run smoke:email
       * -- you@example.com` and `npm run mint-link -- you@…` were invisible.
       * Those two are the break-glass commands — the ones read while
       * something is already broken — and they were the only ones unchecked.
       */
      for (const match of text.matchAll(NPM_SCRIPT)) {
        const [, name] = match;
        if (name !== undefined && !defined.has(name)) {
          missing.push(`${file} → npm run ${name}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

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
    const broken: string[] = [];
    for (const { file, text } of current()) {
      for (const path of new Set(text.match(DOC_PATH) ?? [])) {
        if (!exists(path)) {
          broken.push(`${file} → ${path}`);
        }
      }
    }

    expect(
      broken,
      "Name the document where it now lives. If the sentence is about a " +
        "record that was archived, describe it and link the archive — do " +
        "not keep the old path alive in prose.",
    ).toEqual([]);
  });
});

describe("counts stated in prose match the code", () => {
  /*
   * "Six templates" survived the addition of a seventh. A number in prose is
   * the most checkable claim there is and the easiest to leave behind.
   */
  const words: Record<number, string> = {
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
    10: "ten",
  };

  it("the stated number of email templates is right", () => {
    const actual = templates().length;
    const expected = words[actual];
    expect(expected, `no word for ${actual} templates`).toBeDefined();

    const wrong: string[] = [];
    for (const { file, text } of current()) {
      for (const match of text.matchAll(/(\w+) templates/gi)) {
        const said = match[1]?.toLowerCase();
        // Only the counting words; "seven templates in" but not "email templates".
        if (
          said !== undefined &&
          Object.values(words).includes(said) &&
          said !== expected
        ) {
          wrong.push(`${file} says "${said} templates", there are ${actual}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  /*
   * The count was right and the list was short: two documents said nine
   * templates and then named seven, having gained `sendMembershipWelcome`
   * and `sendApplicationDeclined` without gaining a sentence. A check on the
   * numeral and not the enumeration certifies the half nobody gets wrong.
   */
  it("wherever the templates are enumerated, all of them are", () => {
    const all = templates();
    const short: string[] = [];

    /*
     * Three, because naming one or two is a sentence about those two and
     * naming three is a list. The threshold is the whole design of this
     * check: it cannot tell what a document meant, so it infers intent from
     * how many it named, and the number has to be low enough to catch a
     * list that lost an entry and high enough not to fire on prose.
     */
    const ENUMERATING = 3;

    for (const { file, text } of current()) {
      const named = all.filter((name) => text.includes(name));
      if (named.length >= ENUMERATING && named.length < all.length) {
        const absent = all.filter((name) => !text.includes(name));
        short.push(
          `${file} names ${named.length} of ${all.length}, missing ${absent.join(", ")}`,
        );
      }
    }

    expect(
      short,
      "A document that lists the email templates lists all of them. Name " +
        "each `sendX` as it is spelled in src/lib/auth/email.ts, so that " +
        "adding one and forgetting the prose fails here.",
    ).toEqual([]);
  });
});

function templates(): string[] {
  const email = readFileSync(
    join(ROOT, "src", "lib", "auth", "email.ts"),
    "utf8",
  );
  return (email.match(/^export async function (send\w+)/gm) ?? []).map((line) =>
    line.replace("export async function ", ""),
  );
}
