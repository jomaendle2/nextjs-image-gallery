import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allSourceFiles, read, SRC } from "./source-text";

/**
 * Invariants about copy that states a policy value.
 *
 * A sibling of `security.test.ts`, split off for the reason the interface and
 * location files were: that file is at its line limit, and these checks are
 * about a different failure. The others ask whether the code does the safe
 * thing. These ask whether the *sentences* still describe what the code does —
 * a question that only became interesting once a wrong answer had been sitting
 * in a published privacy policy for months.
 */
/**
 * I12 — a stated link duration is derived from the constant, never retyped.
 *
 * `LOGIN_TTL_MINUTES` was raised to an hour and six sentences went on saying
 * fifteen minutes: both halves of the sign-in mail, both halves of the
 * membership welcome, the break-glass script, and — worst — the privacy
 * policy, where a wrong number is a wrong retention claim sitting in the same
 * paragraph as the ten-year tax statement. The code comment recording *why*
 * the constant had to change was already there; the copy never followed, so
 * the bug simply reversed direction.
 *
 * Per `source-text.ts`'s own rule: when this fires on ordinary prose, the fix
 * is to reword the sentence so it does not state a number, or to interpolate
 * the constant. Widening the exceptions defeats the control.
 */
describe("I12 — a link's lifetime is stated from LOGIN_TTL_MINUTES", () => {
  /*
   * Prose about a *link* and a literal count of minutes, in either order and
   * within one sentence of each other. The rate limiter also counts minutes,
   * and legitimately says so — it is about a window, not a link, so it never
   * puts the two within a sentence of one another.
   */
  const SPELLED =
    "one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|sixty";
  const STATED = new RegExp(
    `(?:link[^.]{0,80}?(?:${SPELLED}|\\d+)\\s+minutes` +
      `|(?:${SPELLED}|\\d+)\\s+minutes[^.]{0,80}?link)`,
    "i",
  );

  it("no source file retypes a sign-in link's lifetime", () => {
    const offenders = allSourceFiles()
      .map((file) => ({ file, source: readFileSync(file, "utf8") }))
      /*
       * The one file allowed to say a number out loud is the one that
       * defines it. Its docblocks are where the history lives — including
       * the sentence recording that fifteen minutes was wrong — and that
       * record is the reason the constant exists. Selecting it by the
       * declaration rather than by path means the exception moves with the
       * constant instead of rotting into a stale allow-list entry.
       */
      .filter(({ source }) => !/export const LOGIN_TTL_MINUTES/.test(source))
      .filter(({ source }) => STATED.test(source))
      .map(({ file }) => file.replace(SRC, ""));

    expect(offenders).toEqual([]);
  });

  /*
   * The other half: the two mails and the policy must actually interpolate
   * it, so this stays a derivation rather than a sentence that quietly
   * stopped mentioning a duration at all.
   */
  it("the mails and the privacy policy interpolate the constant", () => {
    for (const source of [
      read("lib", "auth", "email.ts"),
      read("app", "privacy", "page.tsx"),
    ]) {
      expect(source).toContain("LOGIN_TTL_MINUTES");
    }
  });
});
