import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SITE_NAME, SITE_URL } from "./seo";

type JsonLdScalar = string | number | boolean | null;
type JsonLdValue = JsonLdScalar | JsonLdValue[] | { [key: string]: JsonLdValue };

interface SiteStructuredData {
	"@context": "https://schema.org";
	"@graph": [
		{ [key: string]: JsonLdValue },
		{ [key: string]: JsonLdValue },
		{ [key: string]: JsonLdValue },
	];
}

export function buildSiteStructuredData(): SiteStructuredData {
	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@id": `${SITE_URL}/#organization`,
				"@type": "Organization",
				name: "Neosantara",
				url: "https://neosantara.xyz",
			},
			{
				"@id": `${SITE_URL}/#website`,
				"@type": "WebSite",
				description: DEFAULT_DESCRIPTION,
				inLanguage: "en",
				name: SITE_NAME,
				publisher: { "@id": `${SITE_URL}/#organization` },
				url: SITE_URL,
			},
			{
				"@id": `${SITE_URL}/#software`,
				"@type": "SoftwareApplication",
				applicationCategory: "DeveloperApplication",
				description: DEFAULT_DESCRIPTION,
				name: DEFAULT_TITLE,
				operatingSystem: "macOS, Linux, Android",
				url: SITE_URL,
			},
		],
	};
}

export function serializeJsonLd(data: JsonLdValue | SiteStructuredData): string {
	return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function SiteStructuredData() {
	return (
		<script
			id="site-structured-data"
			type="application/ld+json"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is escaped before insertion.
			dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildSiteStructuredData()) }}
		/>
	);
}
