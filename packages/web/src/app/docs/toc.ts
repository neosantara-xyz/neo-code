import type { ReactNode } from "react";

export interface TableOfContentsItem {
	id: string;
	title: string;
	depth: 2 | 3;
}

export function slugifyHeading(text: string): string {
	return (
		text
			.toLowerCase()
			.trim()
			.replace(/[`*_~[\]()]/g, "")
			.replace(/&/g, " and ")
			.replace(/[^a-z0-9\s-]/g, "")
			.replace(/\s+/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "") || "section"
	);
}

export function createHeadingSlugger(): (text: string) => string {
	const seen = new Map<string, number>();

	return (text: string) => {
		const base = slugifyHeading(text);
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		return count === 0 ? base : `${base}-${count + 1}`;
	};
}

export function reactNodeToText(node: ReactNode): string {
	if (typeof node === "string" || typeof node === "number") {
		return String(node);
	}
	if (Array.isArray(node)) {
		return node.map(reactNodeToText).join("");
	}
	if (node && typeof node === "object" && "props" in node) {
		const props = node.props as { children?: ReactNode };
		return reactNodeToText(props.children);
	}
	return "";
}

export function extractTableOfContents(content: string): TableOfContentsItem[] {
	const slug = createHeadingSlugger();
	const items: TableOfContentsItem[] = [];
	let inFence = false;

	for (const line of content.split("\n")) {
		if (/^\s*```/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;

		const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
		if (!match) continue;

		const title = match[2].trim();
		items.push({
			id: slug(title),
			title,
			depth: match[1].length as 2 | 3,
		});
	}

	return items;
}
