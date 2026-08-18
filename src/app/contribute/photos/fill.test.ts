import { describe, expect, it } from "vitest";
import type { PhotoSuggestion, PlaceGuess } from "@/lib/ai/suggestion";
import {
  fillsFrom,
  locationToFill,
  pinToDrop,
  stageOf,
  suggestionNote,
} from "./fill";

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
    tags: [],
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

describe("locationToFill", () => {
  const high = {
    name: "Sagres, Portugal",
    confidence: "high",
    reason: "the lighthouse on the headland",
    point: null,
  } as const;
  const low = {
    ...high,
    name: "Peniche, Portugal",
    confidence: "low",
  } as const;

  it("fills an empty field with a sure guess", () => {
    expect(locationToFill([high], "")).toBe("Sagres, Portugal");
    // Whitespace is an empty field: nobody typed a location made of spaces.
    expect(locationToFill([high], "  ")).toBe("Sagres, Portugal");
  });

  it("never overwrites what somebody typed", () => {
    // A typed word beats a guess, whatever the model's confidence.
    expect(locationToFill([high], "Cabo de São Vicente")).toBeNull();
  });

  it("keeps an unsure guess on its chip", () => {
    // "Less sure" written into a field reads as a fact once it is there.
    expect(locationToFill([low], "")).toBeNull();
    // Only the FIRST place may fill — a sure second guess behind an unsure
    // first would mean the model's own ordering disagreed with itself.
    expect(locationToFill([low, high], "")).toBeNull();
  });

  it("has nothing to say about no places", () => {
    expect(locationToFill([], "")).toBeNull();
  });
});

describe("pinToDrop", () => {
  const sure = {
    name: "Taipei, Taiwan",
    confidence: "high",
    reason: "the segmented profile of Taipei 101",
    point: { lat: 25.08, lng: 121.53 },
  } as const;

  it("drops a sure guess's point into an empty field", () => {
    expect(pinToDrop([sure], "")).toEqual({ lat: 25.08, lng: 121.53 });
  });

  it("never moves a pin somebody placed", () => {
    // A marked spot is the one thing on this form that is already a decision.
    expect(pinToDrop([sure], "25.1, 121.5")).toBeNull();
  });

  it("keeps an unsure guess on its chip", () => {
    // The globe draws a dot from this. "Less sure" must stay a click.
    expect(pinToDrop([{ ...sure, confidence: "low" }], "")).toBeNull();
  });

  it("drops nothing when the guess carried no point", () => {
    // A model can name a place it cannot locate; that is a name, not a pin.
    expect(pinToDrop([{ ...sure, point: null }], "")).toBeNull();
  });

  it("only ever considers the model's first choice", () => {
    expect(pinToDrop([{ ...sure, confidence: "low" }, sure], "")).toBeNull();
  });

  it("has nothing to say about no places", () => {
    expect(pinToDrop([], "")).toBeNull();
  });
});
