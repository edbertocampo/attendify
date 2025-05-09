import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Attendify",
  description: "A Digital Solution for Hassle-Free Attendance",
  icons: {
    icon: [
      { rel: "icon", url: "/favicon_io/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "32x32", url: "/favicon_io/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", url: "/favicon_io/favicon-16x16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", url: "/favicon_io/apple-touch-icon.png" },
      { rel: "manifest", url: "/favicon_io/site.webmanifest" }
    ]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        {children}
      </body>
    </html>
  );
}
