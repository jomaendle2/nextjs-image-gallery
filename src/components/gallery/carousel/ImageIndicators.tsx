import Image from "next/image";
import type { CSSProperties } from "react";
import { memo } from "react";
import type { GalleryImage } from "@/data/galleryData";
import { useDockScroll } from "./useDockScroll";

/**
 * How far a tile sits from the current one, clamped.
 *
 * Clamping is what keeps the memo below worth having: moving the selection
 * changes the proximity of five tiles and leaves every other tile at `3`, so
 * the rest skip re-rendering entirely. Without the clamp every tile's prop
 * would change on every navigation — and the strip has no upper bound on
 * length, since `listPublishedPhotos` returns the whole published feed.
 */
type Proximity = 0 | 1 | 2 | 3;

const FALLOFF = 3;

/** How much of each edge is faded when there is content behind it. */
const FADE_WIDTH = "28px";
const NO_FADE = "0px";

/**
 * The magnification curve, as a dock.
 *
 * The selected tile is not the only one that moves: its neighbours lift a
 * little and the ones beyond them barely at all, which is what reads as a
 * physical bulge travelling along the strip rather than one tile blinking to
 * a new size. The slot keeps its width throughout, so none of this touches
 * layout — the whole curve runs on the compositor.
 *
 * One curve serves both slot sizes. Against 60/40 a 1.45× tile comes to 58px
 * and against 52/36 it comes to 52.2px; the ~4% difference in how tightly the
 * tile fills its slot is not visible, and it is worth much less than a second
 * curve that would have to be kept in step with this one.
 *
 * `scale-*` in Tailwind v4 sets the standalone `scale` property, not
 * `transform` — which is why the transition below has to name `scale`.
 */
const MAGNIFY: Record<Proximity, string> = {
  0: "scale-[1.45] opacity-100 shadow-[0_0_0_1px_oklch(100%_0_0_/_0.9),0_8px_20px_-8px_oklch(0%_0_0_/_0.85)]",
  1: "scale-[1.15] opacity-75 shadow-[0_0_0_1px_oklch(100%_0_0_/_0.3)]",
  2: "scale-[1.05] opacity-55 shadow-[0_0_0_1px_oklch(100%_0_0_/_0.2)]",
  3: "scale-100 opacity-45 shadow-[0_0_0_1px_oklch(100%_0_0_/_0.18)]",
};

interface ThumbnailProps {
  image: GalleryImage;
  index: number;
  proximity: Proximity;
  onSelect: (index: number) => void;
}

/**
 * Split out and memoized so that changing the current index re-renders the
 * handful of thumbnails whose magnification actually changed rather than the
 * whole strip, and so the click handler is a stable per-thumbnail callback
 * instead of a new closure allocated on every parent render.
 */
const Thumbnail = memo(function ThumbnailButton({
  image,
  index,
  proximity,
  onSelect,
}: ThumbnailProps) {
  const handleClick = () => {
    onSelect(index);
  };

  const isActive = proximity === 0;

  return (
    /*
     * The slot is a fixed 52px, or 60px from `sm` up, whether or not its tile
     * is magnified.
     *
     * That is what keeps the strip still. Animating the tile's `width` and
     * `height` — which is how this worked first — grew the active tile in
     * layout, so selecting a photograph shifted every tile sideways and
     * re-ran the centring scroll against a moving target.
     *
     * The slot is also the touch target, and both sizes clear the 44px floor
     * on their own — the tile no longer has to be padded out to earn one.
     */
    <button
      aria-current={isActive ? "true" : undefined}
      aria-label={`Go to image ${index + 1}: ${image.title}`}
      className={`group relative flex size-[52px] flex-shrink-0 items-center justify-center rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/80 sm:size-[60px] ${
        // The magnified tile has to paint over its neighbours rather than
        // under whichever of them happens to come later in the strip.
        isActive ? "z-10" : ""
      }`}
      data-dock-index={index}
      onClick={handleClick}
      type="button"
    >
      {/*
        220ms rather than the 400ms this used to take. A dock is snappy: the
        magnification should land about as fast as the eye arrives at it, and
        `ease-glass` decelerates without overshoot so it settles rather than
        bounces. 10px of radius scales to ~14px at full magnification.

        No `will-change`: the strip is as long as the feed, and hinting every
        tile would promote an unbounded number of layers. `scale` is
        compositable without the hint.
      */}
      <span
        className={`relative block size-9 overflow-hidden rounded-[10px] transition-[scale,box-shadow,opacity] duration-[220ms] ease-glass motion-reduce:transition-none sm:size-10 ${
          MAGNIFY[proximity]
        } ${isActive ? "" : "group-active:scale-95 group-hover:opacity-90"}`}
      >
        <Image
          alt=""
          className="object-cover"
          fill={true}
          loading="lazy"
          placeholder="blur"
          sizes="64px"
          src={image.src}
        />
        {/* Specular sheen so the active tile reads as lit glass, not a border. */}
        {isActive ? (
          <span className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/25" />
        ) : null}
      </span>
    </button>
  );
});

interface ImageIndicatorsProps {
  images: readonly GalleryImage[];
  currentIndex: number;
  onImageSelect: (index: number) => void;
}

export function ImageIndicators({
  images,
  currentIndex,
  onImageSelect,
}: ImageIndicatorsProps) {
  const { containerRef, atStart, atEnd } = useDockScroll(
    currentIndex,
    images.length,
  );

  /*
   * No panel behind the strip. The glass slab was the single most
   * template-looking element on the page, and it added a competing surface
   * between the photograph and its own thumbnails. Bare tiles on the colour
   * field read as a contact strip instead.
   *
   * Which also rules out a gradient for the overflow hint: there is no panel
   * colour to fade to, and the field behind changes with every photograph.
   * `dock-fade` masks instead, which is colour-independent — see globals.css.
   */
  return (
    /*
      `min-w-0` on both boxes is what makes the scroller a scroller. A flex
      child's default `min-width: auto` refuses to shrink below its content,
      so without this the strip reports its full width up the tree and pushes
      everything beside it off the screen instead of scrolling — which is
      exactly what it did on a tablet.
    */
    <div className="flex min-w-0 justify-center">
      <div
        /*
          No gap: the slots carry it. A 40px tile centred in a 60px slot
          leaves 10px either side, which is the air the dock magnifies into —
          the selected tile grows to fill its slot and its neighbours lean
          back slightly, without any of them moving.
        */
        className="dock-fade flex min-w-0 max-w-full items-center gap-0 overflow-x-auto px-1 py-2 scrollbar-hide"
        ref={containerRef}
        /*
          0px at an edge that is genuinely the end of the strip, so a dock
          short enough not to overflow carries no mask at all. The two
          lengths are registered with `@property`, which is what lets them
          animate rather than snap when an edge is reached.
        */
        style={
          {
            "--fade-start": atStart ? NO_FADE : FADE_WIDTH,
            "--fade-end": atEnd ? NO_FADE : FADE_WIDTH,
          } as CSSProperties
        }
      >
        {images.map((image, index) => (
          <Thumbnail
            image={image}
            index={index}
            key={image.id}
            onSelect={onImageSelect}
            proximity={
              Math.min(Math.abs(index - currentIndex), FALLOFF) as Proximity
            }
          />
        ))}
      </div>
    </div>
  );
}
