import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import PlausibleProvider from "next-plausible";
import "./globals.css";
import { siteOrigin } from "@/lib/site-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

/*
 * One source of truth for the origin, shared with the magic-link emails.
 *
 * A second hardcoded domain here would put every canonical URL and every OG
 * image on a host the site is not served from, which quietly costs a site its
 * search ranking — crawlers take `og:url` and the canonical tag at their
 * word.
 */
const SITE_URL = siteOrigin();
const TITLE = "the beauty of earth.";
const DESCRIPTION =
  "Images from around the world. Explore the beauty of our planet 🌍";
const OG_IMAGE = `/api/og?title=${encodeURIComponent(TITLE)}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  /*
   * Feed autodiscovery, and deliberately no `canonical`.
   *
   * `alternates` is replaced rather than merged, so a canonical here is
   * inherited whole by every page that does not set its own — which meant
   * `/photographers` and `/contribute/apply` both told Google they were
   * duplicates of the home page while sitting in the sitemap asking to be
   * crawled. A default that is wrong for every page but one is a trap for
   * whoever adds the next page. Pages state their own via `alternates()` in
   * `src/lib/metadata.ts`, which keeps this feed link attached.
   */
  alternates: {
    types: {
      "application/rss+xml": [
        { url: "/feed.xml", title: "the beauty of earth." },
      ],
    },
  },
  /*
   * The icons have been sitting in `public/` unreferenced. `favicon.ico`
   * worked only because browsers ask for it by name; the Apple touch icon,
   * which is what a home-screen bookmark uses, was never declared at all.
   */
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${TITLE} - Images from around the world`,
      },
    ],
    type: "website",
  },
  twitter: {
    title: TITLE,
    description: DESCRIPTION,
    card: "summary_large_image",
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0e12",
  colorScheme: "dark",
  /*
   * Photographs to the edges of the glass on a notched phone.
   *
   * The default keeps the whole document inside the safe area, which on an
   * iPhone means a full-screen photo gallery is framed by two bars of
   * browser chrome — the one thing this design spends all its restraint
   * avoiding. `cover` hands us the whole display and the responsibility for
   * the insets, which the chrome below takes with `safe-*` padding.
   */
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /*
     * suppressHydrationWarning covers exactly one element — the tag it is
     * on — and exists because browser extensions (LanguageTool, Grammarly,
     * dark-mode switchers) stamp attributes like `data-lt-installed` onto
     * <html> before React hydrates. Without it, every visitor running one
     * sees a hydration error for markup we never wrote. Children are still
     * validated; this does not hide real mismatches anywhere else.
     */
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        {/*
          Analytics is third-party and on the critical path for nothing, but
          the handshake still costs a round trip when it does fire. Warming
          it here keeps that off the first interaction.
        */}
        <link href="https://plausible.io" rel="preconnect" />
      </head>
      <body className={`${geistSans.variable} antialiased`}>
        <PlausibleProvider domain="thebeautyof.earth">
          {children}
          {/*
            Deliberately a sibling of `children` and nothing else.

            It used to be a child of `QueryProvider`, which has since moved
            down to the two layouts that actually mount the carousel — and
            web-vitals reporting has to stay on every page, including the
            ones that no longer have a query client. Nesting is what decided
            where this ended up last time, so it is worth saying plainly:
            this component wants no context at all, only to be mounted.
          */}
          <SpeedInsights />
        </PlausibleProvider>
      </body>
    </html>
  );
}
