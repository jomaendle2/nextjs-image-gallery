import { describe, expect, it } from "vitest";
import { type Hint, hintLine, readHint } from "./hint";

/**
 * The one place data leaves this server on purpose, and the rule about how
 * much of it goes.
 *
 * I16: a coordinate reaches a third party only after it has been blunted,
 * and only when a photographer pointed at one. Both halves are checked here
 * rather than by exercising the route, because the route needs credentials
 * and a photograph and this is arithmetic.
 */

describe("what survives a request body", () => {
  it("reads a note and a point", () => {
    expect(
      readHint({ note: "Algarve coast", near: { lat: 37.1, lng: -8.5 } }),
    ).toEqual({ note: "Algarve coast", near: { lat: 37.1, lng: -8.5 } });
  });

  it("is empty when nothing was offered", () => {
    expect(readHint({})).toEqual({ note: null, near: null });
  });

  /*
   * A hint is optional by construction, so a body we cannot read is answered
   * with a suggestion made without one rather than with an error. Every one
   * of these is a thing a real client can send.
   */
  it.each([
    ["nothing at all", null],
    ["a string", "Algarve"],
    ["a number", 4],
    ["an array", []],
  ])("treats %s as no hint", (_name: string, body: unknown) => {
    expect(readHint(body)).toEqual({ note: null, near: null });
  });

  it("treats a blank note as no note", () => {
    expect(readHint({ note: "   \n " }).note).toBeNull();
  });

  it("collapses the whitespace inside a note", () => {
    expect(readHint({ note: "  Algarve\n\n coast " }).note).toBe(
      "Algarve coast",
    );
  });

  /*
   * The note is the photographer's own words shown straight back to them,
   * but it still goes into a prompt, so it is cut rather than trusted.
   */
  it("cuts a long note to the location column's cap", () => {
    expect(readHint({ note: "a".repeat(400) }).note).toHaveLength(120);
  });
});

describe("I16 — a point is blunted before it can go anywhere", () => {
  /*
   * The number in the plan, and the number in the failure message if this
   * ever changes: a coordinate typed as `47.37691, 8.54170` must leave as
   * `47.4, 8.5` and nothing finer.
   */
  it("rounds to one decimal place", () => {
    expect(readHint({ near: { lat: 47.376_91, lng: 8.5417 } }).near).toEqual({
      lat: 47.4,
      lng: 8.5,
    });
  });

  it("rounds a negative point the same way", () => {
    expect(
      readHint({ near: { lat: -33.868_82, lng: -70.123_45 } }).near,
    ).toEqual({ lat: -33.9, lng: -70.1 });
  });

  it("puts nothing finer than one decimal into the prompt", () => {
    const line = hintLine(readHint({ near: { lat: 47.376_91, lng: 8.5417 } }));

    expect(line).toContain("47.4, 8.5");
    expect(line).not.toContain("47.37");
    expect(line).not.toContain("8.5417");
  });

  it.each([
    ["a latitude past the pole", { lat: 91, lng: 8 }],
    ["a longitude past the meridian", { lat: 47, lng: 181 }],
    ["an infinity", { lat: Number.POSITIVE_INFINITY, lng: 8 }],
    ["a missing half", { lat: 47 }],
    ["strings", { lat: "47", lng: "8" }],
    ["not an object", 47],
  ])("refuses %s", (_name: string, near: unknown) => {
    expect(readHint({ near }).near).toBeNull();
  });

  /*
   * A note that mentions a place is fine; a note is prose. What must never
   * happen is a precise pair travelling inside one, which is why the point
   * has its own field rather than being appended to the sentence.
   */
  it("keeps the note and the point as separate fields", () => {
    const hint = readHint({
      note: "Algarve coast",
      near: { lat: 37.08, lng: -8.41 },
    });

    expect(hint.note).toBe("Algarve coast");
    expect(hint.near).toEqual({ lat: 37.1, lng: -8.4 });
  });
});

describe("the line that reaches the model", () => {
  const empty: Hint = { note: null, near: null };

  it("is nothing when there is no hint", () => {
    expect(hintLine(empty)).toBeNull();
  });

  it("carries the words the photographer typed", () => {
    expect(hintLine({ note: "Algarve coast", near: null })).toContain(
      "Algarve coast",
    );
  });

  /*
   * Said as a steer rather than as an answer. A hint presented as a fact is
   * a way of making a model agree with a photographer who was guessing.
   */
  it("says a hint is a steer rather than an answer", () => {
    expect(hintLine({ note: "Algarve coast", near: null })).toContain("steer");
  });

  it("says the point is only roughly where they pointed", () => {
    expect(hintLine({ note: null, near: { lat: 37.1, lng: -8.4 } })).toContain(
      "roughly",
    );
  });
});
