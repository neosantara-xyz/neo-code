import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { AgentToolResult } from "@neosantara/agent-core";
import { type Static, Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { lspLocationToString, lspSymbolKindName, lspUriToPath } from "../lsp/client.js";
import { getLspManager } from "../lsp/manager.js";
import { findLspForFile, LSP_REGISTRY } from "../lsp/registry.js";
import { DEFAULT_MAX_LINES, type TruncationResult, truncateHead } from "./truncate.js";

const lspSchema = Type.Object({
	action: Type.Union([Type.Literal("workspaceSymbols"), Type.Literal("definition"), Type.Literal("references")]),
	query: Type.String({
		description:
			"For workspaceSymbols: a symbol name or search query. For definition/references: the symbol identifier to locate inside the file scope.",
	}),
	path: Type.Optional(
		Type.String({
			description:
				"For workspaceSymbols: optional file or directory scope. For definition/references: the source file containing the symbol (required).",
		}),
	),
	limit: Type.Optional(Type.Number({ description: "Maximum matches to return, default 50" })),
});

export type LspToolInput = Static<typeof lspSchema>;

export interface LspToolDetails {
	matchCount: number;
	server?: string;
	truncation?: TruncationResult;
	fallback?: "no-server" | "not-installed";
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

interface SymbolPosition {
	line: number;
	character: number;
	matchedLine: string;
}

async function locateSymbolInFile(absolutePath: string, query: string): Promise<SymbolPosition | undefined> {
	let text: string;
	try {
		text = await readFile(absolutePath, "utf8");
	} catch {
		return undefined;
	}
	const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(`\\b${escaped}\\b`);
	const lines = text.split(/\r?\n/);
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		const match = pattern.exec(line);
		if (match) {
			return { line: index, character: match.index, matchedLine: line };
		}
	}
	return undefined;
}

function buildNoServerMessage(scopePath: string, action: LspToolInput["action"]): string {
	const config = findLspForFile(scopePath);
	if (config) {
		return `No language server is installed for ${config.languages.join("/")} (${config.id}). Install with: ${config.installHint}\nNeo will fall back to plain text search; consider /lsp status for the full list.`;
	}
	if (action === "workspaceSymbols") {
		return `No language server is configured for this scope. Available servers: ${LSP_REGISTRY.map((entry) => entry.id).join(", ")}. Run /lsp status to see what is installed.`;
	}
	return `No language server is configured for ${scopePath}.`;
}

export function createLspToolDefinition(cwd: string): ToolDefinition<typeof lspSchema, LspToolDetails> {
	return {
		name: "lsp",
		label: "Code nav",
		description:
			"Navigate code symbols using a real Language Server Protocol client. Supports workspaceSymbols (search), definition (jump to declaration), and references (find usages). Requires a matching LSP binary on PATH (typescript-language-server, pyright-langserver, rust-analyzer, gopls, clangd, jdtls, solargraph). Run /lsp status to see installed servers. Falls back to a clear no-op message when no LSP is available.",
		promptSnippet: "Navigate code symbols via LSP definition/references/workspaceSymbols.",
		promptGuidelines: [
			"Use lsp before broad text search when looking for definitions, references, or workspace symbols.",
			"For definition or references, pass the source file in `path`. The query should be the symbol identifier.",
			"For workspaceSymbols, the query is a fuzzy symbol search across the workspace.",
		],
		parameters: lspSchema,
		getActivityDescription: (args) => `${args.action} ${args.query}`,
		getToolUseSummary: (args) => `Code nav ${args.action}: ${args.query}`,
		renderToolResultSummary: (result) => `code nav found ${result.details.matchCount} matches`,
		async execute(_toolCallId, params): Promise<AgentToolResult<LspToolDetails>> {
			const workspace = resolve(cwd);
			const limit = Math.max(1, Math.min(params.limit ?? 50, 200));
			const manager = getLspManager(workspace);

			if (params.action === "workspaceSymbols") {
				const scopePath = params.path ? resolve(workspace, params.path) : workspace;
				if (!isWithinCwd(scopePath, workspace)) {
					throw new Error("lsp path must stay within the current workspace");
				}
				let scopeIsFile = false;
				try {
					scopeIsFile = (await stat(scopePath)).isFile();
				} catch {
					// not present; treat as workspace-wide query
				}
				const candidate = scopeIsFile ? findLspForFile(scopePath) : undefined;
				const candidates = candidate ? [candidate] : LSP_REGISTRY;

				const matches: string[] = [];
				let usedServer: string | undefined;
				for (const config of candidates) {
					const client = await manager.getClient(config.id);
					if (!client) continue;
					const symbols = await client.workspaceSymbol(params.query);
					if (symbols.length === 0) continue;
					usedServer = usedServer ?? config.id;
					for (const symbol of symbols) {
						const location = lspLocationToString(symbol.location, workspace);
						const container = symbol.containerName ? `${symbol.containerName}.` : "";
						matches.push(`${location}: ${lspSymbolKindName(symbol.kind)} ${container}${symbol.name}`);
						if (matches.length >= limit) break;
					}
					if (matches.length >= limit) break;
				}

				if (!usedServer) {
					const message = buildNoServerMessage(scopePath, params.action);
					return {
						content: [{ type: "text", text: message }],
						details: { matchCount: 0, fallback: "no-server" },
					};
				}

				const output = matches.length > 0 ? matches.join("\n") : `No workspace symbols matched ${params.query}.`;
				const truncated = truncateHead(output, { maxLines: DEFAULT_MAX_LINES, maxBytes: 80_000 });
				return {
					content: [{ type: "text", text: truncated.content }],
					details: {
						matchCount: matches.length,
						server: usedServer,
						truncation: truncated.truncated ? truncated : undefined,
					},
				};
			}

			if (!params.path) {
				throw new Error(`lsp ${params.action} requires a "path" argument pointing to the source file`);
			}
			const filePath = resolve(workspace, params.path);
			if (!isWithinCwd(filePath, workspace)) {
				throw new Error("lsp path must stay within the current workspace");
			}
			const config = findLspForFile(filePath);
			if (!config) {
				return {
					content: [{ type: "text", text: buildNoServerMessage(filePath, params.action) }],
					details: { matchCount: 0, fallback: "no-server" },
				};
			}
			const client = await manager.getClient(config.id);
			if (!client) {
				return {
					content: [{ type: "text", text: buildNoServerMessage(filePath, params.action) }],
					details: { matchCount: 0, fallback: "not-installed" },
				};
			}

			const position = await locateSymbolInFile(filePath, params.query);
			if (!position) {
				return {
					content: [
						{
							type: "text",
							text: `Could not find an occurrence of ${params.query} inside ${toDisplayPath(filePath, workspace)} to anchor the LSP request.`,
						},
					],
					details: { matchCount: 0, server: config.id },
				};
			}

			await client.openDocument(filePath);
			const locations =
				params.action === "definition"
					? await client.definition(filePath, position.line, position.character)
					: await client.references(filePath, position.line, position.character);

			const lines = locations.slice(0, limit).map((location) => {
				const display = lspLocationToString(location, workspace);
				return `${display}: ${lspUriToPath(location.uri)}`;
			});
			const output =
				lines.length > 0
					? lines.join("\n")
					: `${params.action === "definition" ? "No definition" : "No references"} found for ${params.query} in ${toDisplayPath(filePath, workspace)}.`;
			const truncated = truncateHead(output, { maxLines: DEFAULT_MAX_LINES, maxBytes: 80_000 });
			return {
				content: [{ type: "text", text: truncated.content }],
				details: {
					matchCount: locations.length,
					server: config.id,
					truncation: truncated.truncated ? truncated : undefined,
				},
			};
		},
	};
}
