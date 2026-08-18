import { describe, expect, it } from "vitest";
import { type RawSuggestion, shapeSuggestion } from "./suggestion";

/**
 * The two rules that stand between a model and a photographer's form.
 *
 * Pure, so they can be tested without credentials, without a network and
 * without a photograph — which is the reason they were separated from the
 * call in the first place. Everything else in this feature is either an
 * environment read or a provider round trip; this is the part with a
 * decision in it.
 */

function answer(over: Partial<RawSuggestion> = {}): RawSuggestion {
  return {
    title: "Tide lines",
    description: "Teal waves crash against rocky cliffs.",
    location: "Uluwatu, Bali",
    locationConfidence: "high",
    ...over,
  };
}

describe("clamping to the columns' caps", () => {
  it("leaves an ordinary answer alone", () => {
    expect(shapeSuggestion(answer())).toEqual({
      title: "Tide lines",
      description: "Teal waves crash against rocky cliffs.",
      location: "Uluwatu, Bali",
      locationConfidence: "high",
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

  it("cuts a place to 120 characters", () => {
    const shaped = shapeSuggestion(answer({ location: "c".repeat(300) }));
    expect(shaped.location).toHaveLength(120);
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

describe("dropping a place the model is unsure of", () => {
  /*
   * The load-bearing one. `/globe` is built from these strings, so a
   * confident wrong guess puts a photograph on a coastline it was never
   * taken on — and a filled field reads as a fact to the person confirming
   * it.
   */
  it("drops a low-confidence place entirely", () => {
    const shaped = shapeSuggestion(
      answer({ location: "Cornwall, England", locationConfidence: "low" }),
    );
    expect(shaped.location).toBeNull();
  });

  it("keeps the title and description of a low-confidence answer", () => {
    const shaped = shapeSuggestion(answer({ locationConfidence: "low" }));
    expect(shaped.title).toBe("Tide lines");
    expect(shaped.description).toBe("Teal waves crash against rocky cliffs.");
  });

  /*
   * Passed through rather than swallowed: the interface can then say the
   * place was left blank on purpose, instead of looking like it found
   * nothing.
   */
  it("reports the confidence it was given", () => {
    expect(
      shapeSuggestion(answer({ locationConfidence: "low" })).locationConfidence,
    ).toBe("low");
  });

  it("treats a null place as no place", () => {
    expect(shapeSuggestion(answer({ location: null })).location).toBeNull();
  });

  it("treats a blank place as no place", () => {
    expect(shapeSuggestion(answer({ location: "   " })).location).toBeNull();
  });
});
