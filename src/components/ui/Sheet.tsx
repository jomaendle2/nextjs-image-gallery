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
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { glassControl } from "@/components/ui/glass-button";
import { cn } from "@/lib/utils";

/**
 * A panel that slides in from the right, over whatever is behind it.
 *
 * Radix rather than shadcn's `sheet`. `components.json` is still in the repo,
 * but the shadcn CSS variables it generates against (`--background`,
 * `--primary`, …) were deleted from `globals.css` as dead code, so
 * `npx shadcn add sheet` emits a component whose classes no longer resolve.
 * Restoring them would stand a second colour system up beside the OKLCH one,
 * which DESIGN.md warns about by name. Radix gives us the part that is
 * genuinely hard — focus trap, scroll lock, escape, `aria-modal`, inert
 * background — and we keep our own surface vocabulary.
 *
 * The panel overlays; it never insets what is behind it. In the viewer that
 * is not a stylistic choice: the caption bar is in flex flow, so anything
 * that takes width would resize the photograph, and "controls hold their
 * size when their state changes" is the rule that exists because a bar that
 * resizes under a photograph moves the photograph.
 */

export const Sheet = Root;
export const SheetTrigger = Trigger;

export function SheetContent({
  children,
  title,
  description,
  className,
}: {
  children: ReactNode;
  /**
   * Required, even when it is not drawn. A dialog with no accessible name is
   * announced as "dialog" and nothing else; Radix warns in development.
   * Pass `titleVisible={false}`-style styling by rendering your own heading
   * inside `children` — this one is always the label.
   */
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <Portal>
      {/*
        Barely there, and no blur.
        
        The overlay exists so that clicking away closes the panel; it is not
        a scrim. Blurring here would hide the photograph behind a panel whose
        entire subject is that photograph — the reader opened it to learn
        where the picture was taken, and would then be reading about a
        picture they can no longer see. A tenth-opacity wash is enough to
        separate the two planes.
      */}
      <Overlay className="fixed inset-0 z-[110] bg-black/10 data-[state=closed]:animate-[viewer-backdrop-out_180ms_var(--ease-glass)] data-[state=open]:animate-[viewer-fade-in_300ms_var(--ease-glass)_backwards]" />
      <Content
        className={cn(
          /*
           * `safe-*-6` rather than `p-6`. The panel is `inset-y-0`, so on a
           * phone it runs the whole height of a display that `viewport-fit:
           * cover` has extended behind the notch and the home indicator —
           * 24px of padding puts the title under one and the last field
           * under the other. Each utility takes the larger of 24px and the
           * device's inset, so on a desktop this is still exactly `p-6`.
           */
          "glass-thick fixed inset-y-0 right-0 z-[120] flex w-full flex-col gap-5 overflow-y-auto rounded-l-3xl safe-x-6 safe-t-6 safe-b-6 sm:max-w-sm",
          // Transform and opacity only — never a layout property.
          "data-[state=closed]:animate-[sheet-out_180ms_var(--ease-glass)] data-[state=open]:animate-[sheet-in_320ms_var(--ease-glass)_backwards]",
          className,
        )}
      >
        <Title className="pr-12 font-semibold text-lg text-white tracking-[-0.03em]">
          {title}
        </Title>
        {description === undefined ? (
          /*
           * Radix warns when `aria-describedby` is neither set nor waived.
           * Waiving it is correct here: the panel's content is a list of
           * fields, and a screen reader reading all of them as one
           * description before the user reaches them is worse than none.
           */
          <Description className="sr-only">
            Details for this photograph.
          </Description>
        ) : (
          <Description className="text-sm text-white/60">
            {description}
          </Description>
        )}

        {/*
          The wrapper carries the inset, not the button. An absolutely
          positioned element is placed against its ancestor's padding *box*,
          whose top edge is the border edge — so the panel's own `safe-t-6`
          does not move a `top-5` child down at all, and the close button
          would sit under the notch while the title it overlaps did not.
        */}
        <div className="pointer-events-none absolute top-0 right-0 safe-x-5 safe-t-5">
          <Close
            aria-label="Close details"
            className={glassControl(
              "pointer-events-auto flex size-11 items-center justify-center",
              "round",
            )}
          >
            <X aria-hidden="true" size={18} />
          </Close>
        </div>

        {children}
      </Content>
    </Portal>
  );
}
