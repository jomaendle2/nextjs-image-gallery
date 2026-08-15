import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { GalleryAuthor } from "@/data/galleryData";
import { ViewToggle } from "./ViewToggle";

/**
 * The header on a contributor's grid page.
 *
 * Set in document flow rather than overlaid on a photograph, so it can be
 * left-aligned and let the toggle sit opposite it — the same left/right
 * anchoring the viewer's caption bar uses, so the two pages read as one site.
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
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <Link
          className="inline-flex items-center gap-1 rounded-full text-[0.6875rem] text-white/45 uppercase tracking-[0.14em] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
          href="/"
        >
          <ArrowLeft aria-hidden="true" size={12} />
          the beauty of earth
        </Link>

        <h1 className="mt-2 font-semibold text-3xl text-white tracking-[-0.04em] sm:text-4xl">
          {contributor.name}
        </h1>

        <p className="mt-1.5 text-[0.6875rem] text-white/40 uppercase tracking-[0.14em]">
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
