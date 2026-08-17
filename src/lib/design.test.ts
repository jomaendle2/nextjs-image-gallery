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

  /*
   * DESIGN.md: "the only colour in the viewer comes from the photograph."
   *
   * The rule most likely to be broken by accident, because the accent is
   * legal three directories away on every reading page and a component moved
   * into the viewer brings its classes with it. The details panel was exactly
   * that move — six pieces of chrome went from the caption bar into a Sheet,
   * and a Sheet is the sort of thing that arrives from a component library
   * already coloured.
   */
  it("the viewer introduces no colour of its own", () => {
    const offenders = allSourceFiles()
      .filter((file) => file.includes(join(SRC, "components", "gallery")))
      .filter((file) =>
        /\b(?:text|bg|border|outline)-accent/.test(readFileSync(file, "utf8")),
      )
      .map((file) => file.replace(SRC, ""));

    expect(offenders).toEqual([]);
  });
});

describe("text stays readable on the ground", () => {
  /*
   * Measured rather than asserted by taste. Compositing white at alpha over
   * `--ground` (#0b0e12) and computing relative luminance both sides gives:
   *
   *   white/30 ≈ 2.3:1   white/35 ≈ 2.9:1
   *   white/40 ≈ 3.8:1   white/45 ≈ 4.2:1   white/55 ≈ 5.3:1
   *
   * WCAG AA wants 4.5:1 for normal text, and nearly every one of these was
   * on 11px uppercase metadata — nowhere near the large-text exemption. The
   * site had 57 of them, including the legal footer and the hint under every
   * form field.
   */
  const TOO_FAINT = /text-white\/(?:1\d|2\d|3\d|4[0-5])\b/;

  it("no text uses an opacity below the AA floor", () => {
    const offenders: string[] = [];

    for (const file of allSourceFiles()) {
      const lines = readFileSync(file, "utf8").split("\n");

      const faint = lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => TOO_FAINT.test(line))
        /*
         * Decoration is exempt, and rightly: the separators and arrows this
         * catches are `aria-hidden`, carry no information, and raising them
         * to a text weight would put a slash in competition with the words
         * on either side of it. WCAG 1.4.3 says the same about incidental
         * content. The attribute is usually a line or two above the class,
         * so the window looks back a little rather than at one line.
         */
        .filter(({ index }) =>
          lines
            .slice(Math.max(0, index - 3), index + 1)
            .every((near) => !near.includes("aria-hidden")),
        )
        .map(({ line }) => TOO_FAINT.exec(line)?.[0] ?? "");

      if (faint.length > 0) {
        offenders.push(
          `${file.replace(SRC, "")} → ${[...new Set(faint)].join(", ")}`,
        );
      }
    }

    expect(
      offenders,
      "Use text-white/55 or higher. Below that it fails WCAG AA on this " +
        "background, and the small uppercase metadata is where it hurts most.",
    ).toEqual([]);
  });
});

describe("state colour comes from the tokens too", () => {
  /*
   * `design.test.ts` forbade hex and nothing else, so forty-three Tailwind
   * palette utilities walked straight past it: three treatments of the same
   * published/draft badge, and the destructive button copied verbatim into
   * three files. A rule that catches one spelling of a mistake and not the
   * other is most of the way to no rule.
   */
  const PALETTE =
    /\b(?:bg|text|border)-(?:red|amber|emerald|green|blue|yellow|orange|rose|sky|teal)-\d/;

  it("no component reaches for a Tailwind palette colour", () => {
    const offenders = allSourceFiles()
      .filter((file) => PALETTE.test(readFileSync(file, "utf8")))
      .map((file) => file.replace(SRC, ""));

    expect(
      offenders,
      "Use the danger / caution / positive tokens in globals.css, or add a " +
        "state there first. The palette is not the design system.",
    ).toEqual([]);
  });

  it("the destructive button is a variant, not a class run", () => {
    const button = readFileSync(
      join(SRC, "components", "ui", "glass-button.tsx"),
      "utf8",
    );
    expect(button).toContain('variant === "danger"');

    /*
     * Two files own a danger fill: the button, and `Notice`, which is the
     * component every message goes through. Anywhere else means somebody
     * built a third way to say "this is destructive".
     */
    const owners = [
      join("/components", "ui", "glass-button.tsx"),
      join("/components", "ui", "Notice.tsx"),
    ];
    const offenders = allSourceFiles()
      .filter((file) =>
        /bg-danger-fill(?!-hover)/.test(readFileSync(file, "utf8")),
      )
      .map((file) => file.replace(SRC, ""))
      .filter((file) => !owners.includes(file));

    expect(offenders).toEqual([]);
  });
});
