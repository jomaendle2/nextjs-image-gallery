import Image from "next/image";
import Link from "next/link";
import type { GalleryAuthor, GalleryImage } from "@/data/galleryData";
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
  const tint = images[0]?.bgColor ?? "#2a6b7c";

  return (
    <div className="relative min-h-dvh bg-[#0d1114] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background: `radial-gradient(120% 60% at 50% 0%, color-mix(in oklab, ${tint} 42%, transparent), transparent 70%)`,
        }}
      />

      <div className="relative mx-auto w-full max-w-[1536px] px-4 pb-14 sm:px-8">
        {/*
          Sticky, so the view toggle and the photographer's name stay reachable
          on a phone instead of scrolling away after the first two tiles.
        */}
        <div className="-mx-4 sm:-mx-8 sticky top-0 z-20 border-white/[0.06] border-b bg-[#0d1114]/80 px-4 py-4 backdrop-blur-xl sm:px-8 sm:py-6">
          <ContributorHeader
            contributor={contributor}
            photoCount={images.length}
            view="grid"
          />
        </div>

        <ul className="mt-6 grid grid-cols-2 gap-2 sm:mt-8 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id}>
              <Link
                aria-label={`${image.title} — open full screen`}
                className="group relative block aspect-square overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/[0.06] transition-shadow duration-300 hover:ring-white/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
                href={`/by/${contributor.slug}/slideshow#${image.id}`}
              >
                <Image
                  alt={image.title}
                  blurDataURL={image.src.blurDataURL}
                  className="object-cover transition-transform duration-500 ease-glass group-hover:scale-[1.04]"
                  fill={true}
                  placeholder="blur"
                  priority={index < 4}
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
      </div>
    </div>
  );
}
