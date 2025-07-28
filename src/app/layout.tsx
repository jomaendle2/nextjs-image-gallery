import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/components/QueryProvider";
import PlausibleProvider from "next-plausible";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "the beauty of earth.",
  description:
    "Images from around the world. Explore the beauty of our planet 🌍",
  openGraph: {
    title: "the beauty of earth.",
    description:
      "Images from around the world. Explore the beauty of our planet 🌍",
    url: "https://images.jomaendle.com",
    images: [
      {
        url: "/api/og?title=the%20beauty%20of%20earth.",
        width: 1200,
        height: 630,
        alt: "the beauty of earth. - Images from around the world",
      },
    ],
    type: "website",
  },
  twitter: {
    title: "the beauty of earth.",
    description:
      "Images from around the world. Explore the beauty of our planet 🌍",
    card: "summary_large_image",
    images: ["/api/og?title=the%20beauty%20of%20earth."],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PlausibleProvider domain="thebeautyof.earth">
          <QueryProvider>
            {children}
            <SpeedInsights />
          </QueryProvider>
          <footer className="text-center fixed text-xs text-white/50 bottom-4 left-0 right-0 z-50 mt-8">
            © {new Date().getFullYear()}{" "}
            <a
              href="https://jomaendle.com"
              className="text-white/70 hover:text-white transition-colors duration-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              Jo Mändle
            </a>
          </footer>
        </PlausibleProvider>
      </body>
    </html>
  );
}
