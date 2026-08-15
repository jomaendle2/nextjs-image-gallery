import type { GalleryAuthor, GalleryImage } from "@/data/galleryData";
import { photoAltText } from "@/lib/photos/alt-text";

/**
 * Schema.org descriptions of what is on each page.
 *
 * Pure functions taking an origin, so they are testable without a request and
 * so every URL in the output is absolute — a relative URL in JSON-LD is not
 * resolved by every consumer, and the ones that matter here are crawlers we
 * never get to see fail.
 *
 * A photo gallery is an unusually good fit for this: `ImageObject` carries a
 * creator, a licence position and a caption, which is precisely the
 * information a photographer wants travelling with their work when a search
 * engine or a model reads the page instead of a person.
 */

interface Thing {
  "@context"?: "https://schema.org";
  "@type": string;
  [key: string]: unknown;
}

function personOf(author: GalleryAuthor, origin: string): Thing {
  return {
    "@type": "Person",
    name: author.name,
    url: `${origin}/by/${author.slug}`,
    // `sameAs` is how a search engine reconciles this person with the one on
    // their own site — the single most useful thing we can say about a
    // contributor, and the reason the credit links out in the first place.
    ...(author.siteUrl === null ? {} : { sameAs: [author.siteUrl] }),
  };
}

function imageOf(image: GalleryImage, origin: string): Thing {
  return {
    "@type": "ImageObject",
    "@id": `${origin}/photo/${image.id}`,
    url: `${origin}/photo/${image.id}`,
    contentUrl: image.src.src,
    width: image.src.width,
    height: image.src.height,
    name: image.title === "" ? undefined : image.title,
    description: photoAltText(image),
    creator: personOf(image.author, origin),
    // Attribution is the whole bargain here, so it is stated in the data as
    // well as in the interface.
    creditText: image.author.name,
    copyrightNotice: `© ${image.author.name}`,
    ...(image.location === null ? {} : { contentLocation: image.location }),
  };
}

/** One photograph, for `/photo/[id]`. */
export function photographSchema(image: GalleryImage, origin: string): Thing {
  return { "@context": "https://schema.org", ...imageOf(image, origin) };
}

/**
 * A photographer and their work, for `/by/[slug]`.
 *
 * `ProfilePage` rather than `CollectionPage`: the subject of that page is the
 * person, and the photographs are what they have made.
 */
export function photographerSchema(
  author: GalleryAuthor,
  images: readonly GalleryImage[],
  origin: string,
): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${origin}/by/${author.slug}`,
    mainEntity: {
      ...personOf(author, origin),
      image: images.map((image) => imageOf(image, origin)),
    },
  };
}

/** The whole gallery, for the home page. */
export function gallerySchema(
  images: readonly GalleryImage[],
  origin: string,
  siteName: string,
): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: siteName,
    url: origin,
    /*
     * Capped. The feed has no upper bound, and a crawler reading a megabyte
     * of JSON-LD before the first photograph paints is a worse outcome than
     * describing the most recent work and letting the sitemap carry the rest
     * — every photograph has its own page, and each of those describes
     * itself in full.
     */
    image: images
      .slice(0, GALLERY_SCHEMA_LIMIT)
      .map((image) => imageOf(image, origin)),
  };
}

/** Enough to describe the page a visitor actually lands on. */
export const GALLERY_SCHEMA_LIMIT = 24;
