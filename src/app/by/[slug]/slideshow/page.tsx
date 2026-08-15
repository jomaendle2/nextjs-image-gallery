import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyGallery } from "@/components/gallery/EmptyGallery";
import { ImageCarousel } from "@/components/gallery/ImageCarousel";
import { getGalleryImages } from "@/data/galleryData";
import { getContributorBySlug } from "@/lib/auth/contributors";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const contributor = await getContributorBySlug(slug);
  if (!contributor) {
    return { title: "Not found" };
  }
  return {
    title: `${contributor.display_name} — the beauty of earth.`,
    description: `Photographs by ${contributor.display_name}.`,
  };
}

/**
 * The carousel view of a contributor's work — the grid's sibling rather than
 * a query parameter, so both stay statically rendered and shareable.
 *
 * Arriving from a grid tile carries the photo id in the hash. A hash is never
 * sent to the server, so this page can open on any photograph without ever
 * becoming dynamic.
 */
export default async function ContributorSlideshow({ params }: PageProps) {
  const { slug } = await params;
  const contributor = await getContributorBySlug(slug);
  if (!contributor) {
    notFound();
  }

  const images = await getGalleryImages(slug);
  if (images.length === 0) {
    return <EmptyGallery authorName={contributor.display_name} />;
  }

  return (
    <ImageCarousel
      contributor={{
        slug: contributor.slug,
        name: contributor.display_name,
        siteUrl: contributor.site_url,
      }}
      images={images}
    />
  );
}
