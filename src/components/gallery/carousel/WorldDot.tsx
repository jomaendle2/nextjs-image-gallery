import type { GalleryPin } from "@/data/galleryData";
import {
  WORLD_NORTH,
  WORLD_PATH,
  WORLD_SOUTH,
  WORLD_VIEW_BOX,
} from "@/lib/geo/world-path";
import { CELL_KM } from "@/lib/photos/coarsen";
import { count } from "@/lib/plural";

/**
 * Roughly where on earth, as one mark on a flat world.
 *
 * A photographer's public point is the centre of a cell about {@link CELL_KM}
 * kilometre across, and this draws it at the only scale where that is
 * honest: the whole world is 360 degrees wide here, so the cell is a small
 * fraction of a pixel and the mark cannot imply a precision the data does
 * not have. That was true when the cell was a hundred kilometres and it is
 * true by a wider margin now — this map is the one place where shrinking the
 * blur changed nothing at all, because it was already far below what a pixel
 * can say.
 *
 * **No map library, no third party, no network call, no new dependency, and
 * nothing added to the payload of a page.** The projection is
 * `x = lng + 180`, `y = 90 - lat` — equirectangular, which is to say no
 * projection at all — and `WORLD_PATH` is generated in the same coordinates,
 * so the coastline and the point are placed by identical arithmetic and
 * cannot disagree.
 *
 * It imports `world-path.ts` rather than `world.ts`, and that is the whole
 * performance story: the globe's coastline is four times the size and lives
 * in a different module, so a gallery page cannot receive it whatever the
 * bundler decides to do about unused exports.
 *
 * Flat rather than a globe. An orthographic projection at this size hides
 * half the world and spends most of its area on the limb; `/globe` is the
 * page whose subject is a globe and can afford to be one.
 *
 * Every colour is a Tailwind class rather than a literal — `design.test.ts`
 * catches hex in a component, and this is the viewer, where the only colour
 * comes from the photograph.
 */

/*
 * Drawn in viewBox units, which are degrees. The map renders around 300px
 * wide for 360 degrees, so a unit is roughly four fifths of a pixel and
 * these come out at about 2, 5 and 10px.
 */
const CORE = 2.6;
const RING = 6;
const HALO = 12;

/**
 * Hairlines that stay hairlines.
 *
 * The viewBox is 360 units wide and paints into a few hundred pixels, so a
 * stroke specified in units would land near a third of a pixel and grey
 * itself out. `non-scaling-stroke` measures the width after the transform
 * instead, which is the difference between a coastline and a smudge.
 */
const HAIRLINE = { vectorEffect: "non-scaling-stroke" } as const;

export function WorldDot({ pin }: { pin: GalleryPin }) {
  const x = pin.lng + 180;
  /*
   * Clamped into the drawn band. The map is cropped north and south because
   * equirectangular cannot draw a pole without turning the ice into a bar
   * across the picture; a photograph from inside the crop is rare and gets
   * the edge of the map rather than a mark somewhere off it.
   */
  const y = 90 - Math.min(WORLD_NORTH, Math.max(WORLD_SOUTH, pin.lat));

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <svg
        className="block h-auto w-full"
        role="img"
        viewBox={WORLD_VIEW_BOX}
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>
          {`A world map with one mark showing roughly where this photograph was taken, accurate to about ${count(CELL_KM, "kilometre")}.`}
        </title>

        {/*
          Filled land under a lit coastline, rather than a single flat fill.
          One tone reads as a stain on the panel; the edge is what makes it
          read as a map, and it costs one extra attribute on a path that was
          already being drawn.

          `evenodd` is load-bearing, not a default worth inheriting. Lakes are
          inner rings in this path, and under `nonzero` the Caspian, the Great
          Lakes and Baikal come out as pieces of land — which is exactly what
          they were before the data grew holes.
        */}
        <path
          className="fill-white/[0.09] stroke-white/25"
          d={WORLD_PATH}
          fillRule="evenodd"
          strokeWidth={1}
          {...HAIRLINE}
        />

        {/*
          The two lines through the mark, at the threshold of visible.

          They are the difference between a dot on a picture and a position
          on an instrument: a reader sees at a glance which latitude and
          which meridian, without a graticule cluttering the whole panel to
          say it. Decorative graticules were the alternative and they make a
          small map unreadable.
        */}
        <g className="stroke-white/[0.10]" strokeWidth={1} {...HAIRLINE}>
          <line x1={0} x2={360} y1={y} y2={y} />
          <line x1={x} x2={x} y1={90 - WORLD_NORTH} y2={90 - WORLD_SOUTH} />
        </g>

        {/*
          Three circles rather than a blur or a gradient: a soft halo the
          size of the uncertainty, an open ring at its edge, and a small
          solid centre.

          The ring is the load-bearing one. A filled dot draws honest
          arithmetic as a precise claim — an outline says "somewhere in
          here", which is what the number actually means. Concentric circles
          rather than a `radialGradient` so the component needs no `id`, and
          therefore no `useId` and no client boundary.
        */}
        <circle className="fill-white/[0.07]" cx={x} cy={y} r={HALO} />
        <circle
          className="fill-none stroke-white/50"
          cx={x}
          cy={y}
          r={RING}
          strokeWidth={1}
          {...HAIRLINE}
        />
        <circle className="fill-white" cx={x} cy={y} r={CORE} />
      </svg>
    </div>
  );
}
