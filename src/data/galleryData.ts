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
}

export const galleryImages: GalleryImage[] = [
  {
    id: "0",
    src: nature0.src,
    title: "Vila Nova de Milfontes, Portugal",
    description: "Sunset by the sea in Vila Nova de Milfontes, Portugal",
  },
  {
    id: "1",
    src: nature1.src,
    title: "Bali, Indonesia",
    description: "",
  },
  {
    id: "2",
    src: nature2.src,
    title: "Java, Indonesia",
    description: "",
  },
  {
    id: "3",
    src: nature3.src,
    title: "Bali, Indonesia",
    description: "Aerial view of the coastline in Bali, Indonesia",
  },
  {
    id: "4",
    src: nature4.src,
    title: "Sagres, Portugal",
    description: "Tiny human facing the ocean at sunset",
  },
];
