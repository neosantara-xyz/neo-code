import type { MetadataRoute } from "next";
import { loadDocs } from "./docs/data";
import { SITE_URL } from "./seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
	const now = new Date();
	const staticRoutes = ["", "/docs", "/pricing"].map((path) => ({
		lastModified: now,
		url: `${SITE_URL}${path}`,
	}));
	const docsRoutes = loadDocs().map((doc) => ({
		lastModified: now,
		url: `${SITE_URL}/docs/${doc.slug}`,
	}));

	return [...staticRoutes, ...docsRoutes];
}
