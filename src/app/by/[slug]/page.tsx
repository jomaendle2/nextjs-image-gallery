import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyGallery } from "@/components/gallery/EmptyGallery";
import { PhotoGrid } from "@/components/gallery/PhotoGrid";
import { StructuredData } from "@/components/StructuredData";
import { listGalleryImages } from "@/data/galleryData";
import {
  getContributorBySlug,
  listPublicContributorSlugs,
} from "@/lib/auth/contributors";
import { contributorAlternates, ogCard } from "@/lib/metadata";
import { siteOrigin } from "@/lib/site-url";
import { photographerSchema } from "@/lib/structured-data";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Every photographer the sitemap advertises, built once and revalidated
 * hourly — literally the same list, from the same function, so the two
 * cannot disagree about who has a page.
 *
 * Without this the `revalidate` above never applied to anything: a dynamic
 * segment with no params to prerender is rendered on demand every time, so
 * the page a photographer shares paid for two queries per visitor.
 *
 * `dynamicParams` stays at its default of true, so a photographer who
 * publishes their first photograph between builds still has a page.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await listPublicContributorSlugs();
  return slugs.map((slug) => ({ slug }));
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
  /*
   * Their photographs go on the card, not just their name. This is the link
   * a photographer sends about their own work, so a preview containing no
   * photography is the worst version a gallery can have.
   *
   * Fetched alongside the contributor rather than after them, for the reason
   * spelled out on the page body below: the photographs are keyed by slug,
   * so the second query never depended on the first one's answer.
   */
  const [contributor, images] = await Promise.all([
    getContributorBySlug(slug),
    listGalleryImages(slug),
  ]);
  if (!contributor) {
    return { title: "Not found" };
  }
  /*
   * The display blobs, not the image optimizer.
   *
   * These are large — up to 3840px — and Satori fetches all three each time
   * the card is built, so routing them through `/_next/image` at 640px looked
   * like free savings. It is not: the optimizer content-negotiates to WebP or
   * AVIF, Satori decodes neither, and the strip renders empty. A share card
   * that silently loses its photographs is worse than one that is slow to
   * build, and the card is cached for a day either way.
   */
  const card = ogCard({
    title: contributor.display_name,
    subtitle: `@${contributor.slug}`,
    previews: images.slice(0, 3).map((image) => image.src.src),
  });

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

  /*
   * Both queries at once. The photographs are looked up by slug, not by the
   * contributor's id, so the second question never needed the first one's
   * answer — it was only ever written below it.
   *
   * A slug nobody owns now costs one wasted query: the photographs are
   * fetched before `notFound()` can fire. That is the right trade at this
   * ratio — every real visit saves a full round trip, and the query returns
   * nothing quickly — and it is bounded, because an unknown slug is not
   * something `generateStaticParams` builds.
   *
   * Both throw rather than degrading. A photographer whose page silently
   * fell back to `EmptyGallery` on a failed query was told, in their own
   * name, that they had not published anything — and because that render
   * succeeded it was cached under the hourly `revalidate` and shown to
   * everyone they had sent the link to. `EmptyGallery` below now means only
   * what it says.
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
