import fs from "node:fs";
import path from "node:path";

export interface DocEntry {
	slug: string;
	title: string;
	description: string;
}

export interface DocGroup {
	title: string;
	slugs: string[];
}

export const DOCS_DIR = path.resolve(process.cwd(), "../../docs");

const WEBSITE_HIDDEN_DOCS = new Set(["packages", "sdk", "tui"]);

export const DOC_ORDER = [
	"getting-started",
	"configuration",
	"tools",
	"sessions",
	"compaction",
	"subagents",
	"extensions",
	"themes",
	"memory",
	"skills",
	"lsp",
	"termux",
	"env",
];

export const DOC_GROUPS: DocGroup[] = [
	{ title: "Getting Started", slugs: ["getting-started", "configuration", "env"] },
	{ title: "Core Usage", slugs: ["tools", "sessions", "compaction", "memory"] },
	{ title: "Advanced", slugs: ["subagents", "extensions", "skills", "lsp"] },
	{ title: "Reference", slugs: ["themes", "termux"] },
];

export function extractTitle(content: string): string {
	const match = content.match(/^#\s+(.+)$/m);
	return match ? match[1] : "Untitled";
}

export function extractDescription(content: string): string {
	const lines = content.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("---")) {
			return trimmed.slice(0, 120);
		}
	}
	return "";
}

export function getAllSlugs(): string[] {
	if (!fs.existsSync(DOCS_DIR)) return [];
	return fs
		.readdirSync(DOCS_DIR)
		.filter((file) => file.endsWith(".md"))
		.map((file) => file.replace(/\.md$/, ""));
}

function isWebsiteDocSlug(slug: string): boolean {
	return !WEBSITE_HIDDEN_DOCS.has(slug);
}

export function sortDocs<T extends { slug: string }>(docs: T[]): T[] {
	return [...docs].sort((a, b) => {
		const ai = DOC_ORDER.indexOf(a.slug);
		const bi = DOC_ORDER.indexOf(b.slug);
		return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
	});
}

export function loadDocs(): DocEntry[] {
	const docs = getAllSlugs()
		.filter(isWebsiteDocSlug)
		.map((slug) => {
			const content = fs.readFileSync(path.join(DOCS_DIR, `${slug}.md`), "utf-8");
			return { slug, title: extractTitle(content), description: extractDescription(content) };
		});
	return sortDocs(docs);
}

export function loadDoc(slug: string): { entry: DocEntry; content: string } | undefined {
	if (!isWebsiteDocSlug(slug)) return undefined;

	const filePath = path.join(DOCS_DIR, `${slug}.md`);
	if (!fs.existsSync(filePath)) return undefined;
	const content = fs.readFileSync(filePath, "utf-8");
	return {
		entry: { slug, title: extractTitle(content), description: extractDescription(content) },
		content,
	};
}

export function getDocGroups(docs: DocEntry[]): Array<DocGroup & { docs: DocEntry[] }> {
	const bySlug = new Map(docs.map((doc) => [doc.slug, doc]));
	const grouped = new Set<string>();
	const groups = DOC_GROUPS.map((group) => {
		const entries = group.slugs.map((slug) => bySlug.get(slug)).filter((doc): doc is DocEntry => !!doc);
		for (const entry of entries) grouped.add(entry.slug);
		return { ...group, docs: entries };
	}).filter((group) => group.docs.length > 0);

	const other = docs.filter((doc) => !grouped.has(doc.slug));
	if (other.length > 0) {
		groups.push({ title: "Other", slugs: other.map((doc) => doc.slug), docs: other });
	}

	return groups;
}
