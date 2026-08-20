import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allSourceFiles, code, read, SRC } from "./source-text";

/**
 * The invariants about where a coordinate is allowed to go.
 *
 * A third security file rather than a longer one, on the seam this codebase
 * has already split along twice: `security.test.ts` holds the request
 * surface, `security-interface.test.ts` holds the promises the interface
 * makes, and these hold the promises the *dependency graph* makes.
 *
 * Every one is about a boundary that nothing at runtime enforces. I14 says a
 * map library that ships to one page behind a session never reaches a public
 * one; I15 says the point a photographer marked is blurred once, at write
 * time, in one place; I16 says the one coordinate that travels outward — a
 * photographer pointing at roughly where they were, so a model has something
 * to go on — is blunt before it goes and goes only because somebody pointed.
 * None can be checked by exercising the code: a component moves between
 * directories without changing behaviour, and a second `coarsen` call site
 * works perfectly right up until the day the two answers differ. The check
 * has to be on the shape of the source, which is the approach
 * `docs/architecture/security.md` §6 describes.
 */

describe("I14 — the map never reaches a public page", () => {
  /*
   * The whole privacy story of the picker rests on one sentence: no visitor
   * to this gallery ever contacts MapTiler. That is what keeps the
   * no-cookie-banner claim on `/privacy` true, and what makes a sixth
   * processor entry something other than a change in what a reader consents
   * to by arriving.
   *
   * Enforced by counting files rather than by reasoning about routes,
   * because "which components end up on a public page" is exactly the
   * question a refactor answers differently without telling anybody.
   */
  const mentions = (): string[] =>
    allSourceFiles()
      .filter((file) => /maplibre/i.test(readFileSync(file, "utf8")))
      .map((f) => f.replace(SRC, ""));

  /*
   * The file moved, and the count did not.
   *
   * A second control now draws a map — the hint beside "Suggest details",
   * where a photographer points at roughly where they were so a model has
   * something to go on. The obvious way to build it was a second copy of
   * the loader, which would have made this list two entries long and the
   * invariant a formality. Instead the surface moved out of the picker into
   * `MapSurface.tsx` and both controls import it, so the number of files
   * that know the library's name is still one.
   *
   * That is the shape any future map should take. If this list ever needs a
   * second entry, the question to answer first is why the component cannot
   * import the one that already exists.
   */
  it("exactly one file in the codebase touches the map library", () => {
    expect(mentions()).toEqual([
      join("/app", "contribute", "photos", "MapSurface.tsx"),
    ]);
  });

  it("nothing in the viewer or the gallery mentions it", () => {
    const inGallery = mentions().filter((file) =>
      file.startsWith(join("/components", "gallery")),
    );
    expect(inGallery).toEqual([]);
  });

  /*
   * No tile proxy, recorded as a test because the instinct to add one is
   * strong and the reasons not to are not obvious.
   *
   * A `/api/tiles` route would be a public endpoint spending metered
   * third-party money — which is the thing I11 exists to stop — and it would
   * multiply function invocations by every tile of every pan. It would buy
   * no privacy at all: the page is behind a session, and the only people
   * whose IP MapTiler would stop seeing are the handful of photographers who
   * are already signed in.
   */
  it("no route handler proxies tiles", () => {
    const offenders = allSourceFiles()
      .filter((file) => file.endsWith("route.ts"))
      .filter((file) => /maptiler|\btiles?\b/i.test(readFileSync(file, "utf8")))
      .map((f) => f.replace(SRC, ""));
    expect(offenders).toEqual([]);
  });

  /*
   * `NEXT_PUBLIC_` is compiled into every client bundle on the site,
   * including the ones anonymous visitors receive. The key is read on the
   * server and handed to the picker as a prop instead.
   */
  it("the tile key is not a public environment variable", () => {
    const offenders = allSourceFiles()
      .filter((file) =>
        /NEXT_PUBLIC_[A-Z_]*MAP/.test(code(readFileSync(file, "utf8"))),
      )
      .map((f) => f.replace(SRC, ""));
    expect(offenders).toEqual([]);
  });
});

describe("I15 — a public payload carries only coarsened points", () => {
  /*
   * Two stored precisions only work if exactly one thing decides what the
   * public one is. A second caller of `coarsen` — a component recomputing a
   * dot at render time, say — would mean the stored point and the drawn one
   * could disagree, and a page recomputing it would need the exact point in
   * its payload to do so, which is the leak this whole design avoids.
   *
   * Two files, and both are deliberate: the repository, which stores it at
   * publish time, and the picker, which shows a photographer what will be
   * stored before they agree to it. Informed consent needs the second one.
   */
  it("only the write path and the picker's preview call coarsen", () => {
    const callers = allSourceFiles()
      // Its own definition is not a call site.
      .filter((file) => !file.endsWith(join("photos", "coarsen.ts")))
      .filter((file) => /\bcoarsen\s*\(/.test(code(readFileSync(file, "utf8"))))
      .map((f) => f.replace(SRC, ""))
      .sort((a, b) => a.localeCompare(b));
    expect(callers).toEqual(
      [
        join("/lib", "photos", "repository.ts"),
        join("/app", "contribute", "photos", "LocationPicker.tsx"),
      ].sort((a, b) => a.localeCompare(b)),
    );
  });

  /*
   * The picker previews; it must not be the thing that decides. If the
   * browser sent a coarse pair the server trusted, a modified client could
   * put the public dot anywhere it liked — so `publishPhoto` derives it
   * from the exact point and never accepts one.
   */
  it("the write path derives the public point rather than accepting it", () => {
    const repository = read("lib", "photos", "repository.ts");
    const write = repository.slice(
      repository.indexOf("export async function publishPhoto"),
      repository.indexOf("export async function setPublished"),
    );
    expect(write).toContain("coarsen(");
    expect(write).not.toMatch(/input\.coarse/);
  });
});

/*
 * I16 — a coordinate reaches a third party only blunted — is retired with
 * the feature it guarded. The photographer's hint (a typed phrase and an
 * optionally pointed-at area sent alongside "Suggest details") was the one
 * outbound coordinate on this site, and it carried four invariants: rounded
 * before the prompt, rounded inside the reader, never borrowing `coarsen`,
 * never named into the form's `FormData`. The hint is gone end to end —
 * `hint.ts`, `HintMap.tsx`, the request body, the prompt line — so the data
 * path those invariants watched no longer exists, and the suggest route no
 * longer reads a body at all.
 *
 * If a hint-shaped feature ever returns, so must these, and `hint.test.ts`
 * beside them; this comment is the pointer back to the commit that removed
 * both.
 */
