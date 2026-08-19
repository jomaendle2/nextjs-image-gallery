import { describe, expect, it } from "vitest";
import { code, read } from "@/lib/source-text";

/**
 * A view is counted once, by somebody who is not the person who made it.
 *
 * `image_views` is the oldest table here and the only one nothing may alter:
 * it holds every view this site has counted, including for the photographs
 * that predate contributors. There is no column recording where a view came
 * from, so an inflated total cannot be unwound — which makes writing to it
 * from the wrong place a quieter failure than deleting a row, and a worse
 * one to discover late.
 *
 * Preview, development and production share one database. `EnvironmentBanner`
 * says so on every contributor page, and the warning is about the buttons;
 * this is the same trap without a button. Every pass through the gallery on
 * `localhost` while building something, and every click on a preview link
 * sent out for review, used to land in the number a photographer reads as
 * their audience.
 */

const route = code(read("app", "api", "views", "route.ts"));

/* The two landmarks the ordering checks below are about. */
const GATE = /if \(!viewsAreCounted\(\)\)/;
const WRITE = /incrementViewCount\(imageId\)/;
const READ = /getViewCount\(imageId\)/;

describe("only production adds to a view count", () => {
  it("the gate is the deployment environment, not a client's word for it", () => {
    expect(route).toContain('process.env["VERCEL_ENV"] === "production"');
  });

  /*
   * Ordering, because a gate below the write is not a gate. Both call sites
   * are in one function and a refactor that hoists the increment — to await
   * it alongside something else, say — would leave every assertion above
   * still passing.
   */
  it("nothing is written before the gate has been asked", () => {
    const gate = route.search(GATE);
    const write = route.search(WRITE);

    expect(gate, "the guard is not there at all").toBeGreaterThan(-1);
    expect(write, "incrementViewCount is not called").toBeGreaterThan(-1);
    expect(
      gate,
      "The environment check has to come before the write, or it is " +
        "documentation rather than a gate.",
    ).toBeLessThan(write);
  });

  /*
   * The refusal has to be invisible to the reader. Returning zero — or an
   * error — would put a wrong number under a photograph on a developer's
   * screen and make the feature look broken locally, which is how a guard
   * like this gets removed by somebody debugging something else.
   */
  it("a view that is not counted still answers with the real total", () => {
    const guarded = route.slice(route.search(GATE), route.search(WRITE));
    expect(READ.test(guarded)).toBe(true);
  });

  /*
   * Reading is not writing. The GET handler serves every count the gallery
   * displays, and gating it would blank the numbers in development rather
   * than protect anything.
   */
  it("reading the counts is not gated", () => {
    const get = route.slice(route.indexOf("export async function GET"));
    expect(get).not.toContain("viewsAreCounted");
  });
});
