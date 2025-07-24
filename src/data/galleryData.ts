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
    title: "Bali, Indonesia",
    description: "A beautiful, blooming Plumeria rubra flower",
  },
  {
    id: "2",
    src: nature2.src,
    blurDataURL: nature2.blurDataURL,
    title: "Bromo Volcano, Java, Indonesia",
    description: "Peaceful sunrise at Bromo Tengger Semeru National Park",
  },
  {
    id: "3",
    src: nature3.src,
    blurDataURL: nature3.blurDataURL,
    title: "Uluwatu, Bali, Indonesia",
    description: "Teal waves crash against rocky, shrub-covered cliffs.",
  },
  {
    id: "4",
    src: nature4.src,
    blurDataURL: nature4.blurDataURL,
    title: "Sagres, Portugal",
    description:
      "A golden sunset glows over gentle waves on a sandy Sagres shore.",
  },
  {
    id: "5",
    src: nature5.src,
    blurDataURL: nature5.blurDataURL,
    title: "San Diego, California",
    description: "Close-up of a vibrant palm tree nearby the beach.",
  },
  {
    id: "9",
    src: nature9.src,
    blurDataURL: nature9.blurDataURL,
    title: "Koh Samui, Thailand",
    description: "White plumeria blossoms against a clear blue sky.",
  },
  {
    id: "6",
    src: nature6.src,
    blurDataURL: nature6.blurDataURL,
    title: "San Francisco, California",
    description: "Golden Gate Bridge at sunset with a vibrant sky.",
  },
  {
    id: "7",
    src: nature7.src,
    blurDataURL: nature7.blurDataURL,
    title: "Arches National Park, Utah",
    description:
      "Storm clouds roll over towering red sandstone formations in Arches NP",
  },
  {
    id: "8",
    src: nature8.src,
    blurDataURL: nature8.blurDataURL,
    title: "Böblingen, Germany",
    description: "Pink cherry blossoms against a clear blue sky.",
  },

  {
    id: "10",
    src: nature10.src,
    blurDataURL: nature10.blurDataURL,
    title: "Koh Phangan, Thailand",
    description: "Lovely palm trees swaying in the breeze on a tropical beach.",
  },
];
