import type { NextConfig } from "next";

/**
 * Sent with every response.
 *
 * The app served none of these. `poweredByHeader: false` was the whole of
 * its header policy, which hides a version string and prevents nothing.
 *
 * Deliberately absent: a script `Content-Security-Policy`. A strict one
 * needs per-request nonces, nonces need middleware, and middleware runs
 * ahead of the cache on every request — which is the exact cost this
 * codebase decided not to pay for auth, and documented twice for that
 * reason. Paying it for a header would contradict the same reasoning, and
 * a CSP with `unsafe-inline` would buy the appearance of one rather than
 * one. `frame-ancestors` is the part that works without nonces, so that
 * part is here.
 */
const SECURITY_HEADERS = [
  // Clickjacking. `frame-ancestors` is the modern spelling and the one that
  // covers nested frames; `X-Frame-Options` is for anything still reading it.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },

  // Stops a browser second-guessing a declared Content-Type — the vector
  // that turns an uploaded file into an executable one.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Send the full URL within our own origin and only the origin outbound.
  // Photograph pages carry an id, and a contributor's own site should not
  // learn the whole path someone came from.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  /*
   * Nothing here needs a camera, a microphone, or the visitor's location —
   * least of all the location, on a site whose promise to photographers is
   * that it never records where a photograph was taken. Denying it in a
   * header says the same thing to the browser.
   */
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },

  // Two years, subdomains included. Only meaningful over HTTPS, which is
  // every deployed environment; localhost ignores it.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  headers() {
    return Promise.resolve([{ source: "/:path*", headers: SECURITY_HEADERS }]);
  },

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
