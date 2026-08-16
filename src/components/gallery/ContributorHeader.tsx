import { ArrowLeft, ArrowUpRight, Rss } from "lucide-react";
import Link from "next/link";
import { ShareButton } from "@/components/ui/ShareButton";
import type { GalleryAuthor } from "@/data/galleryData";
import { count } from "@/lib/plural";
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
    <div className="glass-bar w-full">
      <header className="mx-auto flex w-full max-w-[1536px] flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-8 sm:py-6">
        <div className="min-w-0">
          {/*
            The wordmark keeps its own setting — lowercase, with the full
            stop. Small caps are the language for metadata like the photo
            count below; putting the mark itself in tracked capitals and
            dropping its period made it read as a different logo.
          */}
          <Link
            className="-my-3 inline-flex min-h-11 items-center gap-1.5 rounded-full py-3 font-semibold text-[0.8125rem] text-white/45 tracking-[-0.02em] transition-colors hover:text-white/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
            href="/"
          >
            <ArrowLeft aria-hidden="true" size={13} />
            the beauty of earth.
          </Link>

          <h1 className="mt-1.5 font-semibold text-2xl text-white tracking-[-0.035em] sm:text-3xl">
            {contributor.name}
          </h1>

          {/*
            The handle, under the name and above the counts.
            
            A photographer's page is the thing they will actually send
            people, so it needs something a person can repeat out loud and
            type from memory. `/by/jo-maendle` is a path; `@jo-maendle` is a
            name. Same URL either way — this is a label, not a second route
            to keep working.
          */}
          <p className="mt-0.5 font-medium text-[0.8125rem] text-accent">
            @{contributor.slug}
          </p>

          <p className="mt-1 text-[0.6875rem] text-white/40 uppercase tracking-[0.14em]">
            {count(photoCount, "photograph")}
            {contributor.siteUrl === null ? null : (
              <a
                className="-my-3 ml-2 inline-flex min-h-11 translate-y-px items-center gap-0.5 rounded-full py-3 text-white/55 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
                href={contributor.siteUrl}
                rel="noopener noreferrer nofollow"
                target="_blank"
              >
                their site
                <ArrowUpRight aria-hidden="true" size={11} />
              </a>
            )}
            {/*
              A visible way to subscribe, next to the link out to their own
              site — the two things a reader might want to keep. Autodiscovery
              in the page metadata only helps somebody who already has a
              reader open and knows to look; this is for the person who does
              not know the feed exists.
            */}
            <a
              className="-my-3 ml-2 inline-flex min-h-11 translate-y-px items-center gap-0.5 rounded-full py-3 text-white/55 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
              href={`/by/${contributor.slug}/feed.xml`}
            >
              follow
              <Rss aria-hidden="true" size={10} />
            </a>
            {/*
              Sharing a photographer, which had no affordance at all — the
              site could share one photograph and not the person who took
              it, which is backwards for the page most likely to be passed
              on.
            */}
            <ShareButton
              className="ml-2 translate-y-px text-white/55 hover:text-white"
              key={contributor.slug}
              label={`${contributor.name}'s photographs`}
              path={`/by/${contributor.slug}`}
              text={`Photographs by ${contributor.name}`}
              title={`${contributor.name} — the beauty of earth.`}
            />
          </p>
        </div>

        <ViewToggle slug={contributor.slug} view={view} />
      </header>
    </div>
  );
}
