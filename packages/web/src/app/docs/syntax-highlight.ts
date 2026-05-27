import hljs from "highlight.js";

export interface HighlightedCodeBlock {
	highlighted: boolean;
	html: string;
	language: string | undefined;
}

const LANGUAGE_ALIASES = new Map<string, string>([
	["c++", "cpp"],
	["js", "javascript"],
	["jsx", "javascript"],
	["md", "markdown"],
	["py", "python"],
	["rb", "ruby"],
	["rs", "rust"],
	["sh", "bash"],
	["shell", "bash"],
	["ts", "typescript"],
	["tsx", "typescript"],
	["yml", "yaml"],
]);

export function normalizeHighlightLanguage(language: string | undefined): string | undefined {
	if (!language) return undefined;

	const normalized = language.trim().toLowerCase();
	const candidate = LANGUAGE_ALIASES.get(normalized) ?? normalized;
	return hljs.getLanguage(candidate) ? candidate : undefined;
}

export function highlightCodeBlock(code: string, language: string | undefined): HighlightedCodeBlock {
	const normalizedLanguage = normalizeHighlightLanguage(language);
	if (!normalizedLanguage) {
		return {
			highlighted: false,
			html: escapeHtml(code),
			language: undefined,
		};
	}

	try {
		return {
			highlighted: true,
			html: hljs.highlight(code, { language: normalizedLanguage, ignoreIllegals: true }).value,
			language: normalizedLanguage,
		};
	} catch {
		return {
			highlighted: false,
			html: escapeHtml(code),
			language: undefined,
		};
	}
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
