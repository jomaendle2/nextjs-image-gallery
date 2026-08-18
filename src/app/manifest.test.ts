import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The four places one colour is written down.
 *
 * `--ground` in the stylesheet is the colour the viewer sits on. The root
 * layout repeats it as `themeColor` so browser chrome matches, the web
 * manifest repeats it again as `theme_color` and `background_color` so an
 * installed app's toolbar and splash do too, and `/api/og` repeats it a
 * fourth time as the card's background. Nothing in the language ties the
 * four together: the manifest is a plain object, the viewport export is a
 * plain object, and the stylesheet is text.
 *
 * The OG route's literal is legitimate — Satori has no CSS, which is why
 * that file sits on `design.test.ts`'s stylesheet exemption list — but a
 * colour nothing checks is a colour that drifts, and the social card is the
 * one surface where drift is seen by people who have never opened the site.
 *
 * So they drifted. The manifest carried the teal fallback tint while
 * claiming in a comment to match the layout, which meant a home-screen
 * install showed teal chrome over a near-black splash over a near-black
 * gallery — the flash of the wrong colour the manifest exists to prevent.
 *
 * A comment asserting an invariant is a wish. This is the invariant.
 */

const ROOT = join(import.meta.dirname, "..", "..");

function read(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

describe("the ground colour is one colour", () => {
  const ground = /--ground:\s*(#[0-9a-f]{6})/i.exec(
    read("src", "app", "globals.css"),
  )?.[1];

  it("is defined in the stylesheet", () => {
    expect(ground).toBeDefined();
  });

  it("the layout's themeColor matches --ground", () => {
    const layout = /themeColor:\s*"(#[0-9a-f]{6})"/i.exec(
      read("src", "app", "layout.tsx"),
    )?.[1];
    expect(layout?.toLowerCase()).toBe(ground?.toLowerCase());
  });

  it("the manifest's theme_color and background_color match it too", () => {
    const manifest = read("src", "app", "manifest.ts");
    const theme = /theme_color:\s*"(#[0-9a-f]{6})"/i.exec(manifest)?.[1];
    const background = /background_color:\s*"(#[0-9a-f]{6})"/i.exec(
      manifest,
    )?.[1];

    expect(theme?.toLowerCase()).toBe(ground?.toLowerCase());
    expect(background?.toLowerCase()).toBe(ground?.toLowerCase());
  });

  it("the OG card's background matches it too", () => {
    const og = /GROUND\s*=\s*"(#[0-9a-f]{6})"/i.exec(
      read("src", "app", "api", "og", "route.tsx"),
    )?.[1];
    expect(og?.toLowerCase()).toBe(ground?.toLowerCase());
  });
});
