import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { brokenRefs, exists, NPM_SCRIPT, prose, SRC_PATH } from "./doc-text";
import { ROOT, read } from "./source-text";

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
 * This file holds the claims a document makes about the code: a path, a
 * command, a count. Pointers between documents, pointers from code back into
 * the documentation, and the shape of the tree are in `docs-tree.test.ts`.
 */

describe("the documentation refers to things that exist", () => {
  /*
   * Catches a rename or a deletion, which is the commonest way a document
   * starts lying: the explanation stays plausible while the path it points
   * at has moved.
   */
  it("every src/ and scripts/ path mentioned is real", () => {
    /*
     * `.mts` matters and was missing from the first version of this pattern —
     * every operational script in this repository uses it, so the check
     * silently covered nothing it was written for. Caught by renaming a
     * referenced file and finding the test still green.
     */
    expect(brokenRefs(prose(), SRC_PATH, exists)).toEqual([]);
  });

  it("every npm script mentioned is defined", () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
    };
    const defined = new Set(Object.keys(pkg.scripts));

    /*
     * The trailing-argument form matters and was missing: the pattern
     * required a backtick straight after the name, so `npm run smoke:email
     * -- you@example.com` and `npm run mint-link -- you@…` were invisible.
     * Those two are the break-glass commands — the ones read while
     * something is already broken — and they were the only ones unchecked.
     */
    expect(
      brokenRefs(prose(), NPM_SCRIPT, (name) => defined.has(name)),
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
    11: "eleven",
    12: "twelve",
  };

  it("the stated number of email templates is right", () => {
    const actual = templates().length;
    const expected = words[actual];
    expect(expected, `no word for ${actual} templates`).toBeDefined();

    const wrong: string[] = [];
    for (const { file, text } of prose()) {
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

    for (const { file, text } of prose()) {
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

/**
 * Every message the site can send, by the name of the function that sends it.
 *
 * Two files, and the count is their sum. The subscriber-facing three moved to
 * `lib/subscribers/email.ts` when `auth/email.ts` hit this project's ceiling
 * on file length — and a counter that kept reading one file would have
 * reported that split as three deleted templates, which is exactly the kind
 * of confidently wrong number this test exists to catch.
 *
 * A third home is a matter of time, so the list is here rather than inline:
 * adding one is a single line, and forgetting to is the failure above.
 */
const TEMPLATE_SOURCES = [
  ["lib", "auth", "email.ts"],
  ["lib", "subscribers", "email.ts"],
];

function templates(): string[] {
  return TEMPLATE_SOURCES.flatMap((parts) =>
    (read(...parts).match(/^export async function (send\w+)/gm) ?? []).map(
      (line) => line.replace("export async function ", ""),
    ),
  );
}
