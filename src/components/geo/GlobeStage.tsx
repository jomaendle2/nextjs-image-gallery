"use client";

import {
  Content,
  Overlay,
  Portal,
  Root,
  Title,
  Trigger,
} from "@radix-ui/react-dialog";
import { Maximize2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { META, META_TYPE } from "@/components/ui/field";
import { glassControl } from "@/components/ui/glass-button";
import type { GlobePoint } from "@/lib/photos/globe";
import { count } from "@/lib/plural";
import { GlobeCanvas } from "./GlobeCanvas";
import { type GlobePlace, loadPlaces } from "./places";

/**
 * The globe, and the way to look at it properly.
 *
 * Two sizes rather than one, because the two jobs are different. Inline it is
 * a picture of the subject, sized to sit beside a paragraph. Opened, it is
 * the thing itself: as large as the window allows, turnable in both
 * directions, magnifiable, drawn from a coastline four times finer, and
 * answering when a place is pointed at.
 *
 * Radix rather than a hand-rolled overlay, for the same reason `Sheet` uses
 * it: the genuinely hard parts are focus trapping, scroll locking, Escape,
 * `aria-modal` and making the background inert. What is ours is the surface.
 *
 * The trigger is a real button with a real label, which matters more here
 * than it looks. The canvas is `aria-hidden` decoration over a complete list
 * of links; wrapping it in a button is what keeps the one interactive thing
 * on this page reachable from a keyboard.
 *
 * **On the canvas staying unreachable by keyboard.** `PhotoGrid` records the
 * rule that "a tile that only names itself to a mouse is one a keyboard user
 * navigates blind", and that rule is satisfied here at the page level rather
 * than inside this component: `/globe` already renders every one of these
 * places, with every photograph under it, as an ordered list of real links
 * that works with JavaScript switched off. Making a few hundred marks
 * focusable would add a few hundred tab stops announcing a worse version of a
 * list the reader can already read, and the list would still be the thing
 * anybody actually used. What must not happen is a mouse-only control inside
 * a focus trap — so the zoom steps, the close button and everything in the
 * card are real buttons and real links.
 */

/**
 * The inside of the overlay, fetched on the click that opens it.
 *
 * `ssr: false` because there is nothing to render on the server: the dialog
 * is shut until somebody presses the button, and the component measures its
 * own canvas on mount. What this buys is roughly eight kilobytes gzipped off
 * `/globe` — the gesture vocabulary, the magnification, the hit testing, the
 * card and the `next/image` runtime behind its thumbnail — on a page whose
 * visitors mostly never open the globe at all.
 *
 * It arrives alongside the finer coastline and the places, on the same click,
 * so it adds no round trip that was not already happening.
 */
const GlobeOverlay = dynamic(
  () => import("./GlobeOverlay").then((module) => module.GlobeOverlay),
  { ssr: false },
);

export function GlobeStage({
  points,
  places: placeCount,
}: {
  points: readonly GlobePoint[];
  /**
   * How many *places* the page lists, which is not how many dots this draws.
   *
   * A dot is a coarsened cell; a place is what a reader would name, and
   * `groupIntoPlaces` gathers nearby cells sharing a region into one. Three
   * cells around Bali are three dots and one heading. Counting `points` here
   * put "26 places" above a list that said 22 — two different counts of the
   * same word on one screen — so the number comes from the page rather than
   * from the array this happens to hold.
   */
  places: number;
}) {
  const [open, setOpen] = useState(false);
  const [places, setPlaces] = useState<Map<string, GlobePlace> | null>(null);

  const handleOpen = useCallback((next: boolean) => {
    if (next) {
      /*
       * Started here rather than inside the overlay, so the request is in
       * flight while the overlay's own JavaScript is still downloading.
       */
      loadPlaces()
        .then((list) => {
          setPlaces(new Map(list.map((entry) => [entry.key, entry])));
        })
        .catch((cause: unknown) => {
          // The card is the enhancement on top of the enhancement. Without it
          // the globe still turns and the page behind it still lists every
          // photograph, so this must not reach the error boundary.
          console.error("Could not load the places:", cause);
        });
    }
    setOpen(next);
  }, []);

  return (
    <Root onOpenChange={handleOpen} open={open}>
      <Trigger asChild={true}>
        {/*
          The whole globe is the target, with a pill in the corner saying so.
          Always visible rather than revealed on hover: a hover affordance on
          a touch screen is an affordance that does not exist.
        */}
        {/*
          The pill sits under the sphere rather than over it. Half on and half
          off the globe, it read as pasted on — and at 390 its edge came
          within a few pixels of the page gutter. Centred beneath, it belongs
          to the globe without covering any of it.
        */}
        <button
          className="group flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
          type="button"
        >
          <GlobeCanvas className="w-full" points={points} />
          <span
            /*
             * `META_TYPE` rather than `META`: `glassControl` merges through
             * `twMerge`, so `META`'s own `text-white/55` would come last and
             * silently beat the `/70` this call site is asking for.
             */
            className={glassControl(
              `inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-white/70 transition-colors group-hover:text-white ${META_TYPE}`,
            )}
          >
            <Maximize2 aria-hidden="true" size={12} />
            Open the globe
          </span>
        </button>
      </Trigger>

      <Portal>
        {/*
          Near-opaque rather than a light scrim. This is the one moment the
          site asks somebody to look at something that is not a photograph,
          and a sphere reads on black the way it reads from space.
        */}
        <Overlay className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm data-[state=closed]:animate-[viewer-backdrop-out_180ms_var(--ease-glass)] data-[state=open]:animate-[viewer-fade-in_300ms_var(--ease-glass)_backwards]" />

        {/*
          `overscroll-contain` so a wheel that runs past the magnification
          ceiling stops there rather than scrolling whatever is behind the
          overlay.
        */}
        <Content className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-4 overscroll-contain p-4 focus:outline-none data-[state=open]:animate-[viewer-fade-in_320ms_var(--ease-glass)_backwards]">
          {/*
            The title stays here rather than moving into the lazily-loaded
            half. Radix wants a `Title` inside `Content` for the dialog to be
            labelled, and a dialog announcing itself as nothing for the few
            hundred milliseconds its contents are downloading is one a screen
            reader user opens blind.
          */}
          <Title className={META}>
            {`The globe · ${count(placeCount, "place")}`}
          </Title>

          <GlobeOverlay places={places} points={points} />
        </Content>
      </Portal>
    </Root>
  );
}
