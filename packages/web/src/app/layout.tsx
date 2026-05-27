import type { Metadata } from "next";
import { buildSiteMetadata, DEFAULT_DESCRIPTION, DEFAULT_TITLE } from "./seo";
import { SiteStructuredData } from "./structured-data";
import "./globals.css";

export const metadata: Metadata = {
  ...buildSiteMetadata({
    description: DEFAULT_DESCRIPTION,
    path: "/",
    title: DEFAULT_TITLE,
  }),
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
        <SiteStructuredData />
      </head>
      <body className="scanlines min-h-screen">{children}</body>
    </html>
  );
}
