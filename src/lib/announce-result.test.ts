import { describe, expect, it } from "vitest";
import { describeAnnouncement } from "./announce-result";
import { count, counted } from "./plural";

describe("counted nouns", () => {
  it("uses the singular for exactly one", () => {
    expect(count(1, "photograph")).toBe("1 photograph");
    expect(counted(1, "person", "people")).toBe("1 person");
  });

  it("uses the plural for everything else, including zero", () => {
    expect(count(0, "photograph")).toBe("0 photographs");
    expect(count(2, "photograph")).toBe("2 photographs");
    expect(counted(0, "person", "people")).toBe("0 people");
  });
});

describe("the sentence after the announcement is sent", () => {
  it("reports the plain success case", () => {
    expect(describeAnnouncement({ photographs: 16, sent: 40, failed: 0 })).toBe(
      "Sent 16 photographs to 40 subscribers.",
    );
  });

  /*
   * The case this function exists for. Sending is not transactional: the
   * photographs are marked announced before the mail goes out, so a partial
   * failure means those people will never be told about this batch — there
   * is no second attempt. Reporting it as a flat "sent" would hide the one
   * outcome the owner has to act on.
   */
  it("never hides a partial failure", () => {
    const message = describeAnnouncement({
      photographs: 3,
      sent: 38,
      failed: 2,
    });
    expect(message).toContain("2 did not go out");
    expect(message).toContain("did not go out");
    // And says what happens to them, not just that something went wrong.
    expect(message).toContain("next announcement");
  });

  it("keeps the singular readable at one of each", () => {
    expect(describeAnnouncement({ photographs: 1, sent: 1, failed: 0 })).toBe(
      "Sent 1 photograph to 1 subscriber.",
    );
  });
});
