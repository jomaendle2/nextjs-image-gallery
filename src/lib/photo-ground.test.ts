import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { photoGround, tintStrength } from "./photo-ground";

/**
 * What the ground promises: it stays a ground.
 *
 * `photoGround` mixes a photograph's own colour into the page, and the whole
 * argument for doing more of it is that a near-black page wastes the colour
 * the photograph already has. The argument against doing too much of it is
 * that every caption, every piece of metadata and the whole bottom bar are
 * read on top of the result.
 *
 * `design.test.ts` pins the faint-text floor at `text-white/55` and derived
 * it against the bare `--ground` token. It greps class names, so it cannot
 * see that the text is not actually on that token — it is on this mix. This
 * file closes that gap by doing the mix for real and measuring what comes
 * out, which is the only way the floor means anything on the viewer.
 */

/** `--ground`, read from the stylesheet rather than repeated here. */
function ground(): [number, number, number] {
  const css = readFileSync(
    join(import.meta.dirname, "../app/globals.css"),
    "utf8",
  );
  const hex = /--ground:\s*#([0-9a-f]{6})/i.exec(css)?.[1];
  if (hex === undefined) {
    throw new Error("--ground is no longer a six-digit hex in globals.css");
  }
  return channels(hex);
}

function channels(hex: string): [number, number, number] {
  return [0, 2, 4].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)) as [
    number,
    number,
    number,
  ];
}

const toLinear = (c: number): number =>
  c / 255 <= 0.040_45 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4;

const toSrgb = (c: number): number =>
  Math.max(
    0,
    Math.min(
      255,
      Math.round(
        255 * (c <= 0.003_130_8 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055),
      ),
    ),
  );

/** sRGB bytes → oklab, the space `color-mix(in oklab, …)` interpolates in. */
function toOklab([r, g, b]: [number, number, number]): [
  number,
  number,
  number,
] {
  const [lr, lg, lb] = [r, g, b].map(toLinear) as [number, number, number];
  const l = Math.cbrt(
    0.412_221_470_8 * lr + 0.536_332_536_3 * lg + 0.051_445_992_9 * lb,
  );
  const m = Math.cbrt(
    0.211_903_498_2 * lr + 0.680_699_545_1 * lg + 0.107_396_956_6 * lb,
  );
  const s = Math.cbrt(
    0.088_302_461_9 * lr + 0.281_718_837_6 * lg + 0.629_978_700_5 * lb,
  );
  return [
    0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s,
    1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s,
    0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s,
  ];
}

function toRgb([L, a, b]: [number, number, number]): [number, number, number] {
  const l = (L + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
  const m = (L - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
  const s = (L - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;
  return [
    4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
    -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
    -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
  ].map(toSrgb) as [number, number, number];
}

/** The colour the browser actually paints for a given strength. */
function mixed(hex: string, strength: number): [number, number, number] {
  const photo = toOklab(channels(hex.slice(1)));
  const base = toOklab(ground());
  const t = strength / 100;
  return toRgb([
    photo[0] * t + base[0] * (1 - t),
    photo[1] * t + base[1] * (1 - t),
    photo[2] * t + base[2] * (1 - t),
  ]);
}

const luminance = ([r, g, b]: [number, number, number]): number =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

/** `text-white/55` composited onto a background, against that background. */
function faintTextContrast(bg: [number, number, number]): number {
  const text = bg.map((c) => 255 * 0.55 + c * 0.45) as [number, number, number];
  const [light, dark] = [luminance(text), luminance(bg)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/**
 * Every colour the gallery has actually produced, plus the ends.
 *
 * The real ones matter because they are what the derive step emits from real
 * photographs; the invented ones matter because nothing stops a future
 * photograph from being whiter than any of these, and the promise has to hold
 * for the photograph nobody has taken yet.
 */
const PUBLISHED = [
  "#080808",
  "#136aa0",
  "#181818",
  "#191815",
  "#2184ab",
  "#2a6b7c",
  "#2a88a3",
  "#2e4d4d",
  "#3a5c7b",
  "#446165",
  "#4c566e",
  "#4c80b7",
  "#4c89a1",
  "#4d623c",
  "#646378",
  "#663829",
  "#6898b8",
  "#6a4332",
  "#7eb7e2",
  "#87abab",
  "#a87858",
  "#a8b8c8",
  "#b88868",
  "#b8c8d8",
  "#c8c8c8",
  "#c8d8f8",
  "#e8e8e8",
  "#e8f8f8",
];

const EXTREMES = ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff"];

describe("the ground stays readable", () => {
  it.each([...PUBLISHED, ...EXTREMES])(
    "keeps faint text past the AA floor on %s",
    (hex) => {
      expect(faintTextContrast(mixed(hex, tintStrength(hex)))).toBeGreaterThan(
        4.5,
      );
    },
  );

  /*
   * The flat 26 this replaced, on the palest photograph in the gallery. Kept
   * as a test rather than a note because it is the whole reason the strength
   * became a curve: the number everybody assumed was conservative was
   * already under the floor, and only for the photographs nobody checked.
   */
  it("records that the old flat strength was already too light", () => {
    expect(faintTextContrast(mixed("#e8f8f8", 26))).toBeLessThan(4.5);
  });
});

describe("the ground shows the photograph", () => {
  it("gives a dark, saturated photograph the full tint", () => {
    // Looking Up — the cherry blossom against deep blue.
    expect(tintStrength("#136aa0")).toBe(50);
  });

  it("holds a pale photograph back", () => {
    // Glacier Flow, which is nearly white and cannot take half a page of it.
    expect(tintStrength("#e8f8f8")).toBeLessThan(30);
  });

  it("never drops below the strength pure white would get", () => {
    const floor = tintStrength("#ffffff");
    for (const hex of PUBLISHED) {
      expect(tintStrength(hex)).toBeGreaterThanOrEqual(floor);
    }
  });

  it("lifts every photograph at least as far as the flat tint it replaced", () => {
    /*
     * Except the pale ones, which is the point — this asserts the change is
     * a lift for the photographs the complaint was about, not a wash for
     * everything.
     */
    const lifted = PUBLISHED.filter((hex) => tintStrength(hex) > 26);
    expect(lifted.length).toBeGreaterThan(PUBLISHED.length / 2);
  });
});

describe("photoGround", () => {
  it("mixes toward the token so the stylesheet stays the one source", () => {
    expect(photoGround("#136aa0")).toBe(
      "color-mix(in oklab, #136aa0 50%, var(--ground))",
    );
  });

  it("takes the safe floor for a colour it cannot read", () => {
    // `--color-accent` and friends: valid CSS, not a hex, not measurable.
    expect(photoGround("var(--color-accent)")).toContain("21%");
  });
});
