import nature1 from "@/assets/nature-1.jpg";
import nature2 from "@/assets/nature-2.jpg";
import nature3 from "@/assets/nature-3.jpg";
import nature4 from "@/assets/nature-4.jpg";

export interface GalleryImage {
  id: string;
  src: string;
  title: string;
  description: string;
  dominantColor?: string;
}

export const galleryImages: GalleryImage[] = [
  {
    id: "1",
    src: nature1.src,
    title: "Mountain Lake Reflection",
    description:
      "Serene alpine lake at golden hour with perfect mountain reflections",
  },
  {
    id: "2",
    src: nature2.src,
    title: "Misty Forest Morning",
    description: "Ethereal sunbeams filtering through ancient evergreen trees",
  },
  {
    id: "3",
    src: nature3.src,
    title: "Wildflower Meadow",
    description: "Rolling hills covered in vibrant spring wildflowers",
  },
  {
    id: "4",
    src: nature4.src,
    title: "Coastal Sunset",
    description: "Dramatic ocean waves crashing against rocky coastline",
  },
];
