// Gallery data structure
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
    description: "Beautiful coastal landscape in Portugal",
  },
  {
    id: "1",
    src: nature1.src,
    blurDataURL: nature1.blurDataURL,
    title: "Mountain Vista",
    description: "Stunning mountain view with forest",
  },
  {
    id: "2",
    src: nature2.src,
    blurDataURL: nature2.blurDataURL,
    title: "Ocean Waves",
    description: "Peaceful ocean waves at sunset",
  },
  {
    id: "3",
    src: nature3.src,
    blurDataURL: nature3.blurDataURL,
    title: "Forest Path",
    description: "Serene forest pathway",
  },
  {
    id: "4",
    src: nature4.src,
    blurDataURL: nature4.blurDataURL,
    title: "Desert Landscape",
    description: "Vast desert with dramatic clouds",
  },
  {
    id: "5",
    src: nature5.src,
    blurDataURL: nature5.blurDataURL,
    title: "Alpine Lake",
    description: "Crystal clear alpine lake reflection",
  },
  {
    id: "6",
    src: nature6.src,
    blurDataURL: nature6.blurDataURL,
    title: "Autumn Colors",
    description: "Vibrant autumn foliage",
  },
  {
    id: "7",
    src: nature7.src,
    blurDataURL: nature7.blurDataURL,
    title: "Coastal Cliffs",
    description: "Dramatic coastal cliff formations",
  },
  {
    id: "8",
    src: nature8.src,
    blurDataURL: nature8.blurDataURL,
    title: "Rolling Hills",
    description: "Green rolling hills landscape",
  },
  {
    id: "9",
    src: nature9.src,
    blurDataURL: nature9.blurDataURL,
    title: "Tropical Paradise",
    description: "Tropical beach with palm trees",
  },
  {
    id: "10",
    src: nature10.src,
    blurDataURL: nature10.blurDataURL,
    title: "Snow-Capped Peaks",
    description: "Majestic snow-capped mountain peaks",
  },
];
