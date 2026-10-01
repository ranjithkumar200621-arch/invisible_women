import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Invisible Woman - Government Scheme Assistant",
  description: "Voice-first access to Tamil Nadu government women's welfare schemes. Get information about benefits, eligibility, and application procedures in your language.",
  keywords: ["government schemes", "women welfare", "Tamil Nadu", "voice assistant", "Kalaignar Magalir Urimai Thogai"],
  authors: [{ name: "Government of Tamil Nadu" }],
  generator: "The Invisible Woman",
  referrer: "origin",
  category: "Government Services",
  openGraph: {
    title: "The Invisible Woman - Government Scheme Assistant",
    description: "Voice-first access to Tamil Nadu government women's welfare schemes",
    type: "website",
    locale: "ta_IN",
  },
  twitter: {
    card: "summary",
    title: "The Invisible Woman",
    description: "Voice-first government scheme assistant for Tamil Nadu women",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ta" dir="auto">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content="#2c5f8d" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>{children}</body>
    </html>
  );
}
