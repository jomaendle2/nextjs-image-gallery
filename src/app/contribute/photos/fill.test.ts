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
    expect(pinToDrop([sure], "", true)).toEqual({ lat: 25.08, lng: 121.53 });
  });

  it("never moves a pin somebody placed", () => {
    // A marked spot is the one thing on this form that is already a decision.
    expect(pinToDrop([sure], "25.1, 121.5", true)).toBeNull();
  });

  it("keeps an unsure guess on its chip", () => {
    // The globe draws a dot from this. "Less sure" must stay a click.
    expect(pinToDrop([{ ...sure, confidence: "low" }], "", false)).toBeNull();
  });

  it("drops nothing when the guess carried no point", () => {
    // A model can name a place it cannot locate; that is a name, not a pin.
    expect(pinToDrop([{ ...sure, point: null }], "", true)).toBeNull();
  });

  it("only ever considers the model's first choice", () => {
    expect(
      pinToDrop([{ ...sure, confidence: "low" }, sure], "", false),
    ).toBeNull();
  });

  it("has nothing to say about no places", () => {
    expect(pinToDrop([], "", false)).toBeNull();
  });

  /*
   * The case the first version of this function got wrong, and the reason it
   * now follows the name instead of re-deciding it.
   *
   * The photographer typed "Thailand" and left the pin empty. The name is
   * refused because the box is not empty — and the point used to drop
   * anyway, because it only ever looked at the pin field. That is a dot on
   * the public globe in Hawaii, under a photograph captioned Thailand, from
   * a guess the same form had just declined in writing.
   */
  it("does not drop a point whose name the form refused", () => {
    expect(pinToDrop([{ ...sure, name: "Hawaii" }], "", false)).toBeNull();
  });

  it("drops the point when the name is being taken at the same moment", () => {
    expect(pinToDrop([sure], "", true)).toEqual(sure.point);
  });
});

/*
 * The pair, in the order and with the values `settle` uses them.
 *
 * Both functions were already covered and both were already right; what was
 * wrong lived between them. `settle` asked `locationToFill` for the name,
 * wrote it into the field, and then asked a second time — against the field
 * it had just filled — whether the name had been taken. The answer was no,
 * because "empty" was the condition and the write had made it false, so the
 * pin never dropped in the one case it exists for. Nothing in either
 * function's own tests could see that: the mistake was the caller's, and it
 * was invisible because the two questions had no reason in the types to be
 * the same question.
 *
 * These run the sequence as the hook runs it — decide once, write, then hand
 * the decision on — so that a return to reading the box twice fails here.
 */
describe("a sure guess filling both fields at once", () => {
  const sure = {
    name: "Taipei, Taiwan",
    confidence: "high",
    reason: "the segmented profile of Taipei 101",
    point: { lat: 25.08, lng: 121.53 },
  } as const;

  /** What `settle` does, with a box instead of a field. */
  function fill(places: readonly (typeof sure)[], box: string, pinBox: string) {
    const name = locationToFill(places, box);
    const written = name ?? box;
    return { written, point: pinToDrop(places, pinBox, name !== null) };
  }

  it("drops the pin for the name it has just written", () => {
    expect(fill([sure], "", "")).toEqual({
      written: "Taipei, Taiwan",
      point: sure.point,
    });
  });

  it("leaves both alone when the photographer has typed a place", () => {
    expect(fill([sure], "Thailand", "")).toEqual({
      written: "Thailand",
      point: null,
    });
  });

  it("writes the name but keeps a pin the photographer placed", () => {
    expect(fill([sure], "", "25.1, 121.5")).toEqual({
      written: "Taipei, Taiwan",
      point: null,
    });
  });
});
