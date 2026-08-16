import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyGallery } from "@/components/gallery/EmptyGallery";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { StructuredData } from "@/components/StructuredData";
import { getGalleryImages } from "@/data/galleryData";
import { getContributorBySlug } from "@/lib/auth/contributors";
import { contributorAlternates } from "@/lib/metadata";
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
  /*
   * Their photographs go on the card, not just their name. This is the link
   * a photographer sends about their own work, so a preview containing no
   * photography is the worst version a gallery can have.
   */
  const images = await getGalleryImages(contributor.slug);
  const previews = images
    .slice(0, 3)
    .map((image) => image.src.src)
    .filter((url) => url.startsWith("https://"))
    .join(",");

  const card =
    `/api/og?title=${encodeURIComponent(contributor.display_name)}` +
    `&subtitle=${encodeURIComponent(`@${contributor.slug}`)}` +
    (previews === "" ? "" : `&previews=${encodeURIComponent(previews)}`);

  return {
    title: `${contributor.display_name} — the beauty of earth.`,
    description: `Photographs by ${contributor.display_name}.`,
    alternates: contributorAlternates(
      `/by/${contributor.slug}`,
      contributor.slug,
      contributor.display_name,
    ),
    openGraph: {
      title: contributor.display_name,
      description: `Photographs by ${contributor.display_name}.`,
      images: [{ url: card, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      images: [card],
    },
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
