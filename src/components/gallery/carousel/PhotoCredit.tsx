import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { GalleryAuthor, GalleryImage } from "@/data/galleryData";

/**
 * Attribution, and the way into a photographer's own page.
 *
 * Kept deliberately quiet — one line, low contrast, never competing with the
 * photograph — but always present. Photographers trade work for credit, so
 * this is a feature of the gallery rather than a footnote on it.
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
      className="rounded-full text-white/70 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
      href={`/by/${author.slug}`}
    >
      {author.name}
    </Link>
  );
}

export function PhotoCredit({ image }: { image: GalleryImage }) {
  const { author, location } = image;
  const exif = exifLine(image);

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-[0.8125rem] text-white/55">
        <span className="text-white/40">by </span>
        <AuthorLink author={author} />
        {author.siteUrl === null ? null : (
          <>
            {" "}
            <a
              className="inline-flex items-center gap-0.5 rounded-full text-white/45 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
              href={author.siteUrl}
              rel="noopener noreferrer nofollow"
              target="_blank"
            >
              <span className="sr-only">{`${author.name}'s own site`}</span>
              <ArrowUpRight aria-hidden="true" size={13} />
            </a>
          </>
        )}
        {location === null ? null : (
          <span className="text-white/40">{` · ${location}`}</span>
        )}
      </p>

      {/*
        The exposure line is for the people who care about it and invisible
        to everyone else. Hidden on small screens, where the caption and the
        photograph already fill the frame.
      */}
      {exif === null ? null : (
        <p className="hidden text-[0.6875rem] text-white/30 tabular-nums sm:block">
          {exif}
        </p>
      )}
    </div>
  );
}
