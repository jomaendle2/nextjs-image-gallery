import { describe, expect, it } from "vitest";
import type { OwnPhotoRow } from "@/lib/photos/types";
import {
  countByStatus,
  matches,
  selectionState,
  selectPhotos,
  toggleAll,
} from "./filter";

/**
 * The search and filter rules, tested without rendering anything.
 *
 * They lived inside `PhotoList` until that component was split, which meant
 * the only way to check "does searching find this row" was to render a list
 * of cards, each with a next/image thumbnail. So nobody did.
 */

/*
 * No `as OwnPhotoRow` here on purpose. The first draft used one, and it hid
 * that this row type declares `title` as a plain string — so a test case
 * written for "a null title" was asserting something the type forbids.
 */
function photo(over: Partial<OwnPhotoRow>): OwnPhotoRow {
  return {
    id: "p1",
    blob_url: "https://example.test/x.jpg",
    width: 1200,
    height: 800,
    blur_data_url: "data:image/webp;base64,x",
    tags: [],
    bg_color: "#000000",
    title: "",
    description: "",
    location: null,
    exif: null,
    published_at: null,
    is_opener: false,
    precise_location: null,
    technique: null,
    precise_lat: null,
    precise_lng: null,
    coarse_lat: null,
    coarse_lng: null,
    is_specimen: false,
    author_id: "c1",
    author_name: "A Photographer",
    author_slug: "a-photographer",
    ...over,
  };
}

describe("searching a contributor's own photographs", () => {
  it("matches title and location, case-insensitively", () => {
    const row = photo({ title: "Dawn Ridge", location: "Dolomites" });
    expect(matches(row, "dawn")).toBe(true);
    expect(matches(row, "dolomites")).toBe(true);
    expect(matches(row, "ridge")).toBe(true);
  });

  /*
   * Deliberate: description is long, so a match in it is invisible in the
   * collapsed row — the person sees a result and cannot tell why it is
   * there. If this ever changes, the summary has to show the match too.
   */
  it("does not search the description", () => {
    const row = photo({
      title: "Dawn Ridge",
      description: "taken from a col above Cortina",
    });
    expect(matches(row, "cortina")).toBe(false);
  });

  it("an empty search matches everything, including untitled rows", () => {
    expect(matches(photo({}), "")).toBe(true);
  });

  it("survives an empty title and a null location", () => {
    expect(matches(photo({ title: "", location: null }), "anything")).toBe(
      false,
    );
  });
});

describe("the status filter", () => {
  const rows = [
    photo({ id: "a", title: "Published one", published_at: "2026-01-01" }),
    photo({ id: "b", title: "Draft one" }),
    photo({ id: "c", title: "Draft two", location: "Alps" }),
  ];

  it("counts every bucket, and the buckets add up", () => {
    const counts = countByStatus(rows);
    expect(counts).toEqual({ all: 3, published: 1, draft: 2 });
    expect(counts.published + counts.draft).toBe(counts.all);
  });

  it("narrows to published or draft", () => {
    expect(selectPhotos(rows, "published", "").map((r) => r.id)).toEqual(["a"]);
    expect(selectPhotos(rows, "draft", "").map((r) => r.id)).toEqual([
      "b",
      "c",
    ]);
  });

  /*
   * The combination is where a filter usually goes wrong: one of the two
   * conditions silently wins. Both must apply.
   */
  it("applies the status filter and the search together", () => {
    expect(selectPhotos(rows, "draft", "alps").map((r) => r.id)).toEqual(["c"]);
    expect(selectPhotos(rows, "published", "alps")).toEqual([]);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(selectPhotos(rows, "all", "   alps  ").map((r) => r.id)).toEqual([
      "c",
    ]);
  });
});

describe("selecting everything the filter matches", () => {
  const rows = [
    photo({ id: "a", title: "Published one", published_at: "2026-01-01" }),
    photo({ id: "b", title: "Draft one" }),
    photo({ id: "c", title: "Draft two", location: "Alps" }),
  ];
  const drafts = selectPhotos(rows, "draft", "");

  it("selects the whole filtered set from empty", () => {
    expect([...toggleAll(new Set(), drafts)].sort()).toEqual(["b", "c"]);
  });

  it("clears them when they are all already selected", () => {
    expect([...toggleAll(new Set(["b", "c"]), drafts)]).toEqual([]);
  });

  it("completes a partial selection rather than clearing it", () => {
    expect([...toggleAll(new Set(["b"]), drafts)].sort()).toEqual(["b", "c"]);
  });

  /*
   * The one that matters. Selecting "all" while a filter is on must not
   * touch rows the filter excludes — otherwise switching to Drafts, pressing
   * select-all and pressing Delete takes published work with it.
   */
  it("never touches rows outside the current filter", () => {
    const next = toggleAll(new Set(["a"]), drafts);
    expect(next.has("a")).toBe(true);
    expect([...next].sort()).toEqual(["a", "b", "c"]);

    const cleared = toggleAll(next, drafts);
    expect([...cleared]).toEqual(["a"]);
  });

  it("reports none, some and all", () => {
    expect(selectionState(new Set(), drafts)).toBe("none");
    expect(selectionState(new Set(["b"]), drafts)).toBe("some");
    expect(selectionState(new Set(["b", "c"]), drafts)).toBe("all");
  });

  it("reports none when nothing matches, so the control can hide", () => {
    expect(selectionState(new Set(["b"]), [])).toBe("none");
  });

  /*
   * A selection left over from a previous filter must not make the current
   * set look fully selected.
   */
  it("is not 'all' just because some other row is selected", () => {
    expect(selectionState(new Set(["a"]), drafts)).toBe("none");
  });
});
