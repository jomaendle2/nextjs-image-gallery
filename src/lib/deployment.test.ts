import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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
