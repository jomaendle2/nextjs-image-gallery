"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewCount } from "@/components/gallery/ViewCount";
import type { GalleryAuthor, GalleryImage } from "@/data/galleryData";

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
         touch target on a phone without moving the baseline. */
      className="-my-2 inline-block rounded-full py-2 text-white/80 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
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

      <ViewCount
        className="opacity-70 transition-opacity duration-200 hover:opacity-100"
        imageId={image.id}
        variant="gallery"
      />

      {/*
        The exposure line is for the people who care about it and invisible to
        everyone else. Hidden below `sm`, where the caption and the photograph
        already fill the frame.
      */}
      {exif === null ? null : (
        <p className="hidden max-w-full truncate text-[0.625rem] text-white/30 uppercase tabular-nums tracking-[0.12em] sm:block">
          {exif}
        </p>
      )}
    </div>
  );
}
