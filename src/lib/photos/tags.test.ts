import { describe, expect, it } from "vitest";
import { isPhotoTag, MAX_PHOTO_TAGS, PHOTO_TAGS, readPhotoTags } from "./tags";

/**
 * The vocabulary, and the one function that decides what gets into the
 * column.
 *
 * `readPhotoTags` is the only gate between a request and a `TEXT[]` that
 * future browse pages will group by, so what it drops matters more than what
 * it keeps: a single unrecognised string stored here is a `/tag/` page with
 * one photograph on it and no way to reach it.
 */

describe("the vocabulary", () => {
  it("has no duplicates", () => {
    expect(new Set(PHOTO_TAGS).size).toBe(PHOTO_TAGS.length);
  });

  it("is all lowercase and URL-safe, because the tag is the slug", () => {
    for (const tag of PHOTO_TAGS) {
      expect(tag).toMatch(/^[a-z]+$/);
    }
  });
});

describe("isPhotoTag", () => {
  it("accepts a member", () => {
    expect(isPhotoTag("coast")).toBe(true);
  });

  it("rejects a near miss", () => {
    // The exact failure a free-text vocabulary would have produced.
    expect(isPhotoTag("coastline")).toBe(false);
    expect(isPhotoTag("Coast")).toBe(false);
    expect(isPhotoTag(" coast")).toBe(false);
  });

  it("rejects things that are not strings", () => {
    expect(isPhotoTag(undefined)).toBe(false);
    expect(isPhotoTag(null)).toBe(false);
    expect(isPhotoTag(7)).toBe(false);
  });

  /*
   * `Set.has` is a lookup on a `Set`, not a property access, so this is
   * already true — pinned because the obvious first implementation of this
   * function is `value in LOOKUP` on a plain object, and that one answers
   * yes to "constructor".
   */
  it("rejects inherited property names", () => {
    expect(isPhotoTag("constructor")).toBe(false);
    expect(isPhotoTag("toString")).toBe(false);
  });
});

describe("readPhotoTags", () => {
  it("keeps the tags and drops everything else", () => {
    expect(readPhotoTags(["coast", "not-a-tag", "ice", 3, null])).toEqual([
      "coast",
      "ice",
    ]);
  });

  it("deduplicates", () => {
    expect(readPhotoTags(["ice", "ice", "ice"])).toEqual(["ice"]);
  });

  it("orders by the vocabulary, not by arrival", () => {
    /*
     * So that two photographs carrying the same subjects render the same row
     * of chips. `coast` precedes `ice` in `PHOTO_TAGS`, whichever order they
     * were submitted in.
     */
    expect(readPhotoTags(["ice", "coast"])).toEqual(
      readPhotoTags(["coast", "ice"]),
    );
  });

  it("caps the list", () => {
    expect(readPhotoTags(PHOTO_TAGS)).toHaveLength(MAX_PHOTO_TAGS);
  });

  it("has nothing to say about nothing", () => {
    expect(readPhotoTags([])).toEqual([]);
  });
});
