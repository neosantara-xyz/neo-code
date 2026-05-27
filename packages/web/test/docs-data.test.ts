import assert from "node:assert/strict";
import { getAllSlugs, loadDoc, loadDocs } from "../src/app/docs/data";

const hiddenDeveloperSlugs = ["packages", "sdk", "tui"];

for (const slug of hiddenDeveloperSlugs) {
	assert.ok(getAllSlugs().includes(slug), `${slug} should remain in root docs`);
	assert.equal(loadDoc(slug), undefined, `${slug} should not be routable on the website`);
	assert.ok(!loadDocs().some((doc) => doc.slug === slug), `${slug} should not appear in website docs`);
}
