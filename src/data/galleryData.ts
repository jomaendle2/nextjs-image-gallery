// Gallery data structure
import type { StaticImageData } from "next/image";
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
import cherry from "@/assets/cherry.jpg";
import rio from "@/assets/rio.jpg";
import waves from "@/assets/waves.jpg";

export interface GalleryImage {
  id: number;
  /**
   * The full static import, not just its `.src`. Next needs the intrinsic
   * width/height to build a correct srcset and to reserve the right aspect
   * ratio, and it carries the generated blur placeholder with it.
   */
  src: StaticImageData;
  title: string;
  description: string;
  bgColor: string;
}

/** Typed as non-empty so `galleryImages[0]` needs no runtime guard. */
export const galleryImages: readonly [GalleryImage, ...GalleryImage[]] = [
  {
    id: 1,
    src: waves,
    title: "Bali, Indonesia",
    description: "Aerial view of tale waves",
    bgColor: "#2a6b7c",
  },
  {
    id: 2,
    src: nature0,
    title: "Vila Nova de Milfontes, Portugal",
    description: "Beautiful coastal landscape in Portugal",
    bgColor: "#191815",
  },
  {
    id: 3,
    src: nature1,
    title: "Bali, Indonesia",
    description: "A beautiful, blooming Plumeria rubra flower",
    bgColor: "#4c89a1",
  },
  {
    id: 4,
    src: nature2,
    title: "Bromo, Java, Indonesia",
    description: "Peaceful sunrise at Bromo Tengger Semeru National Park",
    bgColor: "#663829",
  },
  {
    id: 5,
    src: cherry,
    title: "Böblingen, Germany",
    description: "Pink cherry blossoms against a clear blue sky.",
    bgColor: "#4c566e",
  },
  {
    id: 6,
    src: nature3,
    title: "Uluwatu, Bali, Indonesia",
    description: "Teal waves crash against rocky cliffs.",
    bgColor: "#446165",
  },
  {
    id: 7,
    src: nature4,
    title: "Sagres, Portugal",
    description: "A golden sunset glows over gentle waves on a sandy shore.",
    bgColor: "#6a4332",
  },
  {
    id: 8,
    src: nature5,
    title: "San Diego, California",
    description: "Close-up of a vibrant palm tree nearby the beach.",
    bgColor: "#4d623c",
  },
  {
    id: 9,
    src: nature9,
    title: "Koh Samui, Thailand",
    description: "White plumeria blossoms against a clear blue sky.",
    bgColor: "#2a88a3",
  },
  {
    id: 10,
    src: rio,
    title: "Rio de Janeiro, Brazil",
    description: "Aerial view of the iconic Rio de Janeiro coastline.",
    bgColor: "#3a5c7b",
  },
  {
    id: 11,
    src: nature6,
    title: "San Francisco, California",
    description: "Golden Gate Bridge at sunset with a vibrant sky.",
    bgColor: "#2184ab",
  },
  {
    id: 12,
    src: nature7,
    title: "Arches National Park, Utah",
    description:
      "Storm clouds roll over towering red sandstone formations in Arches NP",
    bgColor: "#646378",
  },
  {
    id: 13,
    src: nature8,
    title: "Böblingen, Germany",
    description: "Pink cherry blossoms against a clear blue sky.",
    bgColor: "#136aa0",
  },
  {
    id: 14,
    src: nature10,
    title: "Koh Phangan, Thailand",
    description: "Lovely palm trees swaying in the breeze on a tropical beach.",
    bgColor: "#87abab",
  },
];
