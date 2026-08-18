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

/**
 * The same rule for the upload cap, which had grown eight homes.
 *
 * Three constants (`token/route.ts`, `draft/route.ts`, `UploadForm.tsx`) and
 * five sentences — two on screen, two error messages, one in the contributor
 * guide — all saying 25 MB independently. Raising it meant being right in
 * eight places at once, which is the shape of change that is quietly wrong in
 * one of them.
 *
 * Named files rather than a sweep of all of them, unlike I12. A sweep would
 * have to forbid the characters "MB" in prose, and two files legitimately
 * observe that the stored originals are 9–13 MB while a third enforces an
 * unrelated payload limit — so the sweep would punish accurate sentences
 * about different numbers. The control here is narrower than the copy rule:
 * these three files, and only these, decide what the site accepts.
 */
describe("the upload cap is stated from MAX_UPLOAD_BYTES", () => {
  const ENFORCERS = [
    ["app", "api", "uploads", "token", "route.ts"],
    ["app", "api", "photos", "draft", "route.ts"],
    ["app", "contribute", "photos", "UploadForm.tsx"],
  ];

  it("every file that enforces a size reads the one constant", () => {
    for (const parts of ENFORCERS) {
      expect(read(...parts)).toContain("MAX_UPLOAD_BYTES");
    }
  });

  it("none of them computes a byte limit of its own", () => {
    for (const parts of ENFORCERS) {
      /*
       * `n * 1024 * 1024` is how all three used to spell it, and is the only
       * form in which a second cap could plausibly reappear here.
       */
      expect(read(...parts)).not.toMatch(/\d+\s*\*\s*1024\s*\*\s*1024/);
    }
  });

  it("the two messages a person reads derive the number", () => {
    // Not a literal, or the sentence and the limit drift the way the sign-in
    // link's expiry did — six sentences wrong for months.
    expect(read("app", "api", "photos", "draft", "route.ts")).toContain(
      "${MAX_UPLOAD_MB} MB",
    );
    expect(read("app", "contribute", "photos", "UploadForm.tsx")).toContain(
      "MAX_UPLOAD_MB",
    );
  });
});
