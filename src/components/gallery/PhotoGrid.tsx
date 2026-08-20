import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import type { GalleryAuthor, GalleryImage } from "@/data/galleryData";
import { FALLBACK_TINT, GROUND, photoGlow } from "@/lib/photo-ground";
import { photoAltText } from "@/lib/photos/alt-text";
import { ContributorHeader } from "./ContributorHeader";

/**
 * A contributor's body of work, seen at once.
 *
 * The carousel is the site's signature, but it shows one photograph at a
 * time — right for browsing, wrong for judging a photographer. Someone
 * arriving from a shared link wants the range first, so a profile lands here.
 *
 * Tiles are square whatever shape the photograph is. Masonry would preserve
 * each aspect ratio but destroys the scannable rhythm that makes a contact
 * sheet readable, and the true shape is one click away.
 */
export function PhotoGrid({
  images,
  contributor,
}: {
  images: readonly GalleryImage[];
  contributor: GalleryAuthor;
}) {
  /*
   * The same ground the viewer mixes its photo tint into, lifted by a wash of
   * the lead photograph's colour. Without it this page was flat black while
   * the slideshow glowed — one photographer, two different rooms.
   */
  const tint = images[0]?.bgColor ?? FALLBACK_TINT;

  return (
    <div
      className="relative min-h-dvh text-white"
      style={{ backgroundColor: GROUND }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background: `radial-gradient(120% 60% at 50% 0%, ${photoGlow(tint)}, transparent 70%)`,
        }}
      />

      {/*
        Sticky, so the view toggle and the photographer's name stay reachable
        on a phone instead of scrolling away after the first two tiles.

        The bar itself — padding, hairline, blur, inner max-width — lives in
        ContributorHeader, so the slideshow gets exactly the same one. Styling
        it here is what let the two headers drift apart the first time.
      */}
      <div className="sticky top-0 z-20">
        <ContributorHeader
          contributor={contributor}
          photoCount={images.length}
          view="grid"
        />
      </div>

      {/*
        The landmark starts below the sticky header, which is navigation and
        identity rather than content — so `main` is the contact sheet itself.
      */}
      <main className="relative mx-auto w-full max-w-[1536px] px-4 pb-14 sm:px-8">
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id}>
              <Link
                aria-label={`${image.title} — open full screen`}
                className="group glass-hairline relative block aspect-square overflow-hidden rounded-xl transition-[border-color] duration-300 hover:border-white/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
                href={`/by/${contributor.slug}/slideshow#${image.id}`}
              >
                <Image
                  alt={photoAltText(image)}
                  blurDataURL={image.src.blurDataURL}
                  className="object-cover transition-transform duration-500 ease-glass group-hover:scale-[1.04]"
                  fill={true}
                  placeholder="blur"
                  /*
                   * Eager, but only the first tile is *preloaded*.
                   *
                   * This was `priority={index < 4}`, which in Next 16 means
                   * `preload` — four `<link rel=preload as=image>` tags in the
                   * head, competing with each other and with the document for
                   * the same connection. The docs are explicit that preload is
                   * the wrong tool "when you have multiple images that could
                   * be the LCP element depending on the viewport", and a
                   * responsive 2/3/4-column grid is exactly that: which tile
                   * is largest depends on how wide the window is.
                   *
                   * So the first row still loads without waiting to be
                   * scrolled to — `loading="eager"` is what actually buys
                   * that — and only tile zero, the one that is the LCP on
                   * every column count, is promoted ahead of the queue.
                   */
                  fetchPriority={index === 0 ? "high" : undefined}
                  loading={index < 4 ? "eager" : "lazy"}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  src={image.src.src}
                />

                {/*
                  Revealed on hover and on keyboard focus, not hover alone — a
                  tile that only names itself to a mouse is one a keyboard user
                  navigates blind.
                */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-8 opacity-0 transition-opacity duration-300 group-focus-visible:opacity-100 group-hover:opacity-100">
                  <p className="truncate text-[0.75rem] text-white leading-tight">
                    {image.title}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {/*
          The legal footer, which this page had none of.
          
          `SiteFooter`'s own note says it appears on every page that scrolls,
          and this one scrolls — so a photographer's page, the URL they
          actually share, was three clicks from the Impressum rather than the
          two the German rule is read as requiring.
        */}
        <SiteFooter className="mt-16 justify-center pb-4" />
      </main>
    </div>
  );
}
