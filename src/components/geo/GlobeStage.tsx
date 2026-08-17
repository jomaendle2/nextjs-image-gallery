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
 * Below this the finer coastline is invisible and the swap is bytes for
 * nothing, so the expanded globe only asks for it once it is genuinely large.
 * A phone in portrait gets the same picture, just not the same file.
 */
const FINE_FROM_PX = 600;

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
      setWide(
        Math.min(globalThis.innerWidth, globalThis.innerHeight) >= FINE_FROM_PX,
      );
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
        <button
          className="group relative block w-full cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
          type="button"
        >
          <GlobeCanvas className="w-full" points={points} />
          <span
            className={glassControl(
              `absolute right-2 bottom-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-white/70 transition-colors group-hover:text-white ${META}`,
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
            Square, and sized off the *smaller* axis so the sphere is never
            cropped. `min(88vw, 82vh)` rather than a max-width, because a
            landscape window and a portrait one fail in opposite directions.
          */}
          <GlobeCanvas
            className="h-[min(88vw,82vh)] w-[min(88vw,82vh)] cursor-grab active:cursor-grabbing"
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
