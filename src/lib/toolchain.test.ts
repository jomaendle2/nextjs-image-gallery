import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "./source-text";

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
 * How one zone's copy differs from the base, if at all.
 *
 * A zone that turns the rule off entirely diverges by definition and is not
 * this check's business — that is a decision, and the ordering check below is
 * what holds it.
 */
function diverged(rule: Rule | string | undefined): string[] {
  if (typeof rule === "string") {
    return [];
  }
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
    const missing = zones.flatMap((zone) =>
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
    const off = zones.filter(
      (zone) => zone.linter.rules.style?.noRestrictedImports === "off",
    );
    expect(off.length).toBe(1);
    expect(zones.at(-1)).toBe(off[0]);
  });
});
