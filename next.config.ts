import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  images: {
    // Next 16 requires every `quality` used by next/image to be declared here.
    // 75 is the default; 95 is used by the full-screen modal.
    qualities: [75, 95],
    // AVIF first: ~20-30% smaller than WebP for these photographic sources.
    formats: ["image/avif", "image/webp"],
    // Blob pathnames carry a random suffix and are never rewritten, so a
    // photo URL is immutable exactly like the content-hashed static imports
    // it replaced, and the optimizer can still cache it for a year.
    minimumCacheTTL: 31_536_000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/photos/**",
      },
    ],
  },

  experimental: {
    // Tree-shakes barrel-file imports so we ship only the icons we use.
    optimizePackageImports: ["lucide-react", "@number-flow/react"],
  },
};

export default nextConfig;
