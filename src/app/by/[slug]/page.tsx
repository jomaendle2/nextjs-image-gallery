import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyGallery } from "@/components/gallery/EmptyGallery";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { StructuredData } from "@/components/StructuredData";
import { getGalleryImages } from "@/data/galleryData";
import { getContributorBySlug } from "@/lib/auth/contributors";
import { siteOrigin } from "@/lib/site-url";
import { photographerSchema } from "@/lib/structured-data";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

/*
 * A route segment rather than a `?by=` search param: reading searchParams
 * would opt the page out of static rendering, and this page is the one a
 * photographer shares, so it needs its own title, OG image and cache entry.
 */
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

export default async function ContributorGallery({ params }: PageProps) {
  const { slug } = await params;
  const contributor = await getContributorBySlug(slug);
  if (!contributor) {
    notFound();
  }

  const images = await getGalleryImages(slug);
  if (images.length === 0) {
    return <EmptyGallery authorName={contributor.display_name} />;
  }

  const author = {
    slug: contributor.slug,
    name: contributor.display_name,
    siteUrl: contributor.site_url,
  };

  return (
    <>
      <StructuredData data={photographerSchema(author, images, siteOrigin())} />
      <PhotoGrid contributor={author} images={images} />
    </>
  );
}
