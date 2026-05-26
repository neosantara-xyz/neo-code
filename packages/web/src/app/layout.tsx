import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "nes.css/css/nes.min.css";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Neo Code - AI Coding Agent",
  description:
    "AI coding agent for your terminal. Memory system, LSP integration, and intelligent auto-compaction.",
  metadataBase: new URL("https://code.neosantara.xyz"),
  openGraph: {
    title: "Neo Code - AI Coding Agent",
    description:
      "AI coding agent for your terminal. Memory system, LSP integration, and intelligent auto-compaction.",
    siteName: "Neo Code",
    type: "website",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={ibmPlexMono.className}>{children}</body>
    </html>
  );
}
