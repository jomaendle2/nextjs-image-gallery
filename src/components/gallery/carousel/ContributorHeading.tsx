import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { GalleryAuthor } from "@/data/galleryData";
import { ViewToggle } from "../ViewToggle";

/**
 * The heading on a contributor's page.
 *
 * Without this, `/by/<slug>` renders identically to `/` — same title, same
 * photographs, nothing saying whose work it is. That page is the one URL a
 * photographer actually shares, so it has to introduce them, link to their
 * own site, and offer the way back to the whole gallery.
 */
export function ContributorHeading({
  contributor,
  photoCount,
}: {
  contributor: GalleryAuthor;
  photoCount: number;
}) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-1 px-6 text-center">
      <Link
        className="inline-flex items-center gap-1 rounded-full text-[0.8125rem] text-white/55 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
        href="/"
      >
        <ArrowLeft aria-hidden="true" size={13} />
        the beauty of earth.
      </Link>

      <h1 className="font-semibold text-2xl text-white tracking-[-0.045em] sm:text-3xl md:text-[2.125rem] [text-shadow:0_1px_16px_oklch(0%_0_0_/_0.35)]">
        {contributor.name}
      </h1>

      <div className="mt-1">
        <ViewToggle slug={contributor.slug} view="slideshow" />
      </div>

      <p className="text-[0.8125rem] text-white/50">
        {photoCount} {photoCount === 1 ? "photograph" : "photographs"}
        {contributor.siteUrl === null ? null : (
          <>
            ·
            <a
              className="inline-flex items-center gap-0.5 rounded-full underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
              href={contributor.siteUrl}
              rel="noopener noreferrer nofollow"
              target="_blank"
            >
              their site
              <ArrowUpRight aria-hidden="true" size={12} />
            </a>
          </>
        )}
      </p>
    </div>
  );
}
