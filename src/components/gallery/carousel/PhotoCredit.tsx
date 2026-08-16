"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewCount } from "@/components/gallery/ViewCount";
import { ShareButton } from "@/components/ui/ShareButton";
import type { GalleryAuthor, GalleryImage } from "@/data/galleryData";
import { MemberDetails } from "./MemberDetails";

/**
 * The right half of the wall label: who made the photograph, and how.
 *
 * Set as a technical plate — small, uppercase, wide-tracked — so it reads as
 * data beside the caption rather than competing with it. Photographers trade
 * work for credit, so the name stays legible while the exposure line sits a
 * step quieter behind it.
 */

function exifLine(image: GalleryImage): string | null {
  const { exif } = image;
  if (!exif) {
    return null;
  }
  const parts = [
    exif.camera,
    exif.lens,
    exif.focal_length,
    exif.aperture,
    exif.shutter,
    exif.iso === undefined ? undefined : `ISO ${exif.iso}`,
  ].filter((part): part is string => part !== undefined);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function AuthorLink({ author }: { author: GalleryAuthor }) {
  return (
    <Link
      /* Vertical padding pulled back out by the negative margin: a taller
         touch target on a phone without moving the baseline. `py-2` left it
         at 33px, which is not a touch target — `py-3` clears the 44px floor
         the rest of the site holds to, and the negative margin means the
         caption bar does not move a pixel for it. */
      className="-my-3 inline-flex min-h-11 items-center rounded-full py-3 text-white/80 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
      href={`/by/${author.slug}`}
    >
      {author.name}
    </Link>
  );
}

export function PhotoCredit({ image }: { image: GalleryImage }) {
  const { author, location } = image;
  const exif = exifLine(image);

  /*
   * Whether the name links is a fact about where we are, not something the
   * gallery above needs to know. It used to be a `linkAuthor` prop threaded
   * ImageCarousel → CaptionBar → here purely to suppress a self-link, which
   * meant three components carried a flag only one of them read — and any
   * new caller had to remember to pass it.
   *
   * Both of the photographer's own routes are covered: `/by/<slug>` and
   * `/by/<slug>/slideshow`. The boundary check keeps `/by/anna-b` from
   * suppressing the link on a page about `/by/anna`.
   */
  const pathname = usePathname();
  const ownPage = `/by/${author.slug}`;
  const linkAuthor = !(
    pathname === ownPage || pathname.startsWith(`${ownPage}/`)
  );

  return (
    <div className="flex min-w-0 flex-col items-center gap-1 lg:items-end">
      <p className="text-[0.6875rem] text-white/45 uppercase tracking-[0.14em]">
        {linkAuthor ? (
          <AuthorLink author={author} />
        ) : (
          <span className="text-white/80">{author.name}</span>
        )}
        {author.siteUrl === null ? null : (
          <a
            className="ml-1 inline-flex translate-y-px items-center rounded-full text-white/40 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
            href={author.siteUrl}
            rel="noopener noreferrer nofollow"
            target="_blank"
          >
            <span className="sr-only">{`${author.name}'s own site`}</span>
            <ArrowUpRight aria-hidden="true" size={12} />
          </a>
        )}
        {location === null ? null : (
          <span className="text-white/35">{` — ${location}`}</span>
        )}
      </p>

      {/*
        The count and the share control sit on one line: both are facts about
        this photograph rather than about the gallery, and pairing them keeps
        the credit column to three rows at every width.
      */}
      <div className="flex items-center gap-3">
        <ViewCount
          className="opacity-70 transition-opacity duration-200 hover:opacity-100"
          imageId={image.id}
          variant="gallery"
        />
        {/*
          Keyed by the photograph, so switching to another one gives the
          share button a fresh instance with fresh state. The alternative —
          an effect that resets on `image.id` — is the thing React's own docs
          call an anti-pattern, and it had already gone wrong here: the
          effect was written with an empty dependency list, so it reset once
          on mount and never again, and a ✓ from one photograph stayed lit
          over the next.
        */}
        <ShareButton
          className="text-white/55 hover:text-white"
          key={image.id}
          label={image.title === "" ? "this photograph" : image.title}
          path={`/photo/${image.id}`}
          text={image.description}
          title={`${image.title} by ${image.author.name}`}
        />
      </div>

      {/*
        The exposure line is for the people who care about it and invisible to
        everyone else. Hidden below `sm`, where the caption and the photograph
        already fill the frame.

        Rendered whether or not there is anything to put in it. Only two
        photographs in fourteen currently carry EXIF, and when this element
        came and went with the data it took 19px of the caption bar with it
        — which the photograph above absorbed, so choosing a photograph with
        a lens recorded resized the image and nudged everything in the bar.
        An empty paragraph holds the line instead. It has no text content, so
        a screen reader passes straight over it.
      */}
      <p className="hidden min-h-4 max-w-full truncate text-[0.625rem] text-white/30 uppercase leading-4 tabular-nums tracking-[0.12em] sm:block">
        {exif}
      </p>

      {/*
        Where it was taken and how, for members. Its own request — see
        `MemberDetails` — so the page stays cacheable and the data never
        reaches somebody who has not paid for it.
      */}
      <MemberDetails photoId={image.id} />
    </div>
  );
}
