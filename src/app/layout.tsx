import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import PlausibleProvider from "next-plausible";
import "./globals.css";
import QueryProvider from "@/components/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://images.jomaendle.com";
const TITLE = "the beauty of earth.";
const DESCRIPTION =
  "Images from around the world. Explore the beauty of our planet 🌍";
const OG_IMAGE = `/api/og?title=${encodeURIComponent(TITLE)}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
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
  themeColor: "#2a6b7c",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* The gallery fetches view counts from its own origin on mount. */}
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
