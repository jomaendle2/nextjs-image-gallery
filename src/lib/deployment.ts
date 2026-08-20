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
 * Whether the platform is running this at all, whatever it calls it.
 *
 * Not `deploymentEnv() !== undefined`, and the difference is the whole reason
 * this exists. `deploymentEnv()` narrows to the three values it knows and
 * answers `undefined` for anything else — which reads identically to "no
 * Vercel at all" while meaning the opposite. Vercel Custom Environments set
 * `VERCEL_ENV` to the environment's own name, so a fourth value is a setting
 * away rather than hypothetical.
 *
 * `migrate.mts` turns on exactly this question: absent means somebody's own
 * machine and their own database, and every other answer is a deployment
 * that must not migrate the shared one on its own say-so. Asking the narrowed
 * function instead let an unrecognised value through as though no platform
 * were there, and the migration list rewrites `exif` and backfills
 * `display_pathname`.
 *
 * So it reads the variable's presence rather than its value, and an
 * unfamiliar platform is treated as a platform. That is the direction that
 * fails closed.
 */
export function onVercel(): boolean {
  return process.env["VERCEL_ENV"] !== undefined;
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

/*
 * A closing note on the other variable, because the next person to tidy this
 * module will find it and think it belongs here.
 *
 * `process.env["NODE_ENV"] === "production"` appears in two files — the
 * `Secure` flag on both session cookies, and the refusal in `auth/email.ts`
 * to print a sign-in link when no mail provider is configured. They read like
 * further copies of `isProduction()` and they are not: `next build` sets
 * `NODE_ENV` to `"production"` for any built deployment, preview included, so
 * it asks "was this compiled for release", not "is this the live site".
 *
 * Both want that broader answer. A preview is served over HTTPS, so its
 * cookie should carry `Secure`; a preview writes to a platform log people can
 * read, so a magic-link token — a valid credential for the life of the link —
 * must not be printed there either. Folding either into `isProduction()`
 * would silently undo it, and neither failure looks like a broken preview.
 *
 * `deployment.test.ts` pins where the spelling may appear, so that a third
 * home has to be argued for rather than added.
 */
