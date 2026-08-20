import process from "node:process";

/**
 * The one third party this site talks to that is not on the critical path.
 *
 * MapTiler AG serves the tiles behind the location picker. Swiss rather than
 * American, which is a simpler processor story for a German operator; the
 * free tier is 100k requests a month, and a key can be restricted to one
 * origin in their dashboard.
 *
 * **Only the contributor upload page ever contacts it.** Nothing on a public
 * page does — invariant I14 in `docs/architecture/security.md` enforces that
 * by asserting exactly one file in the codebase mentions the map library at
 * all. That is what keeps the no-cookie-banner claim on `/privacy` true: the
 * page is behind a session, no cookie is set, and no visitor to the gallery
 * ever reaches MapTiler.
 *
 * `MAPTILER_KEY`, deliberately **not** `NEXT_PUBLIC_MAPTILER_KEY`. A
 * `NEXT_PUBLIC_` variable is inlined into every client bundle by the
 * compiler, including the ones served to anonymous visitors. This is read
 * here, on the server, and handed to the picker as a prop — so the only
 * people who ever receive it are signed-in contributors on the one page that
 * needs it.
 */

/**
 * The style URL for the picker, or `null` when no key is configured.
 *
 * Null rather than a throw, and this is the same argument `scripts/preflight.mts`
 * makes in its own header: a check that blocks a deploy over something
 * deliberately unset teaches people to bypass the check. A gallery with no
 * map key is a gallery whose photographers type coordinates instead, which
 * is a working feature rather than a broken deployment — so `MAPTILER_KEY`
 * is not in `preflight.mts` either.
 *
 * What must not happen is failing *silently*. The picker renders a visible
 * `Notice` when this is null, so a contributor is told the map is
 * unavailable rather than left tapping a blank rectangle. Visible, not
 * silent, is the substance of I9.
 */
export function mapStyleUrl(): string | null {
  const key = process.env["MAPTILER_KEY"];
  if (key === undefined || key === "") {
    return null;
  }
  /*
   * `dataviz-dark`, because the picker sits on a near-black page and a
   * default street map lands on it as a bright rectangle. Nothing else about
   * the choice is load-bearing.
   */
  return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${encodeURIComponent(key)}`;
}
