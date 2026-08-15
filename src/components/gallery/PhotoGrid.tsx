import Image from "next/image";
import Link from "next/link";
import type { GalleryAuthor, GalleryImage } from "@/data/galleryData";
import { ContributorHeader } from "./ContributorHeader";

/**
 * A contributor's body of work, seen at once.
 *
 * The carousel is the site's signature, but it shows one photograph at a
 * time — which is right for browsing and wrong for judging a photographer.
 * Someone arriving from a shared link wants the range first, so the grid is
 * what a profile lands on.
 *
 * Tiles are square regardless of the photograph's own shape. A masonry
 * layout would preserve each aspect ratio but destroys the scannable rhythm
 * that makes a contact sheet readable; the full shape is one click away.
 */
export function PhotoGrid({
  images,
  contributor,
}: {
  images: readonly GalleryImage[];
  contributor: GalleryAuthor;
}) {
  return (
    <div className="min-h-dvh bg-[#0d1114] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
        <ContributorHeader
          contributor={contributor}
          photoCount={images.length}
          view="grid"
        />

        <ul className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id}>
              <Link
                aria-label={`${image.title} — open full screen`}
                className="group relative block aspect-square overflow-hidden rounded-lg bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
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
                  The title appears on hover and on keyboard focus, not just
                  hover — a tile that only names itself to a mouse is a tile a
                  keyboard user navigates blind.
                */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-8 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
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
