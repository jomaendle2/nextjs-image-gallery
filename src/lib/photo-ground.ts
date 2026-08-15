/**
 * The ground every photograph sits on.
 *
 * One function so the viewer and the grid cannot drift apart again — they
 * previously ran a saturated tint and a flat near-black respectively, which
 * made one photographer's two pages feel like two different sites.
 *
 * The tint survives, but as a breath rather than a wash. At 76% the colour
 * field competed with the photograph for attention and read as a themed UI;
 * pulled back to a quarter, the page is near-black with the photograph's own
 * colour just perceptible in it, and the photograph is the only saturated
 * thing on screen.
 */

/** Near-black with a trace of blue, so the tint has something to sit in. */
export const GROUND = "#0b0e12";

const TINT_STRENGTH = 26;

export function photoGround(bgColor: string): string {
  return `color-mix(in oklab, ${bgColor} ${TINT_STRENGTH}%, ${GROUND})`;
}

/**
 * A wider, softer version of the same colour for ambient washes behind
 * content — the grid uses it so its ground reads as lit from above like the
 * viewer's, rather than flat.
 */
export function photoGlow(bgColor: string): string {
  return `color-mix(in oklab, ${bgColor} 38%, transparent)`;
}
