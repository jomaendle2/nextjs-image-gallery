"use client";

import {
  Close,
  Content,
  Description,
  Overlay,
  Portal,
  Root,
  Title,
  Trigger,
} from "@radix-ui/react-dialog";
import { Maximize2, X } from "lucide-react";
import { useCallback, useState } from "react";
import { META } from "@/components/ui/field";
import { glassControl } from "@/components/ui/glass-button";
import type { GlobePoint } from "@/lib/photos/globe";
import { count } from "@/lib/plural";
import { GlobeCanvas } from "./GlobeCanvas";

/**
 * The globe, and the way to look at it properly.
 *
 * Two sizes rather than one, because the two jobs are different. Inline it is
 * a picture of the subject, sized to sit beside a paragraph. Opened, it is
 * the thing itself: as large as the window allows, turnable, and drawn from a
 * coastline four times finer — which is fetched on that click and never
 * before, so the page costs nothing for a reader who does not open it.
 *
 * Radix rather than a hand-rolled overlay, for the same reason `Sheet` uses
 * it: the genuinely hard parts are focus trapping, scroll locking, Escape,
 * `aria-modal` and making the background inert. What is ours is the surface.
 *
 * The trigger is a real button with a real label, which matters more here
 * than it looks. The canvas is `aria-hidden` decoration over a complete list
 * of links; wrapping it in a button is what keeps the one interactive thing
 * on this page reachable from a keyboard.
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
 */
const FINE_FROM_DEVICE_PX = 900;

export function GlobeStage({ points }: { points: readonly GlobePoint[] }) {
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);

  /*
   * Measured when it opens rather than during render. The window has no size
   * on the server, so reading it while rendering is a hydration mismatch
   * waiting for somebody to move this component somewhere it renders early.
   */
  const handleOpen = useCallback((next: boolean) => {
    if (next) {
      const across =
        Math.min(globalThis.innerWidth, globalThis.innerHeight) *
        (globalThis.devicePixelRatio || 1);
      setWide(across >= FINE_FROM_DEVICE_PX);
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
            className={glassControl(
              `inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-white/70 transition-colors group-hover:text-white ${META}`,
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

        <Content className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-4 p-4 focus:outline-none data-[state=open]:animate-[viewer-fade-in_320ms_var(--ease-glass)_backwards]">
          <Title className={META}>
            {`The globe · ${count(points.length, "place")}`}
          </Title>

          {/*
            Square, sized off whichever axis is scarcer so the sphere is never
            cropped — a landscape window and a portrait one run out in
            opposite directions.

            The numbers are as generous as the chrome allows, because the
            first version was not and the result was absurd: at 390x844,
            `min(88vw, 82vh)` came out at 343px while the globe on the page
            behind it measured 358. A control promising a bigger view
            delivered a smaller one. On a phone the width is all there is, so
            it takes nearly all of it.
          */}
          <GlobeCanvas
            className="h-[min(96vw,74vh)] w-[min(96vw,74vh)] cursor-grab active:cursor-grabbing"
            detail={wide ? "fine" : "coarse"}
            points={points}
          />

          <Description className="text-[0.8125rem] text-white/55">
            Drag to turn it.
          </Description>

          <Close
            aria-label="Close the globe"
            className={glassControl(
              "absolute top-4 right-4 inline-flex size-11 items-center justify-center rounded-full text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80",
            )}
          >
            <X aria-hidden="true" size={16} />
          </Close>
        </Content>
      </Portal>
    </Root>
  );
}
