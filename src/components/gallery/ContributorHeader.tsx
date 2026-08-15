import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { GalleryAuthor } from "@/data/galleryData";
import { ViewToggle } from "./ViewToggle";

/**
 * One header for both contributor views.
 *
 * The grid and the slideshow previously each had their own: centred versus
 * left-aligned, sentence case versus small caps, the toggle under the name
 * versus opposite it. Same photographer, two design systems. This is the
 * single treatment both use, so switching views changes the content and
 * nothing else.
 *
 * Left name, right toggle mirrors the caption bar below the photograph —
 * the whole site anchors information to the edges rather than stacking it
 * down the middle.
 */
export function ContributorHeader({
  contributor,
  photoCount,
  view,
}: {
  contributor: GalleryAuthor;
  photoCount: number;
  view: "grid" | "slideshow";
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <Link
          className="inline-flex items-center gap-1 rounded-full text-[0.6875rem] text-white/45 uppercase tracking-[0.14em] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
          href="/"
        >
          <ArrowLeft aria-hidden="true" size={12} />
          the beauty of earth
        </Link>

        <h1 className="mt-1.5 font-semibold text-2xl text-white tracking-[-0.035em] sm:text-3xl">
          {contributor.name}
        </h1>

        <p className="mt-1 text-[0.6875rem] text-white/40 uppercase tracking-[0.14em]">
          {photoCount} {photoCount === 1 ? "photograph" : "photographs"}
          {contributor.siteUrl === null ? null : (
            <a
              className="ml-2 inline-flex translate-y-px items-center gap-0.5 rounded-full text-white/55 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
              href={contributor.siteUrl}
              rel="noopener noreferrer nofollow"
              target="_blank"
            >
              their site
              <ArrowUpRight aria-hidden="true" size={11} />
            </a>
          )}
        </p>
      </div>

      <ViewToggle slug={contributor.slug} view={view} />
    </header>
  );
}
