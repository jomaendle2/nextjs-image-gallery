"use client";

import { Info } from "lucide-react";
import { useCallback, useState } from "react";
import { glassControl } from "@/components/ui/glass-button";
import { Sheet, SheetTrigger } from "@/components/ui/Sheet";
import type { GalleryImage } from "@/data/galleryData";
import { PhotoDetails } from "./PhotoDetails";

/**
 * One control where there used to be a column of four.
 *
 * The corner held the photographer's name, then a view count beside a share
 * button, then the exposure line, then the member block — four rows in four
 * type treatments, two of them holding reserved height even when empty. It
 * read as a stack of labels rather than anything you could act on, and the
 * membership line in particular looked disabled.
 *
 * The name stays on the button rather than moving inside the panel with
 * everything else. Credit is the deal with contributors, not decoration, and
 * a button labelled with the photographer's name also says what it opens.
 *
 * `onOpenChange` is lifted here rather than left to the trigger, because the
 * carousel needs to know: arrow keys page the photographs, and they must not
 * do that while somebody is reading a panel about one of them.
 */
export function PhotoCredit({
  image,
  onOpenChange,
}: {
  image: GalleryImage;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  return (
    /*
      Centred under the caption when the bar is stacked, hard right when it is
      three columns — the same alignment the four-row credit column held, so
      the bar's silhouette does not change.
    */
    <div className="flex justify-center lg:justify-end">
      <Sheet onOpenChange={handleOpenChange} open={open}>
        <SheetTrigger
          /*
            An explicit name. The visible text is the photographer, which
            says who but not what the control does; a trailing `sr-only`
            span said what it does but concatenated straight onto the
            surname, giving "Jo Mändle— open details for this photograph".
            The visible text is still contained in the accessible name,
            which is what WCAG 2.5.3 asks for.
          */
          aria-label={`${image.author.name} — details for this photograph`}
          className={glassControl(
            "inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80",
          )}
        >
          {image.author.name}
          <Info aria-hidden="true" className="text-white/55" size={15} />
        </SheetTrigger>

        {/*
        Mounted only while open, and keyed by the photograph. A panel that
        stayed mounted would keep one photograph's member lookup alive behind
        another photograph's caption.
      */}
        {open ? <PhotoDetails image={image} key={image.id} /> : null}
      </Sheet>
    </div>
  );
}
