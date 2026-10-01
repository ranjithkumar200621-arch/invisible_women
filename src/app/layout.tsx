import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Invisible Woman",
  description: "Voice-first access to government services",
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
