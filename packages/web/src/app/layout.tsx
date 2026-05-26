import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neo Code - AI Coding Agent",
  description: "Neosantara-first AI coding agent for your terminal.",
  metadataBase: new URL("https://code.neosantara.xyz"),
  openGraph: {
    title: "Neo Code - AI Coding Agent",
    description: "Neosantara-first AI coding agent for your terminal.",
    siteName: "Neo Code",
    type: "website",
  },
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=IBM+Plex+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="scanlines min-h-screen">{children}</body>
    </html>
  );
}
