/**
 * The coastline, in tiers, and how each one is paid for.
 *
 * Three files of the same planet at three resolutions, none of them in the
 * static graph. Each is its own chunk reached by `import()`, so a reader
 * receives exactly the detail they have asked for and no more:
 *
 *   `world`         ~27 KB   when the globe first draws at all
 *   `world-fine`   ~187 KB   when the globe is expanded full-screen
 *   `world-finest` ~501 KB   when somebody zooms past what `fine` can draw
 *
 * Module-scoped promises rather than component state, so opening the globe a
 * second time is instant and two globes on one page join one request instead
 * of making two.
 *
 * **This file is named by `world.test.ts`.** That test asserts each of these
 * module names appears in exactly one source file, which is what keeps the
 * lazy loading structural rather than a convention somebody could undo with
 * a tidy-looking static import. It was `GlobeCanvas.tsx` until the tiers
 * outgrew the component that used them.
 */
import type { Detailed, Land } from "./sphere";

/**
 * Fetches the four-times-finer coastline, once per session.
 *
 * A module-scoped promise rather than component state, so opening the globe a
 * second time is instant and two globes on one page cannot each pull it. The
 * `import()` is the whole point: nothing in the static graph names
 * `world-fine.ts`, so it is its own chunk and a reader who never expands the
 * globe never pays for it.
 *
 * **This function has to stay in this file, textually.** `world.test.ts`
 * asserts that the string `world-fine` appears in exactly one source file and
 * names that file as `components/geo/GlobeCanvas.tsx`. Moving these six lines
 * into `sphere.ts` alongside the rest of the coastline plumbing — which is
 * where they otherwise belong — turns a green suite red for a reason that
 * takes an hour to find.
 */
let finePromise: Promise<Detailed> | null = null;
export function loadFineLand(): Promise<Detailed> {
  finePromise ??= import("@/lib/geo/world-fine").then((module) => ({
    land: module.WORLD_LAND_FINE,
    borders: module.WORLD_BORDERS_FINE,
  }));
  return finePromise;
}

/**
 * The deep-zoom coastline, fetched only once somebody has zoomed for it.
 *
 * Half a megabyte gzipped — larger than everything else in `src/lib/geo` put
 * together, and larger than the rest of this page's JavaScript. It buys the
 * difference between a ceiling of 2.5x and one of 6x, because magnification
 * is limited by how far apart the vertices are on screen rather than by
 * anything in the renderer.
 *
 * The trigger is the reader crossing `FINEST_FROM`, not opening the globe.
 * Someone who looks at the sphere, turns it and leaves never fetches this;
 * someone who pinches twice does, and has by then asked a question the file
 * is the only answer to. Until it lands, `world-fine` keeps drawing — so the
 * cost of the wait is a slightly softer coastline, never a blank sphere.
 *
 * **Textually in this file, like `loadFineLand` above**, and for the same
 * reason: `world.test.ts` asserts that each of these module names appears in
 * exactly one source file and names that file.
 */
let finestPromise: Promise<Detailed> | null = null;
export function loadFinestLand(): Promise<Detailed> {
  finestPromise ??= import("@/lib/geo/world-finest").then((module) => ({
    land: module.WORLD_LAND_FINEST,
    borders: module.WORLD_BORDERS_FINEST,
  }));
  return finestPromise;
}

/**
 * The everyday coastline, fetched the same way and for the same reason.
 *
 * This one used to be a static import, and it was the single largest thing
 * on `/globe` — roughly twenty-eight kilobytes gzipped, about a seventh of
 * the page's JavaScript, spent on a canvas that is `aria-hidden` and sits
 * beside a complete list of links to the same photographs. Somebody who
 * cannot run the canvas, or will not, gets exactly the page they got before;
 * somebody who can gets the sphere a moment later than the text.
 *
 * That order is the right one and is worth stating, because it looks like a
 * regression from "instant" to "nearly instant". The globe is the decoration
 * and the list is the content: the coastline should never have been ahead of
 * the page in the queue.
 *
 * Module-scoped promise, like the fine set above, so a second globe on a
 * page joins the first one's request instead of making its own.
 */
let coarsePromise: Promise<Land> | null = null;
export function loadCoarseLand(): Promise<Land> {
  coarsePromise ??= import("@/lib/geo/world").then(
    (module) => module.WORLD_LAND,
  );
  return coarsePromise;
}
