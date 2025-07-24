import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  },
  twitter: {
    title: "the beauty of earth.",
    description:
      "Images from around the world. Explore the beauty of our planet 🌍",
    card: "summary_large_image",
    creator: "@jomaendle",
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
        {children}
        <footer>
          <div className="text-center fixed text-sm text-gray-300 bottom-8 left-8 z-20 mt-8">
            © {new Date().getFullYear()} Jo Mändle
          </div>
        </footer>
      </body>
    </html>
  );
}
