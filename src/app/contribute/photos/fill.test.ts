import { describe, expect, it } from "vitest";
import type { PhotoSuggestion, PlaceGuess } from "@/lib/ai/suggestion";
import { fillsFrom, isFillable, stageOf, suggestionNote } from "./fill";

/**
 * What a suggestion is allowed to do to a form somebody is already typing in.
 *
 * The component around this reads and writes real inputs by element id, so
 * none of it can be checked without a browser. This is the part that decides,
 * and it is checked here instead.
 */

function place(over: Partial<PlaceGuess> = {}): PlaceGuess {
  return {
    name: "Algarve, Portugal",
    confidence: "high",
    reason: "limestone arches over a pale beach",
    point: null,
    ...over,
  };
}

function suggestion(over: Partial<PhotoSuggestion> = {}): PhotoSuggestion {
  return {
    title: "Low tide at Praia da Marinha",
    description: "Limestone arches over a pale beach at the end of the day.",
    places: [place()],
    ...over,
  };
}

describe("which fields a suggestion writes into", () => {
  it("writes the two sentences", () => {
    expect(fillsFrom(suggestion())).toEqual([
      ["title", "Low tide at Praia da Marinha"],
      [
        "description",
        "Limestone arches over a pale beach at the end of the day.",
      ],
    ]);
  });

  /*
   * The rule this file exists for, and the one that changed.
   *
   * A place used to be written straight into the Location field whenever the
   * model was sure of it, which is why so much of this module was once about
   * telling a declined guess apart from an empty one. Nothing writes a place
   * now: candidates are buttons under the field, and the field belongs to
   * whoever typed in it until they click.
   */
  it("never writes a place, however sure the model is", () => {
    const writes = fillsFrom(
      suggestion({ places: [place({ confidence: "high" })] }),
    );

    expect(writes.map(([field]) => field)).toEqual(["title", "description"]);
  });

  it("writes nothing at all when it has two places and no sentences", () => {
    expect(
      fillsFrom(
        suggestion({ title: "", description: "", places: [place(), place()] }),
      ),
    ).toEqual([]);
  });

  it("skips a field the model returned empty", () => {
    const writes = fillsFrom(suggestion({ title: "" }));

    expect(writes.map(([field]) => field)).toEqual(["description"]);
  });

  it("knows the place and the pin are not fields it fills", () => {
    expect(isFillable("title")).toBe(true);
    expect(isFillable("location")).toBe(false);
    expect(isFillable("pin")).toBe(false);
  });
});

describe("what the photographer is told", () => {
  it("always says nothing has been saved", () => {
    expect(suggestionNote()).toContain("nothing is saved");
  });

  /*
   * The sentence about a withheld place has gone, and this is what keeps it
   * gone: there is nothing left to withhold, so a note claiming there might
   * be would be describing an older feature.
   */
  it("no longer reports a place it declined to guess", () => {
    expect(suggestionNote()).not.toContain("would not guess");
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

  it("is on the places once one is being offered", () => {
    expect(
      stageOf({
        title: "Low tide",
        description: "Waves.",
        places: [place({ name: "Alg" })],
      }),
    ).toBe("location");
  });

  /*
   * An empty array is the model having got as far as the places and found
   * none, which reads on screen as no chips at all — so the wait must not
   * claim to be working out a where that is never going to appear.
   */
  it("does not claim to be placing a photograph it will not place", () => {
    expect(
      stageOf({ title: "Low tide", description: "Waves.", places: [] }),
    ).toBe("description");
  });
});
