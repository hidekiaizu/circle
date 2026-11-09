import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Circle — CMU's shared social map",
  description:
    "A shared, interactive map of CMU profiles, communities, and mutually confirmed connections.",
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
