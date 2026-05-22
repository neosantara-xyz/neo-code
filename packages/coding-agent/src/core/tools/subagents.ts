import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "../../config.js";
import { parseFrontmatter } from "../../utils/frontmatter.js";
import type { McpServerConfig, McpServersSettings } from "../mcp.js";

export type SubagentMcpServerSpec = string | McpServersSettings;

export interface SubagentDefinition {
	name: string;
	description: string;
	prompt: string;
	source: "built-in" | "project" | "user" | "claude-project" | "claude-user";
	path?: string;
	tools?: string[];
	disallowedTools?: string[];
	model?: string;
	maxTurns?: number;
	mcpServers?: SubagentMcpServerSpec[];
}

interface SubagentFrontmatter extends Record<string, unknown> {
	name?: unknown;
	description?: unknown;
	tools?: unknown;
	disallowedTools?: unknown;
	model?: unknown;
	maxTurns?: unknown;
	mcpServers?: unknown;
}

const BUILT_IN_SUBAGENTS: readonly SubagentDefinition[] = [
	{
		name: "general-purpose",
		description: "General codebase research agent. Use when the task is not covered by a more specific subagent.",
		prompt: [
			"You are a focused Neo Code subagent for codebase research.",
			"Inspect only the information needed for the delegated task.",
			"Return concise findings with relevant file paths and line numbers when available.",
			"Do not modify project files.",
		].join("\n"),
		source: "built-in",
	},
	{
		name: "explore",
		description: "Explore unfamiliar code and map the relevant files, functions, and data flow.",
		prompt: [
			"You are a code exploration subagent.",
			"Find the smallest set of relevant files and explain how they fit together.",
			"Prioritize existing functions, UI patterns, tests, and config before suggesting new code.",
			"Do not modify project files.",
		].join("\n"),
		source: "built-in",
	},
	{
		name: "plan",
		description: "Create an implementation plan after inspecting the codebase.",
		prompt: [
			"You are a planning subagent.",
			"Inspect the relevant code, identify existing logic to reuse, and produce a concise implementation plan.",
			"Include files to change, risks, and validation commands.",
			"Do not modify project files.",
		].join("\n"),
		source: "built-in",
	},
	{
		name: "verification",
		description: "Verify a completed implementation by checking behavior, tests, and edge cases.",
		prompt: [
			"You are a verification-only subagent.",
			"Inspect the implementation and report concrete verification steps, likely gaps, and commands to run.",
			"Do not modify project files.",
		].join("\n"),
		source: "built-in",
	},
	{
		name: "reviewer",
		description:
			"Code reviewer subagent. Use to review diffs, branches, commits, or PRs with prioritized P0–P3 findings.",
		prompt: [
			"You are a code reviewer subagent for Neo Code.",
			"Inspect the diff or change set the parent agent points you at and surface only actionable findings.",
			"Use the priority tags [P0], [P1], [P2], [P3] in the order Codex's review prompt defines.",
			"For each finding produce one short paragraph with file:line citations and an inline code snippet only when a fix is non-obvious.",
			"Do not propose full PR fixes. End with a 'Verdict' section stating 'patch is correct' or 'patch is incorrect' with a one-paragraph justification.",
			"Do not modify project files.",
		].join("\n"),
		source: "built-in",
	},
];

export function normalizeSubagentName(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function normalizeStringArray(value: unknown): string[] | undefined {
	if (value === undefined || value === null) return undefined;
	if (Array.isArray(value)) {
		const items = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
		return items.length > 0 ? items : undefined;
	}
	if (typeof value === "string") {
		const items = value
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean);
		return items.length > 0 ? items : undefined;
	}
	return undefined;
}

function normalizePositiveInteger(value: unknown): number | undefined {
	const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
	if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
	return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMcpServerConfig(value: unknown): McpServerConfig | undefined {
	if (!isRecord(value) || typeof value.command !== "string" || value.command.trim().length === 0) {
		return undefined;
	}
	const args = Array.isArray(value.args)
		? value.args.filter((item): item is string => typeof item === "string")
		: undefined;
	const env = isRecord(value.env)
		? Object.fromEntries(
				Object.entries(value.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
			)
		: undefined;
	return { command: value.command.trim(), ...(args ? { args } : {}), ...(env ? { env } : {}) };
}

function normalizeMcpServerSpecs(value: unknown): SubagentMcpServerSpec[] | undefined {
	if (value === undefined || value === null) return undefined;
	const rawSpecs = Array.isArray(value) ? value : [value];
	const specs: SubagentMcpServerSpec[] = [];
	for (const rawSpec of rawSpecs) {
		if (typeof rawSpec === "string" && rawSpec.trim()) {
			specs.push(rawSpec.trim());
			continue;
		}
		if (!isRecord(rawSpec)) continue;
		const inlineServers: McpServersSettings = {};
		for (const [serverName, serverConfig] of Object.entries(rawSpec)) {
			const normalizedConfig = normalizeMcpServerConfig(serverConfig);
			if (serverName.trim() && normalizedConfig) {
				inlineServers[serverName.trim()] = normalizedConfig;
			}
		}
		if (Object.keys(inlineServers).length > 0) specs.push(inlineServers);
	}
	return specs.length > 0 ? specs : undefined;
}

function parseSubagentMarkdown(path: string, source: SubagentDefinition["source"]): SubagentDefinition | undefined {
	let raw: string;
	try {
		raw = readFileSync(path, "utf8");
	} catch {
		return undefined;
	}
	const { frontmatter, body } = parseFrontmatter<SubagentFrontmatter>(raw);
	const fallbackName = basename(path, ".md");
	const rawName = typeof frontmatter.name === "string" && frontmatter.name.trim() ? frontmatter.name : fallbackName;
	const name = normalizeSubagentName(rawName);
	if (!name) return undefined;

	const description =
		typeof frontmatter.description === "string" && frontmatter.description.trim()
			? frontmatter.description.trim().replace(/\\n/g, "\n")
			: undefined;
	if (!description) return undefined;

	const prompt = body.trim();
	if (!prompt) return undefined;

	const model =
		typeof frontmatter.model === "string" && frontmatter.model.trim() ? frontmatter.model.trim() : undefined;

	return {
		name,
		description,
		prompt,
		source,
		path,
		tools: normalizeStringArray(frontmatter.tools),
		disallowedTools: normalizeStringArray(frontmatter.disallowedTools),
		model,
		maxTurns: normalizePositiveInteger(frontmatter.maxTurns),
		mcpServers: normalizeMcpServerSpecs(frontmatter.mcpServers),
	};
}

function collectMarkdownFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];
	let stat: ReturnType<typeof statSync>;
	try {
		stat = statSync(dir);
	} catch {
		return [];
	}
	if (!stat.isDirectory()) return [];

	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectMarkdownFiles(path));
			continue;
		}
		if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
			files.push(path);
		}
	}
	return files;
}

function getCustomAgentLocations(cwd: string): Array<{ dir: string; source: SubagentDefinition["source"] }> {
	return [
		{ dir: join(getAgentDir(), "agents"), source: "user" },
		{ dir: join(cwd, CONFIG_DIR_NAME, "agents"), source: "project" },
		{ dir: join(process.env.HOME ?? "", ".claude", "agents"), source: "claude-user" },
		{ dir: join(cwd, ".claude", "agents"), source: "claude-project" },
	];
}

export function getSubagentDefinitions(cwd: string): SubagentDefinition[] {
	const definitions: SubagentDefinition[] = [...BUILT_IN_SUBAGENTS];
	for (const { dir, source } of getCustomAgentLocations(cwd)) {
		if (!dir) continue;
		for (const path of collectMarkdownFiles(dir)) {
			const definition = parseSubagentMarkdown(path, source);
			if (definition) definitions.push(definition);
		}
	}

	const byName = new Map<string, SubagentDefinition>();
	for (const definition of definitions) {
		byName.set(definition.name, definition);
	}
	return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function getDefaultSubagentDefinition(definitions: SubagentDefinition[]): SubagentDefinition {
	return definitions.find((definition) => definition.name === "general-purpose") ?? definitions[0]!;
}

export function findSubagentDefinition(cwd: string, name: string | undefined): SubagentDefinition {
	const definitions = getSubagentDefinitions(cwd);
	if (!name) return getDefaultSubagentDefinition(definitions);
	const normalized = normalizeSubagentName(name);
	return definitions.find((definition) => definition.name === normalized) ?? getDefaultSubagentDefinition(definitions);
}

export function resolveSubagentMcpServers(
	definition: SubagentDefinition,
	configuredServers: McpServersSettings,
): McpServersSettings {
	if (!definition.mcpServers || definition.mcpServers.length === 0) return configuredServers;
	const scopedServers: McpServersSettings = {};
	for (const spec of definition.mcpServers) {
		if (typeof spec === "string") {
			const configured = configuredServers[spec];
			if (configured) scopedServers[spec] = configured;
			continue;
		}
		Object.assign(scopedServers, spec);
	}
	return scopedServers;
}

export function formatSubagentList(definitions: SubagentDefinition[]): string {
	return definitions
		.map((definition) => {
			const source =
				definition.source === "built-in" ? "built-in" : `${definition.source}:${definition.path ?? "unknown"}`;
			return `- ${definition.name}: ${definition.description} (${source})`;
		})
		.join("\n");
}
