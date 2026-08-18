"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { ViewCount } from "@/components/gallery/ViewCount";
import { glassControl } from "@/components/ui/glass-button";
import { ShareButton } from "@/components/ui/ShareButton";
import { Sheet, SheetTrigger } from "@/components/ui/Sheet";
import type { GalleryImage } from "@/data/galleryData";
import { PhotoDetails } from "./PhotoDetails";

/**
 * One row: who made it, how many have looked, share, and a way in.
 *
 * The corner used to be four stacked rows in four type treatments, two of
 * them holding reserved height even when empty. Collapsing all of it behind
 * the photographer's name fixed the crowding and introduced a worse problem:
 * the name is the one thing there that already means something else, so
 * pressing "Jo Mändle" expecting Jo's page got you a panel about a cherry
 * tree. A label and a control are not the same object and should not be the
 * same button.
 *
 * So the name is a link to the photographer again, and the panel has its own
 * ⓘ. The view count and share stay out here rather than moving inside,
 * because both are things you glance at or reach for without wanting to read
 * anything — the count in particular is the metric worth seeing unprompted.
 * Four items on one line, where there were four lines.
 */
export function PhotoCredit({
  image,
  onOpenChange,
}: {
  image: GalleryImage;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const { author } = image;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  /*
   * Whether the name links is a fact about where we are. Both of the
   * photographer's own routes are covered, and the boundary check keeps
   * `/by/anna-b` from suppressing the link on a page about `/by/anna`.
   */
  const pathname = usePathname();
  const ownPage = `/by/${author.slug}`;
  const onOwnPage = pathname === ownPage || pathname.startsWith(`${ownPage}/`);

  return (
    <div className="flex min-w-0 items-center justify-center gap-3 lg:justify-end">
      {onOwnPage ? (
        <span className="truncate text-sm text-white/80">{author.name}</span>
      ) : (
        <Link
          /* Padding out and margin back in: a 44px target on a phone that
             does not move the baseline beside it. */
          className="-my-3 inline-flex min-h-11 shrink-0 items-center rounded-full py-3 text-sm text-white/80 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
          href={ownPage}
        >
          {author.name}
        </Link>
      )}

      <ViewCount
        className="shrink-0 opacity-70 transition-opacity duration-200 hover:opacity-100"
        imageId={image.id}
        variant="gallery"
      />

      {/*
        Keyed by the photograph, so moving to the next one gives a fresh
        instance with fresh state. An effect resetting on `image.id` is the
        thing React's own docs call an anti-pattern, and it had already gone
        wrong here — a ✓ from one photograph stayed lit over the next.

        The only share control in the viewer. A second one inside the panel
        would keep its own ✓, so the same photograph would read as copied in
        one place and not the other.
      */}
      <ShareButton
        className="shrink-0 text-white/55 hover:text-white"
        key={image.id}
        label={image.title === "" ? "this photograph" : image.title}
        path={`/photo/${image.id}`}
        text={image.description}
        title={`${image.title} by ${author.name}`}
      />

      <Sheet onOpenChange={handleOpenChange} open={open}>
        <SheetTrigger
          aria-label="Details for this photograph"
          className={glassControl(
            "flex size-11 shrink-0 items-center justify-center text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80",
            "round",
          )}
        >
          <Info aria-hidden="true" size={16} />
        </SheetTrigger>

        {/*
          Keyed by the photograph, so one photograph's member lookup is never
          alive behind another photograph's caption.

          **Not wrapped in `open ? … : null`.** It was, and that is what left
          the panel with no exit: `Dialog.Content` is already inside Radix's
          own `<Presence>`, which keeps the node in the tree while a
          `data-[state=closed]` animation runs and unmounts it on
          `animationend`. Gating the element on our own `open` state tore the
          subtree out on the same tick the state flipped, so `sheet-out` never
          got a frame — the panel slid in and then vanished. Presence gives us
          the unmount the old comment was asking for anyway, just 180ms later.
        */}
        <PhotoDetails image={image} key={image.id} />
      </Sheet>
    </div>
  );
}
