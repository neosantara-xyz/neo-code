import { type Dirent, statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { AgentToolResult } from "@neosantara/agent-core";
import { type Static, Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { DEFAULT_MAX_LINES, type TruncationResult, truncateHead } from "./truncate.js";

const lspSchema = Type.Object({
	action: Type.Union([Type.Literal("workspaceSymbols"), Type.Literal("definition"), Type.Literal("references")]),
	query: Type.String({ description: "Symbol name or search text" }),
	path: Type.Optional(Type.String({ description: "Optional file or directory scope" })),
	limit: Type.Optional(Type.Number({ description: "Maximum matches to return, default 50" })),
});

export type LspToolInput = Static<typeof lspSchema>;

export interface LspToolDetails {
	matchCount: number;
	truncation?: TruncationResult;
}

const CODE_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".py",
	".go",
	".rs",
	".java",
	".kt",
	".kts",
	".c",
	".cc",
	".cpp",
	".h",
	".hpp",
	".cs",
	".php",
	".rb",
	".swift",
]);

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", ".turbo"]);

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isWithinCwd(path: string, cwd: string): boolean {
	const relativePath = relative(cwd, path);
	return (
		relativePath === "" ||
		(!relativePath.startsWith(`..${sep}`) && relativePath !== ".." && !isAbsolute(relativePath))
	);
}

function toDisplayPath(path: string, cwd: string): string {
	return relative(cwd, path).split(sep).join("/");
}

async function collectFiles(root: string, limit = 2000): Promise<string[]> {
	const files: string[] = [];
	async function walk(dir: string): Promise<void> {
		if (files.length >= limit) return;
		let entries: Dirent[];
		try {
			entries = await readdir(dir, { withFileTypes: true, encoding: "utf8" });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (files.length >= limit) return;
			const path = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!SKIP_DIRS.has(entry.name)) await walk(path);
			} else if (entry.isFile() && CODE_EXTENSIONS.has(extname(entry.name))) {
				files.push(path);
			}
		}
	}
	let stat: ReturnType<typeof statSync>;
	try {
		stat = statSync(root);
	} catch {
		return [];
	}
	if (stat.isFile()) return CODE_EXTENSIONS.has(extname(root)) ? [root] : [];
	if (!stat.isDirectory()) return [];
	await walk(root);
	return files;
}

function getDefinitionPatterns(query: string): RegExp[] {
	const escaped = escapeRegExp(query);
	return [
		new RegExp(`^\\s*(?:export\\s+)?(?:declare\\s+)?(?:async\\s+)?function\\s+${escaped}\\b`),
		new RegExp(`^\\s*(?:export\\s+)?(?:abstract\\s+)?(?:class|interface|type|enum)\\s+${escaped}\\b`),
		new RegExp(`^\\s*(?:export\\s+)?(?:const|let|var)\\s+${escaped}\\b`),
		new RegExp(
			`^\\s*(?:public|private|protected|static|async|readonly|override|export|pub)\\s+.*\\b${escaped}\\s*\\(`,
		),
		new RegExp(`^\\s*${escaped}\\s*[:=]`),
		new RegExp(`^\\s*${escaped}\\s*\\([^)]*\\)\\s*(?::[^=]+)?\\s*(?:\\{|=>)`),
		new RegExp(`^\\s*(?:def|class)\\s+${escaped}\\b`),
		new RegExp(`^\\s*(?:pub\\s+)?(?:fn|struct|enum|trait)\\s+${escaped}\\b`),
	];
}

function getAnyDefinitionPatterns(): RegExp[] {
	return [
		/^\s*(?:export\s+)?(?:declare\s+)?(?:async\s+)?function\s+[A-Za-z_$][\w$]*/,
		/^\s*(?:export\s+)?(?:abstract\s+)?(?:class|interface|type|enum)\s+[A-Za-z_$][\w$]*/,
		/^\s*(?:export\s+)?(?:const|let|var)\s+[A-Za-z_$][\w$]*/,
		/^\s*(?:def|class)\s+[A-Za-z_][\w]*/,
		/^\s*(?:pub\s+)?(?:fn|struct|enum|trait)\s+[A-Za-z_][\w]*/,
	];
}

function classifySymbolLine(line: string, query: string, action: LspToolInput["action"]): boolean {
	const trimmedQuery = query.trim();
	if (action === "workspaceSymbols" && !trimmedQuery) {
		return getAnyDefinitionPatterns().some((pattern) => pattern.test(line));
	}
	if (!trimmedQuery) return false;
	const escaped = escapeRegExp(trimmedQuery);
	if (action === "references") return new RegExp(`\\b${escaped}\\b`).test(line);
	return getDefinitionPatterns(trimmedQuery).some((pattern) => pattern.test(line));
}

export function createLspToolDefinition(cwd: string): ToolDefinition<typeof lspSchema, LspToolDetails> {
	return {
		name: "lsp",
		label: "Code nav",
		description:
			"Find likely symbol definitions, references, and workspace symbols using language-aware source patterns. Prefer this over broad grep when navigating code symbols.",
		promptSnippet: "Navigate code symbols with definition/reference/workspace-symbol lookup.",
		promptGuidelines: [
			"Use lsp for symbol-level navigation before broad text search when looking for definitions, references, classes, functions, types, or interfaces.",
		],
		parameters: lspSchema,
		getActivityDescription: (args) => `${args.action} ${args.query}`,
		getToolUseSummary: (args) => `Code nav ${args.action}: ${args.query}`,
		renderToolResultSummary: (result) => `code nav found ${result.details.matchCount} matches`,
		async execute(_toolCallId, params): Promise<AgentToolResult<LspToolDetails>> {
			const workspace = resolve(cwd);
			const scope = resolve(workspace, params.path ?? ".");
			if (!isWithinCwd(scope, workspace)) {
				throw new Error("lsp path must stay within the current workspace");
			}
			const files = await collectFiles(scope);
			const limit = Math.max(1, Math.min(params.limit ?? 50, 200));
			const matches: string[] = [];
			for (const file of files) {
				let text: string;
				try {
					text = await readFile(file, "utf8");
				} catch {
					continue;
				}
				const lines = text.split(/\r?\n/);
				for (let index = 0; index < lines.length; index++) {
					if (!classifySymbolLine(lines[index], params.query, params.action)) continue;
					matches.push(`${toDisplayPath(file, workspace)}:${index + 1}: ${lines[index].trim()}`);
					if (matches.length >= limit) break;
				}
				if (matches.length >= limit) break;
			}
			const output =
				matches.length > 0 ? matches.join("\n") : `No ${params.action} matches found for ${params.query}.`;
			const truncated = truncateHead(output, { maxLines: DEFAULT_MAX_LINES, maxBytes: 80_000 });
			return {
				content: [{ type: "text", text: truncated.content }],
				details: { matchCount: matches.length, truncation: truncated.truncated ? truncated : undefined },
			};
		},
	};
}
