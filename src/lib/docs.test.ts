import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
 */

const ROOT = join(import.meta.dirname, "..", "..");
const DOCS = join(ROOT, "docs");

function docFiles(): string[] {
  return readdirSync(DOCS)
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(DOCS, name));
}

function allProse(): { file: string; text: string }[] {
  return [
    { file: "README.md", text: readFileSync(join(ROOT, "README.md"), "utf8") },
    {
      file: "DESIGN.md",
      text: readFileSync(join(ROOT, "DESIGN.md"), "utf8"),
    },
    ...docFiles().map((file) => ({
      file: file.replace(ROOT, ""),
      text: readFileSync(file, "utf8"),
    })),
  ];
}

describe("the documentation refers to things that exist", () => {
  /*
   * Catches a rename or a deletion, which is the commonest way a document
   * starts lying: the explanation stays plausible while the path it points
   * at has moved.
   */
  it("every src/ and scripts/ path mentioned is real", () => {
    const broken: string[] = [];
    for (const { file, text } of allProse()) {
      /*
       * `.mts` matters and was missing from the first version of this
       * pattern — every operational script in this repository uses it, so
       * the check silently covered nothing it was written for. Caught by
       * renaming a referenced file and finding the test still green.
       */
      const paths = text.match(
        /(?:src|scripts)\/[\w./[\]-]+\.(?:mts|mjs|tsx?)/g,
      );
      for (const path of new Set(paths ?? [])) {
        if (!existsSync(join(ROOT, path))) {
          broken.push(`${file} → ${path}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("every npm script mentioned is defined", () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const defined = new Set(Object.keys(pkg.scripts));

    const missing: string[] = [];
    for (const { file, text } of allProse()) {
      /*
       * The trailing-argument form matters and was missing: the pattern
       * required a backtick straight after the name, so `npm run smoke:email
       * -- you@example.com` and `npm run mint-link -- you@…` were invisible.
       * Those two are the break-glass commands — the ones read while
       * something is already broken — and they were the only ones unchecked.
       */
      for (const match of text.matchAll(/`npm run ([\w:-]+)(?: --[^`]*)?`/g)) {
        const [, name] = match;
        if (name !== undefined && !defined.has(name)) {
          missing.push(`${file} → npm run ${name}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("counts stated in prose match the code", () => {
  /*
   * "Six templates" survived the addition of a seventh. A number in prose is
   * the most checkable claim there is and the easiest to leave behind.
   */
  it("the stated number of email templates is right", () => {
    /*
     * Two files now, and the count is their sum. The subscriber-facing three
     * moved to `lib/subscribers/email.ts` when `auth/email.ts` hit this
     * project's ceiling on file length — and a counter that kept reading one
     * file would have reported the split as three deleted templates, which is
     * exactly the kind of confidently wrong number this test exists to catch.
     */
    const sources = [
      join(ROOT, "src", "lib", "auth", "email.ts"),
      join(ROOT, "src", "lib", "subscribers", "email.ts"),
    ].map((file) => readFileSync(file, "utf8"));
    const actual = sources.reduce(
      (total, text) =>
        total + (text.match(/^export async function send/gm) ?? []).length,
      0,
    );

    const words: Record<number, string> = {
      5: "five",
      6: "six",
      7: "seven",
      8: "eight",
      9: "nine",
      10: "ten",
      11: "eleven",
    };
    const expected = words[actual];
    expect(expected, `no word for ${actual} templates`).toBeDefined();

    const wrong: string[] = [];
    for (const { file, text } of allProse()) {
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
});
