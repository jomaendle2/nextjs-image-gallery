import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImageCarousel } from "@/components/gallery/ImageCarousel";
import { StructuredData } from "@/components/StructuredData";
import { type GalleryImage, listGalleryImages } from "@/data/galleryData";
import { siteOrigin } from "@/lib/site-url";
import { photographSchema } from "@/lib/structured-data";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * The feed, plus where in it this photograph sits.
 *
 * Reading the whole feed rather than fetching one row is deliberate on two
 * counts: the query is already cached for the gallery, so this costs nothing
 * extra; and the index has to be an index *into the feed the viewer will
 * render*, which is exactly what looking it up here guarantees. Fetching the
 * row separately would leave two orderings to keep in agreement.
 */
interface FoundPhoto {
  images: GalleryImage[];
  index: number;
  photo: GalleryImage;
}

async function findPhoto(id: string): Promise<FoundPhoto | null> {
  const images = await listGalleryImages();
  const index = images.findIndex((image) => image.id === id);
  const photo = images[index];
  return photo === undefined ? null : { images, index, photo };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const found = await findPhoto(id);
  if (!found) {
    return { title: "Not found — the beauty of earth." };
  }

  const { photo } = found;
  const title = photo.title === "" ? "A photograph" : photo.title;
  const credit = `${title} by ${photo.author.name}`;

  return {
    title: `${credit} — the beauty of earth.`,
    description: photo.description === "" ? credit : photo.description,
    alternates: { canonical: `/photo/${photo.id}` },
    openGraph: {
      type: "article",
      title: credit,
      description: photo.description,
      url: `/photo/${photo.id}`,
      /*
       * The photograph itself, not the generic card `/api/og` draws. This is
       * the whole reason the route exists: a link to one photograph should
       * preview as that photograph.
       */
      images: [
        {
          url: photo.src.src,
          width: photo.src.width,
          height: photo.src.height,
          alt: photo.description === "" ? credit : photo.description,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: credit,
      description: photo.description,
      images: [photo.src.src],
    },
  };
}

/**
 * One photograph, at a URL worth sending someone.
 *
 * Everything the gallery could show was previously reachable at exactly four
 * addresses, so a photographer had no way to link to a single photograph of
 * theirs and a shared link previewed as the site rather than the picture.
 * This is the same viewer, opened on one image — navigation still works, so
 * arriving here is an entry point rather than a dead end.
 */
export default async function PhotoPage({ params }: PageProps) {
  const { id } = await params;
  const found = await findPhoto(id);
  if (!found) {
    notFound();
  }

  /*
   * No `contributor` prop, deliberately. That prop puts a photographer's
   * name and photo count in the header, and the feed here is the whole
   * gallery — so it would announce "Mara Lindqvist, 16 photographs" over a
   * strip that walks straight into everybody else's work. The photograph's
   * own credit is in the caption bar, where it follows whichever image is
   * showing.
   */
  return (
    <>
      <StructuredData data={photographSchema(found.photo, siteOrigin())} />
      <ImageCarousel images={found.images} initialIndex={found.index} />
    </>
  );
}
