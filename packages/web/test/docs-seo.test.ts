import assert from "node:assert/strict";
import { loadDoc } from "../src/app/docs/data";
import { buildDocMetadata, buildSiteMetadata } from "../src/app/seo";
import { buildSiteStructuredData, serializeJsonLd } from "../src/app/structured-data";

const home = buildSiteMetadata({
	description: "Neosantara-first AI coding agent for your terminal.",
	path: "/",
	title: "Neo Code - AI Coding Agent",
});

assert.equal(home.metadataBase?.toString(), "https://code.neosantara.xyz/");
assert.equal(home.alternates?.canonical, "/");
assert.equal(home.openGraph?.url, "/");
assert.deepEqual(home.openGraph?.images, [{ url: "/opengraph-image", width: 1200, height: 630 }]);
assert.deepEqual(home.twitter?.images, ["/opengraph-image"]);

const gettingStarted = loadDoc("getting-started");
assert.ok(gettingStarted);

const doc = buildDocMetadata(gettingStarted.entry);

assert.equal(doc.title, "Getting Started - Neo Code Docs");
assert.equal(doc.description, gettingStarted.entry.description);
assert.equal(doc.alternates?.canonical, "/docs/getting-started");
assert.equal(doc.openGraph?.title, "Getting Started - Neo Code Docs");
assert.equal(doc.openGraph?.url, "/docs/getting-started");
assert.deepEqual(doc.openGraph?.images, [{ url: "/docs/getting-started/opengraph-image", width: 1200, height: 630 }]);
assert.deepEqual(doc.twitter?.images, ["/docs/getting-started/opengraph-image"]);

const pricing = buildSiteMetadata({
	description: "Neo Code pricing for Neosantara balance, IDR token billing, and automatic usage tiers.",
	imagePath: "/opengraph-image",
	path: "/pricing",
	title: "Pricing - Neo Code",
});

assert.equal(pricing.title, "Pricing - Neo Code");
assert.equal(pricing.alternates?.canonical, "/pricing");
assert.equal(pricing.openGraph?.url, "/pricing");

const structuredData = buildSiteStructuredData();
assert.equal(structuredData["@context"], "https://schema.org");
assert.equal(structuredData["@graph"][0]["@type"], "Organization");
assert.equal(structuredData["@graph"][1]["@type"], "WebSite");
assert.equal(structuredData["@graph"][2]["@type"], "SoftwareApplication");

assert.equal(serializeJsonLd({ value: "</script>" }), '{"value":"\\u003c/script>"}');
