import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allSourceFiles, SRC } from "./source-text";

/**
 * The design system, as the few rules a test can actually hold.
 *
 * `DESIGN.md` describes the whole thing; most of it — when the accent is
 * earned, whether a colour means anything — is judgement no test reaches.
 * What a test can hold is the mechanical half, and the mechanical half is
 * where this codebase has actually drifted: a near-black copied into three
 * files and typed slightly differently in a fourth, a teal in the manifest
 * that no longer matched the layout, a sea-teal chosen by eye in one
 * component and derived by measurement in another.
 *
 * So: colours live in `globals.css`. A component that needs one reads a
 * token. The exceptions below are real and each is a place where CSS custom
 * properties genuinely do not reach.
 */

/**
 * Files allowed to write a colour literal, and why.
 *
 * Every entry here is a context with no stylesheet. Adding to this list is
 * a decision — if a file can see the stylesheet, it can read a token, and
 * the reason to want a literal instead is almost always that the token does
 * not exist yet.
 */
const NO_STYLESHEET = new Map<string, string>([
  [
    join("/app", "layout.tsx"),
    "the themeColor meta tag is a literal by definition; manifest.test.ts pins it to --ground",
  ],
  [
    join("/app", "manifest.ts"),
    "a web manifest is JSON, not CSS; manifest.test.ts pins it to --ground",
  ],
  [
    join("/app", "global-error.tsx"),
    "replaces the whole document when the root layout has failed, so it cannot assume the stylesheet loaded",
  ],
  [
    join("/app", "api", "og", "route.tsx"),
    "rendered by Satori into an image; there is no CSS at all",
  ],
  [
    join("/lib", "auth", "email.ts"),
    "email HTML, where custom properties are unsupported by most clients",
  ],
  [join("/lib", "announcement.ts"), "email HTML, as above"],
]);

const HEX = /#[0-9a-fA-F]{3,8}\b/g;

describe("colour lives in the stylesheet", () => {
  it("no component writes a colour literal", () => {
    const offenders: string[] = [];

    const checked = allSourceFiles()
      .map((file) => ({ file, relative: file.replace(SRC, "") }))
      .filter(({ relative }) => !NO_STYLESHEET.has(relative));

    for (const { file, relative } of checked) {
      const found = readFileSync(file, "utf8").match(HEX);
      if (found !== null) {
        offenders.push(`${relative} → ${[...new Set(found)].join(", ")}`);
      }
    }

    expect(
      offenders,
      "Add the colour to globals.css as a token and read it here, or add " +
        "this file to NO_STYLESHEET with the reason it cannot use one.",
    ).toEqual([]);
  });
});

describe("the accent is used through the system, not around it", () => {
  const button = readFileSync(
    join(SRC, "components", "ui", "glass-button.tsx"),
    "utf8",
  );

  /*
   * The rule that keeps "one primary action per view" possible: if the
   * accent can be spelled out in a className anywhere, then whether a button
   * is primary stops being a property of the button and becomes a thing each
   * page decides again.
   */
  it("the primary variant is where the accent fill is defined", () => {
    expect(button).toContain('variant === "primary"');
    expect(button).toContain("bg-accent-fill");
  });

  it("no page hand-rolls the primary button's fill", () => {
    const offenders = allSourceFiles()
      .filter((file) => !file.endsWith(join("ui", "glass-button.tsx")))
      .filter((file) => /bg-accent-fill(?!-)/.test(readFileSync(file, "utf8")))
      .map((file) => file.replace(SRC, ""));

    // membership-details.tsx is the documented exception: its Row icons use
    // the fill as a tone marker, which is not a button.
    expect(offenders).toEqual([
      join("/app", "membership", "membership-details.tsx"),
    ]);
  });
});
