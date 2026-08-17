import type { GalleryPin } from "@/data/galleryData";
import { WORLD_PATH } from "@/lib/geo/world";
import { CELL_KM } from "@/lib/photos/coarsen";

/**
 * Roughly where on earth, as one dot on a flat world.
 *
 * A photographer's public point is the centre of a cell about {@link CELL_KM}
 * kilometres across, and this draws it at the only scale where that is
 * honest: at 160 px the whole world is 360 degrees wide, so a hundred
 * kilometres is well under a pixel and the dot cannot imply a precision the
 * data does not have.
 *
 * **No map library, no third party, no network call, no new dependency, and
 * nothing added to the payload of a page.** The projection is
 * `x = lng + 180`, `y = 90 - lat` — equirectangular, which is to say no
 * projection at all — and `WORLD_PATH` is generated in the same coordinates,
 * so the coastline and the point are placed by identical arithmetic and
 * cannot disagree. About 3.6 KB gzipped, once, for the whole site.
 *
 * Flat rather than a globe, deliberately. An orthographic projection at this
 * size reads as an ornament: half the world is missing, the limb has to be
 * clipped, and the dot spends most of its life on the far side. `/globe` is
 * the page whose subject is a globe, and it can afford to be one.
 *
 * Every colour is a Tailwind class rather than a literal — `design.test.ts`
 * catches hex in a component, and this is the viewer, where the only colour
 * comes from the photograph.
 */

/** The full sphere, in the units the generated path already uses. */
const VIEW_BOX = "0 0 360 180";

export function WorldDot({ pin }: { pin: GalleryPin }) {
  const x = pin.lng + 180;
  const y = 90 - pin.lat;

  return (
    <svg
      className="mt-3 block h-auto w-full max-w-[220px]"
      role="img"
      viewBox={VIEW_BOX}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>
        {`A world map with one dot marking roughly where this photograph was taken, accurate to about ${CELL_KM} kilometres.`}
      </title>

      <path className="fill-white/[0.08]" d={WORLD_PATH} />

      {/*
        Two circles: a soft disc the size of the uncertainty, and a hard
        centre. The disc is what stops this reading as a precise pin — at
        this scale a single dot would be honest arithmetic drawn as a false
        claim, and the halo is the part that says "somewhere around here".
      */}
      <circle className="fill-white/25" cx={x} cy={y} r={7} />
      <circle className="fill-white" cx={x} cy={y} r={2.5} />
    </svg>
  );
}
