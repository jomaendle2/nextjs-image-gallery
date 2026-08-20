/**
 * The ground every photograph sits on.
 *
 * One function so the viewer and the grid cannot drift apart again — they
 * previously ran a saturated tint and a flat near-black respectively, which
 * made one photographer's two pages feel like two different sites.
 *
 * The tint is a wash rather than a breath again, but a measured one. At a
 * flat 76% the colour field competed with the photograph; pulled back to a
 * flat 26% the page was near-black and the photograph's own colour barely
 * showed at all. Neither number was wrong for *some* photograph — they were
 * wrong for being one number. A dark, saturated blue can take half the
 * ground and still read as a ground; a pale glacier white cannot take a
 * quarter of it without turning the page into a light-grey UI with unreadable
 * captions. `photoGround` therefore picks the strength from the photograph.
 */

/**
 * Near-black with a trace of blue, so the tint has something to sit in.
 *
 * The literal lives in `globals.css` as `--ground`, because the CSS needs it
 * too — `glass-bar` fills with it. Referencing the custom property rather
 * than repeating the hex keeps the page and the stylesheet from drifting,
 * which is the same failure this module was written to prevent. Only valid
 * in styles that resolve against the document, which is every use here.
 */
export const GROUND = "var(--ground)";

/**
 * The oklab lightness of `--ground`, which the mix has to be solved against.
 *
 * The one number here that `globals.css` also knows, and the only way to
 * choose a strength without it would be to not choose one. It is not pinned
 * by repeating the hex: `photo-ground.test.ts` reads `--ground` out of the
 * stylesheet, does the mix for real and checks the contrast that comes out,
 * so editing the token breaks the test on the thing that actually matters
 * rather than on a number two files agree about.
 */
const GROUND_L = 0.1624;

/**
 * The lightest the ground may become before text stops being readable on it.
 *
 * Measured rather than chosen. `design.test.ts` pins the faint-text floor at
 * `text-white/55`, and derived it by compositing white over `--ground` — 55%
 * white on the bare token is 6.25:1, comfortably past the 4.5:1 WCAG AA
 * wants. But almost no text on the viewer sits on the bare token: it sits on
 * this mix. That test greps class names, so it cannot see the difference and
 * would stay green while the rendered contrast fell by half.
 *
 * So the ceiling was solved for instead. Sweeping every published
 * photograph's colour through `color-mix` in the browser and reading back the
 * composited contrast, the strength at which `white/55` crosses 4.6:1 lands
 * on one lightness across all of them — 0.345, varying by about 0.005 with
 * hue. The conservative end of that spread is the constant.
 *
 *   Looking Up, deep blue behind blossom   L 0.50 → 50% is fine
 *   The Quiraing, pale overcast ridge      L 0.78 → 31% is its most
 *   Glacier Flow, nearly white ice         L 0.96 → 24%
 *
 * The old flat 26 was already over this line for the palest photographs,
 * which is why the fix is a curve and not a bigger number.
 */
const CEILING_L = 0.345;

/**
 * The most tint any photograph gets, and the least.
 *
 * `MAX` is the answer to the actual complaint — a dark photograph's colour
 * should be plainly visible in the page around it, not a rumour. `MIN` is
 * what pure white would be allowed, so it is also the safe answer for a
 * colour this module cannot parse: below it, no photograph can push the
 * ground past the ceiling.
 */
const MAX_TINT = 50;
const MIN_TINT = 21;

/**
 * The oklab lightness of an `#rgb` or `#rrggbb` colour, or null.
 *
 * Only hex, because `bg_color` is only ever hex — it is written by the
 * derive step from the photograph itself, never typed by a person. Anything
 * else returns null and takes the floor rather than guessing, since the one
 * thing worse than a dull backdrop is an unreadable one.
 */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function lightness(color: string): number | null {
  const hex = HEX.exec(color.trim())?.[1];
  if (hex === undefined) {
    return null;
  }

  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;

  /* sRGB → linear, the same curve `design.test.ts` uses for luminance. */
  const [r, g, b] = [0, 2, 4].map((at) => {
    const channel = Number.parseInt(full.slice(at, at + 2), 16) / 255;
    return channel <= 0.040_45
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  /* Linear sRGB → LMS → oklab, of which only L is wanted. */
  const l = Math.cbrt(
    0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b,
  );
  const m = Math.cbrt(
    0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b,
  );
  const s = Math.cbrt(
    0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b,
  );

  return 0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s;
}

/**
 * How much of the photograph's colour this particular photograph may have.
 *
 * `color-mix(in oklab, …)` interpolates lightness linearly, which is what
 * makes this solvable rather than searched: the mix lands at
 * `t·L(photo) + (1 − t)·L(ground)`, so the largest `t` that keeps it under
 * the ceiling falls straight out. A photograph already darker than the
 * ceiling can never breach it and simply takes the maximum.
 *
 * Exported for the test, which checks the promise this makes — that no
 * colour, including ones no camera would produce, can push the ground past
 * the readable ceiling.
 */
export function tintStrength(bgColor: string): number {
  const photo = lightness(bgColor);
  if (photo === null) {
    return MIN_TINT;
  }

  if (photo <= CEILING_L) {
    return MAX_TINT;
  }

  const room = (CEILING_L - GROUND_L) / (photo - GROUND_L);
  return Math.max(MIN_TINT, Math.min(MAX_TINT, Math.floor(room * 100)));
}

export function photoGround(bgColor: string): string {
  return `color-mix(in oklab, ${bgColor} ${tintStrength(bgColor)}%, ${GROUND})`;
}

/**
 * A wider, softer version of the same colour for ambient washes behind
 * content — the grid uses it so its ground reads as lit from above like the
 * viewer's, rather than flat.
 *
 * Deliberately still a flat percentage, and it was checked rather than
 * assumed when `photoGround` stopped being one. This mixes toward
 * `transparent`, not toward the ground, and it is painted as a radial
 * gradient that has already fallen off to nothing by 70% of its box — so the
 * lightest it makes any surface is well under the ceiling above, and the
 * grid's captions sit below the falloff rather than in it. Sharing the curve
 * would mean sharing a solution to a problem this one does not have.
 */
export function photoGlow(bgColor: string): string {
  return `color-mix(in oklab, ${bgColor} 38%, transparent)`;
}

/**
 * The wash to use when there is no photograph to take a colour from.
 *
 * The token, not a literal — `design.test.ts` forbids colour literals in
 * components, and this is the one the accent was derived from anyway.
 */
export const FALLBACK_TINT = "var(--color-accent)";
