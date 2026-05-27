import type { Metadata } from "next";
import type { DocEntry } from "./docs/data";

export const SITE_NAME = "Neo Code";
export const SITE_URL = "https://code.neosantara.xyz";
export const DEFAULT_TITLE = "Neo Code - AI Coding Agent";
export const DEFAULT_DESCRIPTION = "Neosantara-first AI coding agent for your terminal.";
export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

interface SiteMetadataInput {
	title: string;
	description: string;
	path: string;
	imagePath?: string;
}

export function buildSiteMetadata({
	title,
	description,
	path,
	imagePath = "/opengraph-image",
}: SiteMetadataInput): Metadata {
	return {
		title,
		description,
		metadataBase: new URL(SITE_URL),
		alternates: {
			canonical: path,
		},
		openGraph: {
			title,
			description,
			images: [{ url: imagePath, ...OG_IMAGE_SIZE }],
			siteName: SITE_NAME,
			type: "website",
			url: path,
		},
		robots: {
			follow: true,
			index: true,
		},
		twitter: {
			card: "summary_large_image",
			description,
			images: [imagePath],
			title,
		},
	};
}

export function buildDocMetadata(doc: DocEntry): Metadata {
	const path = `/docs/${doc.slug}`;
	const title = `${doc.title} - Neo Code Docs`;

	return buildSiteMetadata({
		description: doc.description || DEFAULT_DESCRIPTION,
		imagePath: `${path}/opengraph-image`,
		path,
		title,
	});
}
