import { EmptyGallery } from "@/components/gallery/EmptyGallery";
import { ImageCarousel } from "@/components/gallery/ImageCarousel";
import { StructuredData } from "@/components/StructuredData";
import { getGalleryImages } from "@/data/galleryData";
import { siteOrigin } from "@/lib/site-url";
import { gallerySchema } from "@/lib/structured-data";

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

  return (
    <>
      <StructuredData
        data={gallerySchema(images, siteOrigin(), "the beauty of earth.")}
      />
      <ImageCarousel images={images} />
    </>
  );
}
