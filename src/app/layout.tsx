import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import PlausibleProvider from "next-plausible";
import "./globals.css";
import QueryProvider from "@/components/QueryProvider";
import { siteOrigin } from "@/lib/site-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

/*
 * One source of truth for the origin, shared with the magic-link emails.
 *
 * This used to be a second, hardcoded domain that disagreed with
 * `siteOrigin()`. Every canonical URL and every OG image the site served
 * therefore pointed at a host it was not being served from, which is the
 * kind of mistake that quietly costs a site its search ranking: crawlers
 * take `og:url` and the canonical tag at their word.
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
  alternates: {
    canonical: "/",
    /*
     * Feed autodiscovery. This is the mechanism every reader uses to find a
     * feed from a page URL, so without it the feed exists and nobody can
     * subscribe to it by pasting the site address.
     */
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
    <html lang="en">
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
          <QueryProvider>
            {children}
            <SpeedInsights />
          </QueryProvider>
        </PlausibleProvider>
      </body>
    </html>
  );
}
