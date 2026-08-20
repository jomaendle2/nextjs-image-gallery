import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allSourceFiles, code, SRC } from "./source-text";

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
  [
    join("/lib", "auth", "mailer.ts"),
    "the shell and button every template renders through; email HTML, as above",
  ],
  [join("/lib", "auth", "nudge-copy.ts"), "email HTML, as above"],
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

    /*
     * Two documented exceptions, and both are the same shape: an icon using
     * the fill as a *tone marker*, which is not a button and cannot be
     * confused for one — neither is clickable and neither sits where an
     * action goes.
     *
     * `membership-details.tsx` marks what a membership includes.
     * `StatusPage.tsx` marks whether the thing you came from your inbox to do
     * actually happened; the five pages using it were previously
     * indistinguishable from each other and from a 404.
     */
    expect(offenders).toEqual([
      join("/app", "membership", "membership-details.tsx"),
      join("/components", "StatusPage.tsx"),
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
   *
   * The range runs to 54, so the floor is 55 — which is what the failure
   * message below has always asked for. It used to stop at 45, leaving 46
   * through 54 passing a test that told them in words they were wrong, and
   * three paragraphs had settled in that gap. `BODY_SMALL` in `field.ts` is
   * set at 55 for the same reason; a regex one digit looser than its own
   * argument is not a rule, it is a suggestion with a stern tone.
   */
  const TOO_FAINT = /text-white\/(?:1\d|2\d|3\d|4\d|5[0-4])\b/;

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

/*
 * Everything above this line is about colour, and for a long time that was
 * the whole file — it said so itself: nothing here constrained type size,
 * tracking, uppercase or heading level. Which is exactly why the type drifted
 * where the colour did not. An audit found five treatments for a section
 * heading, body prose at five sizes and four opacities, four spellings of one
 * back-link, and the metadata run re-typed verbatim in two components. Not one
 * of those was a colour, so not one of them was visible here.
 *
 * These two rules are narrow on purpose. They do not try to hold the type
 * scale — that is judgement, like whether the accent is earned. They hold the
 * one mechanical thing: that the treatment lives in `field.ts` and every page
 * reads it from there, rather than each page typing its own and drifting.
 */
describe("type comes from the tokens, not from each page", () => {
  const FIELD_TS = join("/components", "ui", "field.ts");

  /*
   * The small-caps metadata treatment, in any spelling.
   *
   * Matched loosely between the size and the tracking rather than as one
   * fixed string, because the two offenders spelled it differently: the
   * gallery's top bar had `text-white/55` sitting in the middle of the run,
   * and the share button left the colour out entirely so its call sites
   * could pass one. A rule that only catches the spelling you happen to have
   * in front of you is most of the way to no rule — this file learned that
   * once already, over hex versus Tailwind palette utilities.
   */
  const META_RUN = /text-\[0\.6875rem\][^"`]*tracking-\[0\.14em\]/;

  it("no file re-types the metadata run", () => {
    /*
     * `code()`, so that describing the run in a comment is not an offence.
     * Both of these rules were written against raw source and both fired on
     * prose: `PAGE_TITLE`'s own docblock sat one `<h1 ` away from failing the
     * heading rule below. `source-text.ts` exists for exactly this and states
     * the lesson — a test that punishes explaining the rule is a test that
     * gets the explanation deleted — and this file has already learned it
     * once, over hex versus the palette utilities.
     */
    const offenders = allSourceFiles()
      .map((file) => ({ file, relative: file.replace(SRC, "") }))
      .filter(({ relative }) => relative !== FIELD_TS)
      .filter(({ file }) => META_RUN.test(code(readFileSync(file, "utf8"))))
      .map(({ relative }) => relative);

    expect(
      offenders,
      "Import META (or META_TYPE, if the call site sets its own colour) " +
        "from components/ui/field.ts. This run is the most repeated string " +
        "on the site and it had already been copied twice.",
    ).toEqual([]);
  });

  /*
   * A heading that sets its own tracking has decided it is not the same kind
   * of heading as the others, and after five pages have each decided that,
   * the site has five heading treatments and no scale.
   *
   * Tracking rather than size, because tracking is the tell: two headings at
   * `text-lg` are the same heading, whereas `-0.03em` beside `-0.035em`
   * beside `-0.04em` is three people setting the same thing by eye. And only
   * negative tracking — `META`'s `+0.14em` is a different treatment with its
   * own rule above.
   *
   * `h1` through `h4`, and `tracking-tight` alongside the bracket form. The
   * first version covered only `h1`/`h2` and only the bracket, which left two
   * live hand-set `h3`s in the tree and left the most likely next drift —
   * Tailwind's own named -0.025em — invisible to the rule that exists to
   * catch it.
   *
   * The viewer is out of scope. There a heading sits on a photograph with a
   * text-shadow and competes with it for contrast, which is a typographic
   * problem the reading pages do not have; `ImageCarousel` at `-0.045em` is
   * deliberate and specific to that.
   */
  const HAND_SET_HEADING = /<h[1-4]\s[^>]*tracking-(?:\[-0\.0|tight\b)/;
  const VIEWER = join(SRC, "components", "gallery");

  it("no heading on a reading page sets its own tracking", () => {
    const offenders = allSourceFiles()
      .filter((file) => !file.startsWith(VIEWER))
      .filter((file) => {
        // Attributes wrap across lines, so match the tag as one string.
        // Comments stripped first, for the reason given on the rule above.
        const source = code(readFileSync(file, "utf8")).replace(/\s+/g, " ");
        return HAND_SET_HEADING.test(source);
      })
      .map((file) => file.replace(SRC, ""));

    expect(
      offenders,
      "Use PAGE_TITLE or SECTION_HEADING from components/ui/field.ts. A " +
        "sixth value is how the first five got here.",
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
