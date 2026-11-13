import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Circle — CMU's shared social map",
  description:
    "A shared, interactive map of CMU profiles, communities, and mutually confirmed connections.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Let the app draw under device chrome; surfaces pad with env(safe-area-*).
  viewportFit: "cover",
  themeColor: "#0b0f1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
