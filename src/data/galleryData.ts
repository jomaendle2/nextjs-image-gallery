import nature0 from "@/assets/0.jpg";
import nature1 from "@/assets/1.jpg";
import nature2 from "@/assets/2.jpg";
import nature3 from "@/assets/3.jpg";
import nature4 from "@/assets/4.jpg";
import nature5 from "@/assets/5.jpg";
import nature6 from "@/assets/6.jpg";
import nature7 from "@/assets/7.jpg";
import nature8 from "@/assets/8.jpg";
import nature9 from "@/assets/9.jpg";
import nature10 from "@/assets/10.jpg";

export interface GalleryImage {
  id: string;
  src: string;
  title: string;
  description: string;
  dominantColor?: string;
  blurDataURL?: string;
}

export const galleryImages: GalleryImage[] = [
  {
    id: "0",
    src: nature0.src,
    blurDataURL: nature0.blurDataURL,
    title: "Vila Nova de Milfontes, Portugal",
    description:
      "Golden sunset paints the tranquil Portuguese coastline in warm, ethereal light.",
  },
  {
    id: "1",
    src: nature1.src,
    blurDataURL: nature1.blurDataURL,
    title: "Bali, Indonesia",
    description:
      "Emerald rice terraces cascade down Balinese hillsides like nature's stairway to heaven.",
  },
  {
    id: "2",
    src: nature2.src,
    blurDataURL: nature2.blurDataURL,
    title: "Java, Indonesia",
    description:
      "Ancient volcanic peaks emerge through mystical morning mist in Java's untamed wilderness.",
  },
  {
    id: "3",
    src: nature3.src,
    blurDataURL: nature3.blurDataURL,
    title: "Bali, Indonesia",
    description:
      "Turquoise waves meet pristine beaches along Bali's dramatic coral-fringed coastline.",
  },
  {
    id: "4",
    src: nature4.src,
    blurDataURL: nature4.blurDataURL,
    title: "Sagres, Portugal",
    description:
      "A solitary figure contemplates the infinite Atlantic horizon at Europe's edge.",
  },
  {
    id: "5",
    src: nature5.src,
    blurDataURL: nature5.blurDataURL,
    title: "Natural Serenity",
    description:
      "Crystal clear mountain streams flow through moss-covered stones in pristine wilderness.",
  },
  {
    id: "6",
    src: nature6.src,
    blurDataURL: nature6.blurDataURL,
    title: "Forest Cathedral",
    description:
      "Towering ancient trees create a natural sanctuary of dappled light and shadow.",
  },
  {
    id: "7",
    src: nature7.src,
    blurDataURL: nature7.blurDataURL,
    title: "Alpine Majesty",
    description:
      "Snow-capped peaks pierce azure skies above alpine meadows bursting with wildflowers.",
  },
  {
    id: "8",
    src: nature8.src,
    blurDataURL: nature8.blurDataURL,
    title: "Desert Bloom",
    description:
      "Vibrant desert wildflowers defy the arid landscape with their resilient beauty.",
  },
  {
    id: "9",
    src: nature9.src,
    blurDataURL: nature9.blurDataURL,
    title: "Coastal Wonder",
    description:
      "Dramatic sea cliffs stand sentinel against the relentless power of ocean waves.",
  },
  {
    id: "10",
    src: nature10.src,
    blurDataURL: nature10.blurDataURL,
    title: "Morning Mist",
    description:
      "Ethereal fog dances between rolling hills in the gentle embrace of dawn.",
  },
];
