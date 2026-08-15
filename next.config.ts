import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  images: {
    // Next 16 requires every `quality` used by next/image to be declared here.
    // 75 is the default; 95 is used by the full-screen modal.
    qualities: [75, 95],
    // AVIF first: ~20-30% smaller than WebP for these photographic sources.
    formats: ["image/avif", "image/webp"],
    // The gallery images are content-hashed static imports, so they are
    // immutable and can be cached by the optimizer for a year.
    minimumCacheTTL: 31_536_000,
  },

  experimental: {
    // Tree-shakes barrel-file imports so we ship only the icons we use.
    optimizePackageImports: ["lucide-react", "@number-flow/react"],
  },
};

export default nextConfig;
