import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyGallery } from "@/components/gallery/EmptyGallery";
import { ImageCarousel } from "@/components/gallery/ImageCarousel";
import { listGalleryImages } from "@/data/galleryData";
import {
  getContributorBySlug,
  listPublicContributorSlugs,
} from "@/lib/auth/contributors";
import { membershipConfigured } from "@/lib/members/offer";
import { contributorAlternates, ogCard } from "@/lib/metadata";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * The same photographers `/by/[slug]` builds, from the same function.
 *
 * The grid and the slideshow are two views of one gallery and the sitemap
 * lists both, so prerendering one and rendering the other per request would
 * be an arbitrary split — and this is the half that carries the carousel, so
 * it is the more expensive of the two to render.
 *
 * Until this existed the `revalidate` above had nothing to revalidate, which
 * is the other half of why `revalidateFeeds` never cleared this URL: there
 * was no cache entry to clear.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await listPublicContributorSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const contributor = await getContributorBySlug(slug);
  if (!contributor) {
    return { title: "Not found" };
  }
  /*
   * Their own card, not the site's. This is the URL a photographer actually
   * shares, and until now it previewed with the generic gallery image — so
   * the one link they send about their own work said nothing about them.
   */
  const card = ogCard({
    title: contributor.display_name,
    subtitle: "Photographs on the beauty of earth",
  });

  return {
    title: `${contributor.display_name} — the beauty of earth.`,
    description: `Photographs by ${contributor.display_name}.`,
    alternates: contributorAlternates(
      `/by/${contributor.slug}/slideshow`,
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

  /*
   * Both queries at once: the photographs are looked up by slug, so the
   * second never needed the first one's answer.
   *
   * A slug nobody owns costs one wasted query, because the photographs are
   * fetched before `notFound()` can fire. That is the right trade at this
   * ratio — every real visit saves a full round trip — and an unknown slug
   * is not something `generateStaticParams` builds.
   *
   * The photographs throw rather than arriving empty, for the reason the
   * grid states: a failed query rendered as `EmptyGallery` is a successful
   * render, and the hourly `revalidate` then caches "they have published
   * nothing" on the URL the photographer shares.
   */
  const [contributor, images] = await Promise.all([
    getContributorBySlug(slug),
    listGalleryImages(slug),
  ]);
  if (!contributor) {
    notFound();
  }

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
      membershipOffered={membershipConfigured()}
    />
  );
}
