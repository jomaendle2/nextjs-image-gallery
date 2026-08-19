import process from "node:process";

/**
 * Which deployment this is, in one place.
 *
 * `VERCEL_ENV` was read in five modules with five predicates, and three of
 * them carried their own paragraph explaining the same two facts: that a
 * preview reports `"preview"`, and that a local `next dev` reports nothing at
 * all. Three copies of an explanation is three chances to be wrong about it
 * the day the platform adds a fourth value — and this repository already has
 * `membershipConfigured()` on its roadmap as "four mechanisms for one
 * boolean", with "a fifth mechanism" as the stated trigger. The view-count
 * gate was the fifth.
 *
 * Read at call time rather than captured at module scope. `scripts/` imports
 * this, and a script sets its environment from `--env-file` as it starts, so
 * a value frozen when the module loaded would be the wrong one.
 */

/**
 * What the platform calls this deployment.
 *
 * `"development"` is `vercel dev` — a Vercel deployment that happens to be on
 * a laptop — and is *not* the same as `undefined`, which means no Vercel at
 * all: `npm run dev`, a test run, or an operational script on somebody's
 * machine. `scripts/migrate.mts` turns on exactly that difference, so the two
 * must not be collapsed for tidiness.
 */
export type DeploymentEnv = "production" | "preview" | "development";

export function deploymentEnv(): DeploymentEnv | undefined {
  const value = process.env["VERCEL_ENV"];
  return value === "production" ||
    value === "preview" ||
    value === "development"
    ? value
    : undefined;
}

/**
 * The live site, and nothing else.
 *
 * Every caller wants this one: preview and a laptop are both "somebody
 * looking at their own work", whether the question is sending mail, spending
 * a gateway credential, or adding to a photographer's view count.
 */
export function isProduction(): boolean {
  return deploymentEnv() === "production";
}
