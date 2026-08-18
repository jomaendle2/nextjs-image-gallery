import { describe, expect, it } from "vitest";
import type { PhotoSuggestion } from "@/lib/ai/suggestion";
import { fillsFrom, stageOf, suggestionNote } from "./fill";

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

/**
 * What the wait says while the fields are filling.
 *
 * Read off the stream rather than told to us, so the thing being checked is
 * that the reading matches the order the schema asks for. If those two ever
 * disagree the line describes the wrong field, which is worse than saying
 * nothing.
 */
describe("which field the model is on", () => {
  it("is looking before anything has arrived", () => {
    expect(stageOf({})).toBe("looking");
  });

  it("is on the title while only a title has arrived", () => {
    expect(stageOf({ title: "Low" })).toBe("title");
  });

  /* Empty string, not undefined: the field has been opened, not skipped. */
  it("is on the description from its first character", () => {
    expect(stageOf({ title: "Low tide", description: "" })).toBe("description");
  });

  it("is on the place once one is being shown", () => {
    expect(
      stageOf({ title: "Low tide", description: "Waves.", location: "Alg" }),
    ).toBe("location");
  });

  /*
   * A place the model declined to name never reaches the form, so the wait
   * must not claim to be placing anything. `shapePartial` has already
   * withheld it; this is the half of that decision the sentence has to agree
   * with.
   */
  it("does not claim to be placing a photograph it will not place", () => {
    expect(stageOf({ title: "Low tide", description: "Waves." })).toBe(
      "description",
    );
  });
});
