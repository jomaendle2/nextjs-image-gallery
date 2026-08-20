import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { afterEach, describe, expect, it } from "vitest";
import { deploymentEnv, isProduction, onVercel } from "./deployment";
import { code, codeUnder, ROOT, rel } from "./source-text";

/**
 * One reading of the deployment environment, and only one.
 *
 * `VERCEL_ENV` was read in five modules with five predicates — the view-count
 * gate, the environment banner, the AI gateway's one-time warning, the
 * production preflight and the migration guard — and three of them carried
 * their own paragraph explaining the same two facts about what the platform
 * reports. `docs/roadmap.md` had `membershipConfigured()` on it as "four
 * mechanisms for one boolean" with "a fifth mechanism" as the trigger, and
 * this went past it.
 *
 * The count is the whole invariant. Nothing here can tell whether a predicate
 * is *right*; what it can do is stop there being six of them to check.
 */

const READS = /process\.env\[\s*["']VERCEL_ENV["']\s*\]/;
const HOME = "src/lib/deployment.ts";

/**
 * The other variable, and the three places allowed to ask about it.
 *
 * `NODE_ENV === "production"` reads like a fourth copy of `isProduction()`
 * and answers a different question — `next build` sets it for any built
 * deployment, preview included. `deployment.ts` says at length why both of
 * these callers want that broader answer.
 *
 * A list rather than a ban, because the ones that exist are correct. What
 * this stops is a sixth predicate arriving under the other spelling, after
 * the five under the first one were consolidated.
 *
 * `security.test.ts` is in it because invariant I9 asserts on the literal:
 * the check that the mail refusal exists has to name the thing it is
 * checking. A test quoting the pattern it pins is the same exemption
 * `source-text.ts` describes, and it is named rather than waved through by a
 * blanket exclusion for test files — the list is the control.
 */
const BUILD_MODE =
  /process\.env\[\s*["']NODE_ENV["']\s*\]\s*===\s*["']production["']/;
const BUILD_MODE_HOMES = [
  "src/lib/auth/mailer.ts",
  "src/lib/auth/session.ts",
  "src/lib/security.test.ts",
];

describe("the deployment environment is read in one place", () => {
  it("only the deployment module names the variable", () => {
    const files = [
      ...codeUnder(join(ROOT, "src")),
      ...codeUnder(join(ROOT, "scripts")),
    ];

    /*
     * Comments stripped: three files explain at length why the variable
     * behaves as it does, and a check that punishes explaining the rule is a
     * check that gets the explanation deleted. `source-text.ts` records that
     * lesson; this is the fourth test to need it.
     */
    const readers = files
      .filter((file) => READS.test(code(readFileSync(file, "utf8"))))
      .map(rel)
      .filter((file) => !file.endsWith("deployment.test.ts"));

    expect(
      readers,
      "Import isProduction() or deploymentEnv() from @/lib/deployment " +
        "instead. A sixth predicate is how the five disagreed.",
    ).toEqual([HOME]);
  });
});

/**
 * What each predicate does with a value nobody planned for.
 *
 * The three of them read one variable and disagree about it on purpose, and
 * the disagreement is the part worth pinning: `deploymentEnv()` narrows to
 * what it recognises, `onVercel()` asks only whether the platform is there.
 * Collapsing those is not a style question — `migrate.mts` read the narrowed
 * one, so a `VERCEL_ENV` outside the three known strings looked exactly like
 * a laptop and would have run every statement in `MIGRATIONS` against the
 * shared database from a branch build.
 *
 * Vercel Custom Environments set the variable to the environment's own name,
 * which is how a fourth value gets here: a dashboard setting, not a platform
 * rewrite.
 */
describe("an unrecognised deployment is still a deployment", () => {
  const original = process.env["VERCEL_ENV"];

  afterEach(() => {
    if (original === undefined) {
      delete process.env["VERCEL_ENV"];
    } else {
      process.env["VERCEL_ENV"] = original;
    }
  });

  it("reports no platform only when the variable is absent", () => {
    delete process.env["VERCEL_ENV"];
    expect(onVercel()).toBe(false);

    for (const value of ["production", "preview", "development", "staging"]) {
      process.env["VERCEL_ENV"] = value;
      expect(onVercel(), `${value} is a deployment`).toBe(true);
    }
  });

  it("names only the three environments it knows", () => {
    for (const value of ["production", "preview", "development"]) {
      process.env["VERCEL_ENV"] = value;
      expect(deploymentEnv()).toBe(value);
    }

    process.env["VERCEL_ENV"] = "staging";
    expect(deploymentEnv()).toBeUndefined();
    expect(isProduction()).toBe(false);
  });

  it("only the cookie flag and the mail refusal ask about the build mode", () => {
    const asking = [
      ...codeUnder(join(ROOT, "src")),
      ...codeUnder(join(ROOT, "scripts")),
    ]
      .filter((file) => BUILD_MODE.test(code(readFileSync(file, "utf8"))))
      .map(rel)
      .filter((file) => !file.endsWith("deployment.test.ts"));

    expect(
      asking.sort((a, b) => a.localeCompare(b)),
      "NODE_ENV is true on a preview build and isProduction() is not. See " +
        "the note in src/lib/deployment.ts before adding a third.",
    ).toEqual(BUILD_MODE_HOMES);
  });

  /*
   * The gate itself, because the predicates being right is only half of it —
   * the bug was a correct function called from the wrong question.
   */
  it("the migration gate asks whether a platform is there", () => {
    const migrate = code(
      readFileSync(join(ROOT, "scripts", "migrate.mts"), "utf8"),
    );
    expect(migrate).toContain("!onVercel()");
    expect(
      migrate,
      "deploymentEnv() answers undefined for a value it does not " +
        "recognise, which reads as 'no platform' and is how a branch build " +
        "would migrate production.",
    ).not.toContain("deploymentEnv() === undefined");
  });
});
