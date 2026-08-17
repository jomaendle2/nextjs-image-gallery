"use client";

import { Close, Description } from "@radix-ui/react-dialog";
import { Minus, Plus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BODY_SMALL, META, TOUCH_LINK } from "@/components/ui/field";
import { glassControl } from "@/components/ui/glass-button";
import { cellKeyOf, type GlobePoint } from "@/lib/photos/globe";
import { count } from "@/lib/plural";
import { GlobeCanvas } from "./GlobeCanvas";
import { attachGestures } from "./gestures";
import type { GlobePlace } from "./places";
import { MAX_ZOOM, nextZoomStop, previousZoomStop } from "./zoom";

/**
 * Everything inside the expanded globe, and the only reason this is a file.
 *
 * `GlobeStage` loads it on the click that opens the overlay, and until then
 * none of it is on the page. That is the whole point: the interaction — the
 * gesture vocabulary, the magnification, the hit testing, the card and the
 * `next/image` runtime behind its thumbnail — is worth about eight kilobytes
 * gzipped, and `/globe` renders an inline globe for every visitor while very
 * few of them ever open this one. The page should not pay for the instrument
 * on the chance somebody picks it up.
 *
 * The split is what makes `attach` on `GlobeCanvas` worth its indirection:
 * the canvas itself is shared with the inline globe, so `attachGestures` is
 * handed to it from here rather than imported by it.
 */

/**
 * How large the sphere has to be, **in device pixels**, before the finer
 * coastline is worth fetching.
 *
 * Device pixels, not CSS pixels, and the difference is the whole point. The
 * first version of this used CSS pixels and a threshold of 600, which
 * excluded every phone — but a 390px-wide handset at DPR 3 paints the globe
 * across roughly 1000 real pixels, which is *more* than a 1440 laptop at DPR
 * 1. Judging detail by CSS pixels denies the finer coastline to precisely the
 * screens that resolve it best.
 *
 * Multiplied by the zoom rather than measured once on open, so the step up in
 * detail follows the magnification and happens on every screen. A 1440x700
 * window measures 700 device pixels and starts on the everyday coastline,
 * whose vertices are about four device pixels apart at 2.5x — visibly
 * polygonal, and exactly the reader this used to leave behind.
 */
const FINE_FROM_DEVICE_PX = 900;

/** The card, in CSS pixels: wide enough for a place name on one or two lines. */
const CARD_WIDTH = 216;
const CARD_GAP = 18;
const THUMB = 96;

const ROUND =
  "inline-flex size-11 items-center justify-center rounded-full text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80 disabled:cursor-default disabled:opacity-35";

export function GlobeOverlay({
  points,
  places,
}: {
  points: readonly GlobePoint[];
  places: Map<string, GlobePlace> | null;
}) {
  const [zoom, setZoom] = useState(1);
  const [wide, setWide] = useState(false);
  const [chosen, setChosen] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);

  /*
   * The unzoomed size of the *sphere* in device pixels, so the detail
   * threshold can be re-tested against a new zoom without measuring again
   * mid-gesture.
   *
   * Measured off the canvas rather than the window. The canvas is
   * `min(96vw, 74vh)` and the sphere fills 88% of it, so a window-based
   * estimate runs about a third high on a landscape display and fetches the
   * finer coastline for a sphere that cannot show it.
   */
  const across = useRef(0);
  const stage = useRef<HTMLDivElement | null>(null);

  const considerDetail = useCallback((at: number) => {
    // Never downgrades: the finer set is already fetched and already drawn,
    // and swapping back to the coarse one on zooming out would be a visible
    // loss for no saving at all.
    setWide((was) => was || across.current * at >= FINE_FROM_DEVICE_PX);
  }, []);

  /*
   * Measured after mount rather than during render. The window has no size on
   * the server, and this component is client-only, but reading layout while
   * rendering is still the wrong place for it.
   */
  useEffect(() => {
    const box = stage.current?.getBoundingClientRect();
    across.current =
      (box?.width ?? 0) * 0.88 * (globalThis.devicePixelRatio || 1);
    considerDetail(1);
  }, [considerDetail]);

  const handleZoom = useCallback(
    (at: number) => {
      setZoom(at);
      considerDetail(at);
    },
    [considerDetail],
  );

  const step = useCallback(
    (to: number) => {
      handleZoom(to);
      setChosen(null);
    },
    [handleZoom],
  );

  // Hoisted out of the buttons' JSX: an arrow written inline is a fresh
  // function on every render, which is what `noJsxPropsBind` is about.
  const stepIn = useCallback(() => {
    /*
     * `nextZoomStop` wraps to the first stop once past the last, which is
     * right for a control that cycles and wrong for this one: the `+` button
     * is `disabled` at the ceiling, so the key that does the same thing must
     * stop there too rather than dropping the reader back to 1x. The wheel
     * already clamps.
     */
    step(Math.max(zoom, nextZoomStop(zoom)));
  }, [step, zoom]);
  const stepOut = useCallback(() => {
    step(previousZoomStop(zoom));
  }, [step, zoom]);

  /*
   * `+`, `-` and `0` on the dialog itself, so the magnification is reachable
   * without finding the buttons — and so a keyboard has the same three states
   * a wheel does. Arrow keys are deliberately absent: the marks are not
   * focusable and the list on the page behind is the keyboard path to the
   * photographs, so an arrow key here would move a picture rather than a
   * cursor.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "+" || event.key === "=") {
        stepIn();
      } else if (event.key === "-" || event.key === "_") {
        stepOut();
      } else if (event.key === "0") {
        step(1);
      }
    };
    globalThis.addEventListener("keydown", onKey);
    return () => {
      globalThis.removeEventListener("keydown", onKey);
    };
  }, [step, stepIn, stepOut]);

  const point = chosen === null ? undefined : points[chosen.index];
  const place =
    point === undefined
      ? undefined
      : places?.get(cellKeyOf(point.lat, point.lng));

  return (
    <>
      {/*
        Square, sized off whichever axis is scarcer so the sphere is never
        cropped — a landscape window and a portrait one run out in opposite
        directions.

        The numbers are as generous as the chrome allows, because the first
        version was not and the result was absurd: at 390x844, `min(88vw,
        82vh)` came out at 343px while the globe on the page behind it
        measured 358. A control promising a bigger view delivered a smaller
        one. On a phone the width is all there is, so it takes nearly all of
        it.

        `relative`, because the card is positioned against this box in the
        same CSS pixels the canvas reports its marks in.

        `dvh` rather than `vh`: on iOS Safari `vh` resolves against the *large*
        viewport, the one without the URL bar, so a sphere sized in `vh` is
        taller than the screen actually showing it and pushes the line of
        instructions below it under the browser chrome. The rest of the
        codebase already uses `dvh`; this was the outlier.
      */}
      <div
        className="relative h-[min(96vw,74dvh)] w-[min(96vw,74dvh)]"
        ref={stage}
      >
        <GlobeCanvas
          attach={attachGestures}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          detail={wide ? "fine" : "coarse"}
          interactive={true}
          onHover={setChosen}
          onZoomChange={handleZoom}
          points={points}
          zoom={zoom}
        />

        {chosen !== null && place !== undefined ? (
          <PlaceCard at={chosen} place={place} />
        ) : null}
      </div>

      <Description className={BODY_SMALL}>
        Drag to turn it. Scroll or pinch to zoom. Point at a mark to see what is
        there.
      </Description>

      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          aria-label="Zoom out"
          className={glassControl(ROUND)}
          disabled={zoom <= 1}
          onClick={stepOut}
          type="button"
        >
          <Minus aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Zoom in"
          className={glassControl(ROUND)}
          disabled={zoom >= MAX_ZOOM}
          onClick={stepIn}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
        </button>
        <Close aria-label="Close the globe" className={glassControl(ROUND)}>
          <X aria-hidden="true" size={16} />
        </Close>
      </div>
    </>
  );
}

/**
 * What is at the place being pointed at.
 *
 * HTML over the canvas rather than text drawn into it, and the reasons are
 * cumulative: canvas text cannot use the type scale or these tokens, would
 * need a colour string — the exact thing `design.test.ts` forbids in this
 * folder — would need its own font loading, and its links would not be links.
 *
 * **The thumbnail's bytes are requested here and nowhere earlier.** The
 * `<img>` mounts only when a card renders, so a reader who opens the globe
 * and turns it without pointing at anything downloads no photographs at all.
 * That is the whole reason the picture is one per *cell* chosen on the server
 * rather than one per photograph, which `docs/next-version.md` §2 measured at
 * 5.4 KB a row and refused.
 *
 * `bg_color` rather than a blur placeholder, for the same argument in
 * miniature: seven characters of hex against a few hundred bytes of base64,
 * behind an image that is on screen while a pointer rests on a dot.
 */
function PlaceCard({
  at,
  place,
}: {
  at: { x: number; y: number };
  place: GlobePlace;
}) {
  return (
    /*
     * Clamped to the stage on both axes, so a mark near an edge does not push
     * the card off it. `translate(-50%, -100%)` puts it above the mark, which
     * is where a pointer is not.
     *
     * `glass-thick` rather than the flat `glass-hairline` the forms use, and
     * this is the case that utility's own docblock carves out: the cost of
     * `backdrop-filter` is a snapshot-and-blur of everything behind the
     * element per frame, which is ruinous across twenty admin rows and nearly
     * free for one small card. It is also the right reading of the surface —
     * a form field is printed on a page, and this genuinely is floating over
     * a sphere. Flat, it was a rectangle of continents with words on top.
     */
    <div
      className="glass-thick pointer-events-auto absolute z-10 rounded-xl p-3"
      style={{
        left: `clamp(${CARD_WIDTH / 2}px, ${at.x}px, calc(100% - ${CARD_WIDTH / 2}px))`,
        top: `clamp(${CARD_GAP}px, ${at.y - CARD_GAP}px, 100%)`,
        transform: "translate(-50%, -100%)",
        width: CARD_WIDTH,
      }}
    >
      {place.thumb === null ? null : (
        <Image
          alt=""
          className="mb-2.5 h-24 w-full rounded-lg object-cover"
          height={THUMB}
          sizes={`${CARD_WIDTH}px`}
          src={place.thumb.url}
          style={{ backgroundColor: place.thumb.bg }}
          width={CARD_WIDTH}
        />
      )}

      <p className={META}>{place.label}</p>
      <p className={`mt-1 ${BODY_SMALL}`}>{count(place.count, "photograph")}</p>

      {/*
        The photographs themselves, as real links, so pointing at a place and
        going to what is there is one gesture rather than two. Capped, because
        a card is not a page — the list on `/globe` behind this overlay is
        where every photograph in the cell lives, and it is complete.
      */}
      <ul className="mt-2 space-y-0.5">
        {place.photos.slice(0, 4).map((photo) => (
          <li key={photo.id}>
            {/*
              `TOUCH_LINK` brings `inline-flex`, so a `block` here would be a
              second `display` in one attribute with the winner left to emit
              order — and `truncate` does not ellipsize a flex container
              anyway, so a long title overflowed the card instead of clipping.
              The truncation goes on a child that is actually a block.
            */}
            <Link
              className={`w-full text-[0.8125rem] text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 ${TOUCH_LINK}`}
              href={`/photo/${photo.id}`}
            >
              <span className="block w-full truncate">{photo.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
