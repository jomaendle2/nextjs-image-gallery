import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allSourceFiles, code, rel, SRC } from "@/lib/source-text";

/**
 * One revalidation window for every public route, and it is a day.
 *
 * The window was an hour, and the hour is what spent Neon's free compute.
 * A crawler walking the sitemap re-renders every entry whose window has
 * lapsed, so a few hundred URLs on an hourly clock arrive as a query every
 * few seconds — and Neon suspends only after five idle minutes, so the
 * database was awake for the whole month. The window is a backstop, not the
 * mechanism: publishing, unpublishing, deleting and revoking all clear their
 * pages through `revalidateFeeds` the moment they happen.
 *
 * One value, not merely "at least a day", because the routes cache each
 * other's data. The gallery, the globe and the feeds read the same rows; a
 * route left on the old hour would quietly put the queries back, and two
 * routes on different clocks disagree about what has been published.
 *
 * Read from the source rather than imported, because importing a page pulls
 * in the database module, which refuses to load without `DATABASE_URL`.
 */
const DECLARATION = /export const revalidate = ([^;]+);/;

const windows = allSourceFiles()
  .filter((file) => file.startsWith(join(SRC, "app")))
  .flatMap((file) => {
    const match = DECLARATION.exec(code(readFileSync(file, "utf8")));
    return match?.[1] === undefined
      ? []
      : [{ file: rel(file), value: match[1] }];
  });

describe("the revalidation window", () => {
  it("is declared by the public routes", () => {
    // A floor rather than an exact list: the point is that the scan found
    // them, so a broken pattern cannot pass this by finding nothing.
    expect(windows.length).toBeGreaterThanOrEqual(10);
  });

  it("is one day on every route that declares one", () => {
    const offenders = windows.filter(({ value }) => value !== "86_400");
    expect(offenders).toEqual([]);
  });
});
