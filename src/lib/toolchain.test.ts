import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { allSourceFiles, code, ROOT, rel } from "./source-text";

/**
 * The linter configuration, as the few things a test can hold.
 *
 * `noRestrictedImports` is where this repository states an architectural rule
 * in the one tool that reads it while you type. The trap is that Biome's
 * `overrides` **replace** a rule's options rather than merging into them, so
 * an override that adds one restriction to a folder silently removes every
 * other restriction there.
 *
 * That is not a hypothetical. The first version of this configuration added
 * the layering rule for `src/lib` and by doing so turned off `maplibre-gl`,
 * `stripe` and `@/lib/database` throughout `src/lib`, `src/hooks` and
 * `src/data` — while a probe from `src/components` showed the rules working.
 * `docs/architecture/toolchain.md` records it and says to verify by probing.
 *
 * A probe is the right way to check enforcement and this cannot replace it.
 * What this holds is the thing probing does not reach: that the three copies
 * the replace-semantics force us to keep still say the same thing. A message
 * edited in one of them reads as authoritative and is wrong in the other two.
 */

interface Restriction {
  message?: string;
}

interface Rule {
  level?: string;
  options?: { paths?: Record<string, Restriction> };
}

interface Style {
  noRestrictedImports?: Rule | string;
}

interface Config {
  linter: { rules: { style: Style } };
  overrides: { includes: string[]; linter: { rules: { style?: Style } } }[];
}

const config = JSON.parse(
  readFileSync(join(ROOT, "biome.json"), "utf8"),
) as Config;

function paths(rule: Rule | string | undefined): Record<string, Restriction> {
  return typeof rule === "object" ? (rule.options?.paths ?? {}) : {};
}

const base = paths(config.linter.rules.style.noRestrictedImports);

const zones = config.overrides.filter(
  (entry) => entry.linter.rules.style?.noRestrictedImports !== undefined,
);

/**
 * The two kinds of zone, separated once.
 *
 * A zone either states the rule or turns it off, and the three checks below
 * each used to re-ask which — with `typeof` in two different directions and a
 * raw re-read in the third. The distinction is a property of the zone, so it
 * is drawn here and read from.
 */
const narrowing = zones.filter(
  (zone) => typeof zone.linter.rules.style?.noRestrictedImports === "object",
);
const exempt = zones.filter(
  (zone) => zone.linter.rules.style?.noRestrictedImports === "off",
);

/**
 * How one zone's copy differs from the base, if at all.
 *
 * A zone that turns the rule off entirely diverges by definition and is not
 * this check's business — that is a decision, and the ordering check below is
 * what holds it. `narrowing` has already dropped those.
 */
function diverged(rule: Rule | string | undefined): string[] {
  const here = paths(rule);
  return Object.entries(base).flatMap(([specifier, restriction]) => {
    const mine = here[specifier];
    if (mine === undefined) {
      return [`lost ${specifier}`];
    }
    return mine.message === restriction.message
      ? []
      : [`${specifier} says something else`];
  });
}

describe("the restricted imports say the same thing everywhere", () => {
  it("there is something to check", () => {
    expect(Object.keys(base).length).toBeGreaterThan(0);
    expect(zones.length).toBeGreaterThan(1);
  });

  /*
   * Every zone that configures the rule at all has to carry the whole base
   * set, because stating one restriction for a folder is what drops the rest.
   * A zone may add to it — `src/components` bans the SQL client — and a zone
   * may turn the rule off outright, which is a decision rather than an
   * accident and is what the next check is about.
   */
  it("every zone that narrows the rule still carries all of it", () => {
    const missing = narrowing.flatMap((zone) =>
      diverged(zone.linter.rules.style?.noRestrictedImports).map(
        (note) => `${zone.includes.join(", ")} → ${note}`,
      ),
    );

    expect(
      missing,
      "Biome overrides replace rather than merge, so a zone that states one " +
        "restriction drops every restriction it does not repeat. Copy the " +
        "whole block. See docs/architecture/toolchain.md.",
    ).toEqual([]);
  });

  /*
   * The last matching override wins, so the one that turns the rule off has
   * to be the last one. Moved above a zone, it would stop exempting the tests
   * and scripts it exists for — and the failure would look like the rule
   * working, which is the hardest kind to notice.
   */
  it("the exemption comes last", () => {
    expect(exempt.length).toBe(1);
    expect(zones.at(-1)).toBe(exempt[0]);
  });
});

/**
 * The layering rule again, in the spelling Biome cannot see.
 *
 * `noRestrictedImports` matches specifiers as text, so its `@/app/**` and
 * `@/components/**` patterns hold only for the alias. A probe from `src/lib`
 * importing `"@/components/ui/field"` is blocked; the same file importing
 * `"../components/ui/field"` lints clean. That is the whole rule, avoidable
 * by typing two dots — including invariant I2, which is why the SQL client is
 * out of reach of a component.
 *
 * Both, rather than moving the rule here. Biome is what reads it while you
 * type, and that feedback is the reason the rule lives in configuration at
 * all; this is what makes the boundary true rather than merely advertised.
 * Relative depth is not enumerable in a glob, so the specifier is resolved to
 * a path and the question asked about the path.
 *
 * Tests and `scripts/` are exempt in both places — the last override turns
 * the rule off for them, and `allSourceFiles` drops `.test.ts` — because a
 * test reaches wherever it must to assert on what it finds there.
 */

const IMPORTS = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

const LAYERS = [
  {
    under: ["src/lib/", "src/hooks/", "src/data/"],
    banned: ["src/app/", "src/components/"],
    why: "src/lib, src/hooks and src/data sit underneath the app, not beside it. Move the shared thing down.",
  },
  {
    under: ["src/components/"],
    banned: ["src/app/"],
    why: "A component may not import from src/app. Move the shared thing down into src/lib.",
  },
  {
    under: ["src/components/"],
    banned: ["src/lib/database"],
    why: "Invariant I2: the SQL client is server-only and authorisation lives in the WHERE clause. Go through a repository in src/lib/*/repository.ts.",
  },
];

/** Where a specifier lands, repo-relative, or null if it leaves the repo. */
function target(file: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) {
    return `src/${specifier.slice(2)}`;
  }
  if (specifier.startsWith(".")) {
    return rel(resolve(dirname(file), specifier));
  }
  return null;
}

/** Every banned crossing this one file makes, with the reason attached. */
function crossingsIn(file: string): string[] {
  const from = rel(file);
  const specifiers = [
    ...code(readFileSync(file, "utf8")).matchAll(IMPORTS),
  ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));

  return LAYERS.filter((layer) =>
    layer.under.some((dir) => from.startsWith(dir)),
  ).flatMap((layer) =>
    specifiers
      .filter((specifier) => {
        const to = target(file, specifier);
        return to !== null && layer.banned.some((dir) => to.startsWith(dir));
      })
      .map((specifier) => `${from} → ${specifier} (${layer.why})`),
  );
}

describe("the layering holds however an import is spelled", () => {
  it("nothing underneath the app reaches up into it", () => {
    expect(
      allSourceFiles().flatMap(crossingsIn),
      "biome.json states this rule for the @/ spelling; a relative " +
        "specifier reaching the same file is the same crossing. See " +
        "docs/architecture/toolchain.md.",
    ).toEqual([]);
  });
});
