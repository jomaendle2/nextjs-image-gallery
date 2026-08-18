import { describe, expect, it } from "vitest";
import type { PhotoSuggestion } from "@/lib/ai/suggestion";
import { fillsFrom, suggestionNote } from "./fill";

/**
 * What a suggestion is allowed to do to a form somebody is already typing in.
 *
 * The component around this reads and writes real inputs by element id, so
 * none of it can be checked without a browser. This is the part that decides,
 * and it is checked here instead.
 */

function suggestion(over: Partial<PhotoSuggestion> = {}): PhotoSuggestion {
  return {
    title: "Low tide at Praia da Marinha",
    description: "Limestone arches over a pale beach at the end of the day.",
    location: "Algarve, Portugal",
    locationConfidence: "high",
    ...over,
  };
}

describe("which fields a suggestion writes into", () => {
  it("writes all three when the model answered all three", () => {
    expect(fillsFrom(suggestion())).toEqual([
      ["title", "Low tide at Praia da Marinha"],
      [
        "description",
        "Limestone arches over a pale beach at the end of the day.",
      ],
      ["location", "Algarve, Portugal"],
    ]);
  });

  /*
   * The rule this file exists for. `shapeSuggestion` nulls the location
   * whenever the model hedged, and a photographer who has already typed
   * "Bali" must not lose it because of that — the field is skipped, not
   * cleared.
   */
  it("leaves the location alone when the model would not name the place", () => {
    const writes = fillsFrom(
      suggestion({ location: null, locationConfidence: "low" }),
    );

    expect(writes.map(([field]) => field)).toEqual(["title", "description"]);
  });

  it("skips a field the model returned empty", () => {
    const writes = fillsFrom(suggestion({ title: "", description: "" }));

    expect(writes).toEqual([["location", "Algarve, Portugal"]]);
  });

  it("writes nothing at all rather than blanking the form", () => {
    expect(
      fillsFrom(suggestion({ title: "", description: "", location: null })),
    ).toEqual([]);
  });
});

describe("what the photographer is told", () => {
  it("always says nothing has been saved", () => {
    expect(suggestionNote(suggestion())).toContain("nothing is saved");
  });

  /*
   * A location left blank on purpose looks exactly like one the feature
   * failed to fill in, so the silence is reported.
   */
  it("says so when the place was dropped rather than missed", () => {
    const note = suggestionNote(suggestion({ locationConfidence: "low" }));

    expect(note).toContain("would not guess where this was taken");
  });

  it("does not mention the place when it named one", () => {
    expect(suggestionNote(suggestion())).not.toContain("would not guess");
  });
});
