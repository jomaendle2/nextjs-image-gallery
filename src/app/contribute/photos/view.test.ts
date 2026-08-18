import { describe, expect, it } from "vitest";
import { initialLayout, listClassName } from "./view";

/**
 * Which shape a photographer meets first, and what the list is wearing.
 *
 * `rememberedLayout` and `rememberLayout` are not here: they are two lines
 * around `localStorage`, and a test of them would be a test of a stub. The
 * decisions are the count threshold and the class run, and both are pure.
 */

describe("the shape a dashboard opens in", () => {
  it("shows a small collection as a list", () => {
    expect(initialLayout(0)).toBe("list");
    expect(initialLayout(16)).toBe("list");
  });

  /*
   * The boundary itself, written down. A threshold nobody tests is a
   * threshold that drifts by one every time somebody edits the comparison.
   */
  it("keeps the list right up to the threshold", () => {
    expect(initialLayout(40)).toBe("list");
  });

  it("shows a large collection as a grid", () => {
    expect(initialLayout(41)).toBe("grid");
    expect(initialLayout(114)).toBe("grid");
  });
});

describe("the list's own class", () => {
  it("stacks rows when it is a list", () => {
    expect(listClassName("list")).toBe("space-y-3");
  });

  /*
   * Container queries rather than viewport ones, which is the whole reason
   * the grid works in a rail-narrowed column. If these ever come back as
   * `sm:`/`lg:`, the grid is reading the window again.
   */
  it("counts its columns from the container, not the window", () => {
    const grid = listClassName("grid");

    expect(grid).toContain("@xl:grid-cols-3");
    expect(grid).toContain("@3xl:grid-cols-4");
    /* The lookbehind is what keeps `@xl:` and `@3xl:` out of the match. */
    expect(grid).not.toMatch(/(?<![@\w])(?:sm|md|lg|xl|2xl):/);
  });

  it("does not let a tile stretch to its neighbour's height", () => {
    expect(listClassName("grid")).toContain("items-start");
  });
});
