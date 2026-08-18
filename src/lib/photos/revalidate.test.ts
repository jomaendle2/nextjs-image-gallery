import { describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => revalidatePath(path, type),
}));

const { revalidateFeeds } = await import("./revalidate");

/**
 * The list itself, because the list is the bug.
 *
 * This function exists because "ad-hoc revalidation lists kept missing one",
 * and it then missed one: `/api/globe`. The globe's *dots* come from the
 * `/globe` page, which was on the list, but hovering one looks the cell up in
 * a payload fetched separately from `/api/globe`, which was not — so a
 * newly published photograph put a dot on the map that the card knew nothing
 * about, and hovering it did nothing for up to an hour.
 *
 * Asserting the exact set rather than "contains": a missing entry is the only
 * failure this function has ever had, and only an exact comparison notices
 * one being dropped.
 */
describe("revalidateFeeds", () => {
  it("clears every cached surface a photograph appears on", () => {
    revalidatePath.mockClear();
    revalidateFeeds("anna");

    expect(revalidatePath.mock.calls).toEqual([
      ["/", undefined],
      ["/by/anna", undefined],
      ["/by/anna/slideshow", undefined],
      // A route pattern and a type: one concrete URL would clear one of the
      // many entries, and it is the URL people actually share.
      ["/photo/[id]", "page"],
      ["/photographers", undefined],
      ["/globe", undefined],
      // The globe is two caches: the page draws the dots, this answers the
      // card. Until they are one cache, they expire together.
      ["/api/globe", undefined],
    ]);
  });
});
