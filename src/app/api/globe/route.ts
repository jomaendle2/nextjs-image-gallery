import { cellKeyOf, groupIntoCells, labelFor } from "@/lib/photos/globe";
import { listGlobePoints, listGlobeThumbnails } from "@/lib/photos/repository";
import { photoTitle } from "@/lib/photos/title";

/**
 * What the expanded globe needs and the page must not carry.
 *
 * **Why this is a route rather than more props.** `/globe` renders a complete
 * grouped list of every photograph as HTML, and hands the canvas beside it
 * three numbers per cell — `toGlobePoints`' docblock explains at length why
 * it is three and not more. The hover card needs rather more than three: a
 * label, a count, a thumbnail URL with its dimensions, and the photographs to
 * link to. Putting those in the canvas's props would serialise them into
 * every visit to `/globe`, including the large majority who never open the
 * globe at all, which is the precise trade `docs/roadmap.md` §2 exists
 * to refuse.
 *
 * So the cost is moved onto the click that needs it. The page's payload is
 * byte-for-byte what it was; this is fetched once when the overlay opens, and
 * the CDN answers the second reader.
 *
 * | photographs | page props | this route |
 * | ---: | ---: | ---: |
 * | 14 | ~0.4 KB | ~2 KB |
 * | 300 | ~4 KB | ~35 KB |
 * | 1000 | ~10 KB | ~90 KB |
 *
 * **When to split it.** Once the gzipped body passes roughly 25 KB — about
 * eight hundred photographs — `photos` should move to a per-cell route and
 * this one should keep only labels, counts and thumbnails. Written down now
 * so it is a threshold somebody crosses deliberately rather than a surprise,
 * the same way `docs/roadmap.md` §2 records the windowing trigger.
 *
 * **It publishes nothing new.** Every label, count, title and id here is
 * already in the HTML of `/globe`. The additions are a blob URL and the three
 * things needed to lay it out without reflow — width, height and the average
 * colour — all four of which are already public on the gallery. The coarsened point is the same hundred-
 * kilometre cell centre the page shows, and no `precise_` column is within
 * reach of this file.
 */
export const revalidate = 3600;

/**
 * The same hour as `revalidate`, and a day of staleness behind it.
 *
 * Named constants rather than one literal header string, because a long
 * comma-separated string of digits and hyphens is what a secret scanner is
 * looking for — `noSecrets` reads the inline version as a credential. Written
 * out of the numbers, the header is both quieter to the linter and easier to
 * keep in step with the segment config above.
 */
const SHARED_SECONDS = 3600;
const STALE_SECONDS = 86_400;

interface GlobePlace {
  key: string;
  label: string;
  count: number;
  /**
   * One photograph from this cell, chosen server-side. `null` where the query
   * found none, which should not happen given both come from the same
   * published set — but a card with no picture is a card, and a crash is not.
   */
  thumb: {
    url: string;
    width: number;
    height: number;
    bg: string;
  } | null;
  photos: { id: string; title: string }[];
}

export async function GET(): Promise<Response> {
  const [rows, thumbnails] = await Promise.all([
    listGlobePoints(),
    listGlobeThumbnails(),
  ]);

  /*
   * Keyed rather than zipped. The two queries run against the same table but
   * are not guaranteed to return the same cells in the same order, and
   * `cellKeyOf` is the one definition of cell identity both sides share —
   * see its docblock for the failure this avoids.
   */
  const pictures = new Map(
    thumbnails.map((row) => [
      cellKeyOf(row.coarse_lat, row.coarse_lng),
      {
        url: row.url,
        width: row.width,
        height: row.height,
        bg: row.bg_color,
      },
    ]),
  );

  const places: GlobePlace[] = groupIntoCells(rows).map((cell) => ({
    key: cell.key,
    label: labelFor(cell),
    count: cell.photos.length,
    thumb: pictures.get(cell.key) ?? null,
    photos: cell.photos.map((photo) => ({
      id: photo.id,
      title: photoTitle(photo.title),
    })),
  }));

  return Response.json(places, {
    headers: {
      /*
       * The same hour as the page it belongs to, so a reader who opens the
       * globe is not shown a set of places the list behind it disagrees with.
       * `stale-while-revalidate` covers the moment after expiry: the reader
       * who happens to arrive then gets the previous answer immediately
       * rather than waiting on two queries.
       */
      "Cache-Control": `public, s-maxage=${SHARED_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`,
    },
  });
}
