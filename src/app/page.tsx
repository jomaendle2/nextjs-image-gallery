import { EmptyGallery } from "@/components/gallery/EmptyGallery";
import { ImageCarousel } from "@/components/gallery/ImageCarousel";
import { getGalleryImages } from "@/data/galleryData";

/**
 * Statically rendered and refreshed hourly. Publishing calls
 * `revalidatePath("/")`, so the hour is only a backstop — visitors see new
 * work immediately, and an anonymous visit never touches a session or waits
 * on a query.
 */
export const revalidate = 3600;

export default async function Home() {
  const images = await getGalleryImages();

  if (images.length === 0) {
    return <EmptyGallery />;
  }

  return <ImageCarousel images={images} />;
}
