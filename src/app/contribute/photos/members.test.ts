import { describe, expect, it } from "vitest";
import type { OwnPhotoRow } from "@/lib/photos/types";
import { filledMemberFields, memberSummary } from "./members";

/**
 * What a closed section says about what it is holding.
 *
 * The whole justification for closing it is that the summary is honest: a
 * collapsed box that looks identical whether it holds somebody's notes or
 * nothing is how writing gets forgotten and then overwritten. So the count is
 * pinned rather than eyeballed.
 */

function photo(over: Partial<OwnPhotoRow> = {}): OwnPhotoRow {
  return {
    id: "p1",
    blob_url: "https://example.test/x.jpg",
    width: 1200,
    height: 800,
    blur_data_url: "data:image/webp;base64,x",
    bg_color: "#222222",
    title: "Low tide",
    description: "Waves.",
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
    author_id: "a1",
    author_name: "Jo",
    author_slug: "jo",
    ...over,
  };
}

describe("counting what the members-only section holds", () => {
  it("counts nothing on an untouched photograph", () => {
    expect(filledMemberFields(photo())).toBe(0);
  });

  it("counts each written field", () => {
    expect(
      filledMemberFields(
        photo({ precise_location: "The pull-off", technique: "Waited." }),
      ),
    ).toBe(2);
  });

  it("counts a pin as one thing, not two", () => {
    expect(filledMemberFields(photo({ precise_lat: 1, precise_lng: 2 }))).toBe(
      1,
    );
  });

  /* Half a pin is not a pin, and must not be counted as one. */
  it("does not count a pin with only one half", () => {
    expect(filledMemberFields(photo({ precise_lat: 1 }))).toBe(0);
  });

  it("does not count whitespace as writing", () => {
    expect(filledMemberFields(photo({ precise_location: "   " }))).toBe(0);
  });

  /*
   * A consent tick is not a field somebody wrote. Counting it would make
   * "1 of 3 filled" appear on a photograph whose three fields are all empty.
   */
  it("does not count the public-example consent", () => {
    expect(filledMemberFields(photo({ is_specimen: true }))).toBe(0);
  });
});

describe("what the closed summary says", () => {
  it("names the fields when there are none", () => {
    expect(memberSummary(photo())).toBe(
      "Where you stood, the map pin, how you made it",
    );
  });

  it("counts them once there are some", () => {
    expect(memberSummary(photo({ technique: "Waited." }))).toBe(
      "1 of 3 filled",
    );
  });

  it("counts all three", () => {
    const full = photo({
      precise_location: "The pull-off",
      technique: "Waited.",
      precise_lat: 1,
      precise_lng: 2,
    });

    expect(memberSummary(full)).toBe("3 of 3 filled");
  });
});
