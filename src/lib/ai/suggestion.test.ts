import { describe, expect, it } from "vitest";
import {
  type RawPlace,
  type RawSuggestion,
  salvage,
  shapePartial,
  shapeSuggestion,
} from "./suggestion";

/**
 * The rules that stand between a model and a photographer's form.
 *
 * Pure, so they can be tested without credentials, without a network and
 * without a photograph — which is the reason they were separated from the
 * call in the first place. Everything else in this feature is either an
 * environment read or a provider round trip; this is the part with a
 * decision in it.
 */

function place(over: Partial<RawPlace> = {}): RawPlace {
  return {
    confidence: "high",
    name: "Uluwatu, Bali",
    reason: "the clifftop temple on the headland",
    lat: -8.829,
    lng: 115.085,
    ...over,
  };
}

function answer(over: Partial<RawSuggestion> = {}): RawSuggestion {
  return {
    title: "Tide lines",
    description: "Teal waves crash against rocky cliffs.",
    places: [place()],
    ...over,
  };
}

describe("clamping to the columns' caps", () => {
  it("leaves an ordinary answer alone", () => {
    expect(shapeSuggestion(answer())).toEqual({
      title: "Tide lines",
      description: "Teal waves crash against rocky cliffs.",
      places: [
        {
          name: "Uluwatu, Bali",
          confidence: "high",
          reason: "the clifftop temple on the headland",
          point: { lat: -8.829, lng: 115.085 },
        },
      ],
    });
  });

  it("cuts a title to 120 characters", () => {
    const shaped = shapeSuggestion(answer({ title: "a".repeat(200) }));
    expect(shaped.title).toHaveLength(120);
  });

  it("cuts a description to 300 characters", () => {
    const shaped = shapeSuggestion(answer({ description: "b".repeat(400) }));
    expect(shaped.description).toHaveLength(300);
  });

  it("cuts a place name to 120 characters", () => {
    const shaped = shapeSuggestion(
      answer({ places: [place({ name: "c".repeat(300) })] }),
    );
    expect(shaped.places[0]?.name).toHaveLength(120);
  });

  /* The reason sits on a chip beside the name; it is a clause, not a note. */
  it("cuts a reason to 80 characters", () => {
    const shaped = shapeSuggestion(
      answer({ places: [place({ reason: "d".repeat(300) })] }),
    );
    expect(shaped.places[0]?.reason).toHaveLength(80);
  });

  /*
   * Models like to answer with a leading newline, and a paragraph break
   * inside a single-line input renders as a space anyway. Collapsing here
   * means the cap counts characters somebody will actually see.
   */
  it("collapses the whitespace a model adds", () => {
    const shaped = shapeSuggestion(
      answer({ description: "  Teal waves\n\n  crash.  " }),
    );
    expect(shaped.description).toBe("Teal waves crash.");
  });

  it("does not end a cut string on a space", () => {
    const shaped = shapeSuggestion(
      answer({ title: `${"d".repeat(119)} tail` }),
    );
    expect(shaped.title).toBe("d".repeat(119));
  });
});

/**
 * The reversal this feature is built on.
 *
 * A hedged guess used to be deleted here, because a filled field reads as a
 * fact and `/globe` is built from these strings. It is kept now — but only
 * because it lands on a chip nobody has to click rather than in the box that
 * gets saved. If a place ever starts auto-filling the field again, the old
 * rule has to come back with it.
 */
describe("the candidates", () => {
  it("keeps a low-confidence place, with its hedge", () => {
    const shaped = shapeSuggestion(
      answer({
        places: [place({ name: "Cornwall, England", confidence: "low" })],
      }),
    );

    expect(shaped.places).toHaveLength(1);
    expect(shaped.places[0]?.name).toBe("Cornwall, England");
    expect(shaped.places[0]?.confidence).toBe("low");
  });

  it("keeps two places in the order the model gave them", () => {
    const shaped = shapeSuggestion(
      answer({
        places: [place({ name: "Sagres, Portugal" }), place({ name: "Cádiz" })],
      }),
    );

    expect(shaped.places.map((entry) => entry.name)).toEqual([
      "Sagres, Portugal",
      "Cádiz",
    ]);
  });

  /* Two guesses is a choice; three is a list nobody reads. */
  it("drops a third place", () => {
    const shaped = shapeSuggestion(
      answer({
        places: [
          place({ name: "One" }),
          place({ name: "Two" }),
          place({ name: "Three" }),
        ],
      }),
    );

    expect(shaped.places.map((entry) => entry.name)).toEqual(["One", "Two"]);
  });

  it("drops a place with no name, and keeps the one beside it", () => {
    const shaped = shapeSuggestion(
      answer({ places: [place({ name: "   " }), place({ name: "Sagres" })] }),
    );

    expect(shaped.places.map((entry) => entry.name)).toEqual(["Sagres"]);
  });

  /* Empty is an honest answer, and the chips are what say so. */
  it("returns no places when the model found none", () => {
    expect(shapeSuggestion(answer({ places: [] })).places).toEqual([]);
  });

  it("treats an unknown confidence as the hedged one", () => {
    const shaped = shapeSuggestion(
      answer({
        places: [place({ confidence: "certain" as RawPlace["confidence"] })],
      }),
    );

    expect(shaped.places[0]?.confidence).toBe("low");
  });
});

/**
 * The coordinate, which is the part a chip offers to put on a map.
 *
 * A point that does not survive validation costs the chip its second action
 * and nothing else — the name still fills the field, because the text and
 * the pin are two decisions rather than one.
 */
describe("the point on a candidate", () => {
  it.each([
    ["a latitude past the pole", { lat: 91, lng: 8 }],
    ["a longitude past the meridian", { lat: 47, lng: 181 }],
    ["only one half", { lat: 47, lng: null }],
    ["neither half", { lat: null, lng: null }],
    ["an infinity", { lat: Number.POSITIVE_INFINITY, lng: 8 }],
  ])(
    "nulls %s while the name survives",
    (_name: string, at: Partial<RawPlace>) => {
      const shaped = shapeSuggestion(answer({ places: [place(at)] }));

      expect(shaped.places[0]?.name).toBe("Uluwatu, Bali");
      expect(shaped.places[0]?.point).toBeNull();
    },
  );

  it("keeps a point that is one", () => {
    const shaped = shapeSuggestion(
      answer({ places: [place({ lat: 37.08, lng: -8.41 })] }),
    );

    expect(shaped.places[0]?.point).toEqual({ lat: 37.08, lng: -8.41 });
  });
});

/**
 * The half-written answer, which is the version somebody actually watches.
 *
 * An array in flight is the awkward case: its elements arrive one at a time,
 * and the one being written may be a partial object or, for a moment, a hole
 * in the array. None of that may reach a button.
 */
describe("shapePartial", () => {
  it("passes through the fields that have arrived", () => {
    expect(shapePartial({ title: "Low tide" })).toEqual({ title: "Low tide" });
  });

  it("leaves out a field the model has not reached", () => {
    expect(shapePartial({})).toEqual({});
  });

  it("emits nothing for a place that has no name yet", () => {
    expect(shapePartial({ places: [{ confidence: "high" }] })).toEqual({
      places: [],
    });
  });

  it("survives a hole in a streaming array", () => {
    expect(shapePartial({ places: [undefined, { name: "Sagres" }] })).toEqual({
      places: [{ name: "Sagres", confidence: "low", reason: "", point: null }],
    });
  });

  it("shows a place from its first named character", () => {
    expect(
      shapePartial({ places: [{ confidence: "high", name: "Alg" }] }),
    ).toEqual({
      places: [{ name: "Alg", confidence: "high", reason: "", point: null }],
    });
  });

  /*
   * The caps apply to a prefix too. A model writing past 120 characters is
   * writing past them from the first chunk that gets there, and a field that
   * grows past its column and then snaps back at the end is a worse way to
   * find out than never seeing the extra words.
   */
  it("cuts a long prefix to the column's cap", () => {
    const long = "x".repeat(400);
    expect(shapePartial({ title: long }).title).toHaveLength(120);
  });

  it("collapses the whitespace a model streams mid-sentence", () => {
    expect(shapePartial({ description: "Teal  waves\ncrash" })).toEqual({
      description: "Teal waves crash",
    });
  });
});

/**
 * What a run that died halfway is allowed to leave behind.
 *
 * This is the difference between "the suggestion could not be made" and the
 * photographer keeping two sentences they already watched being written, so
 * the rule about *which* half-answers are usable is worth pinning rather than
 * rediscovering the next time a provider truncates a stream.
 */
describe("salvaging an unfinished answer", () => {
  it("keeps a title and description that both arrived", () => {
    expect(
      salvage({ title: "Tide Lines", description: "Teal waves crash." }),
    ).toEqual({
      title: "Tide Lines",
      description: "Teal waves crash.",
      places: [],
    });
  });

  /*
   * Both or neither. Half a caption presented as the finished answer is worse
   * than the refusal, because nothing about it says it is incomplete.
   */
  it("refuses a title with no description", () => {
    expect(salvage({ title: "Tide Lines" })).toBeNull();
  });

  it("refuses a description with no title", () => {
    expect(salvage({ description: "Teal waves crash." })).toBeNull();
  });

  it("refuses a field that arrived empty or as whitespace", () => {
    expect(
      salvage({ title: "  ", description: "Teal waves crash." }),
    ).toBeNull();
  });

  it("refuses a run that produced nothing at all", () => {
    expect(salvage(null)).toBeNull();
  });

  /*
   * A truncated place name is a prefix, and a prefix is offered as a button
   * that writes a location — "Nusa Pen" on the globe rather than in a field
   * nobody submits. The chips are the one thing worth losing here.
   */
  it("drops places even when the stream had already offered some", () => {
    expect(
      salvage({
        title: "Tide Lines",
        description: "Teal waves crash.",
        places: [
          {
            name: "Nusa Pen",
            confidence: "low",
            reason: "limestone",
            lat: null,
            lng: null,
          },
        ],
      })?.places,
    ).toEqual([]);
  });

  /* A salvaged answer obeys the same caps as a finished one. */
  it("cuts a salvaged field to the column's cap", () => {
    expect(
      salvage({ title: "x".repeat(400), description: "Teal waves crash." })
        ?.title,
    ).toHaveLength(120);
  });
});
