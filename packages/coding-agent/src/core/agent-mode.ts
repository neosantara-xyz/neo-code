export const AGENT_WORK_MODES = ["default", "ask", "read-only", "plan", "accept-edits", "full"] as const;
export const EXIT_PLAN_MODE_TOOL_NAME = "ExitPlanMode";
export const AGENT_WORK_MODE_CYCLE = ["default", "accept-edits", "plan"] as const satisfies readonly AgentWorkMode[];

export type AgentWorkMode = (typeof AGENT_WORK_MODES)[number];

/**
 * Claude Code starts in `default` permission mode and only makes non-default
 * modes visually prominent. Neo keeps that mental model and maps it onto
 * Neo's work modes and per-tool approval policy.
 */
export const DEFAULT_AGENT_WORK_MODE: AgentWorkMode = "default";

export interface AgentWorkModeConfig {
	label: string;
	shortLabel: string;
	symbol: string;
	footerDetail: string;
	toolSummary: string;
	description: string;
}

export const AGENT_WORK_MODE_CONFIG: Record<AgentWorkMode, AgentWorkModeConfig> = {
	default: {
		label: "Default",
		shortLabel: "default",
		symbol: "◇",
		footerDetail: "normal tools",
		toolSummary: "read, grep, find, ls, lsp, todo, agent, bash, edit, write + extensions",
		description: "Normal Neo coding mode. Inspect files without prompts, then ask before shell commands and edits.",
	},
	ask: {
		label: "Ask",
		shortLabel: "ask",
		symbol: "?",
		footerDetail: "chat only",
		toolSummary: "none",
		description: "Chat only. No tools are exposed to the model.",
	},
	"read-only": {
		label: "Read-only",
		shortLabel: "read",
		symbol: "◌",
		footerDetail: "inspect only",
		toolSummary: "read, grep, find, ls, lsp",
		description: "Inspect files with read/search/list tools only. No edits or shell commands.",
	},
	plan: {
		label: "Plan",
		shortLabel: "plan",
		symbol: "⏸",
		footerDetail: "planning only",
		toolSummary: "read, grep, find, ls, lsp, todo, ExitPlanMode",
		description:
			"Inspect safely, ask clarifying questions, then present a concrete implementation plan. No execution.",
	},
	"accept-edits": {
		label: "Accept edits",
		shortLabel: "accept",
		symbol: "⏵⏵",
		footerDetail: "edits allowed",
		toolSummary: "read, grep, find, ls, lsp, todo, agent, bash, edit, write + extensions",
		description: "Claude-style accept-edits mode. Inspect and edit workspace files without switching modes again.",
	},
	full: {
		label: "Full",
		shortLabel: "full",
		symbol: "⚡",
		footerDetail: "all tools",
		toolSummary: "all registered tools",
		description: "Expose every registered tool. Use only for trusted projects.",
	},
};

const AGENT_MODE_ALIASES: Record<string, AgentWorkMode> = {
	default: "default",
	normal: "default",
	agent: "default",
	write: "default",
	edit: "default",
	coding: "default",
	ask: "ask",
	chat: "ask",
	askonly: "ask",
	"ask-only": "ask",
	askmode: "ask",
	"ask-mode": "ask",
	readonly: "read-only",
	"read-only": "read-only",
	read: "read-only",
	inspect: "read-only",
	plan: "plan",
	planning: "plan",
	acceptedits: "accept-edits",
	"accept-edits": "accept-edits",
	accept: "accept-edits",
	autoedit: "accept-edits",
	"auto-edit": "accept-edits",
	full: "full",
	bypass: "full",
	"bypass-permissions": "full",
	bypasspermissions: "full",
	all: "full",
};

function normalizeModeKey(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, "-");
}

export function parseAgentWorkMode(value: string | undefined): AgentWorkMode | undefined {
	if (!value) return undefined;
	const key = normalizeModeKey(value);
	return AGENT_MODE_ALIASES[key] ?? undefined;
}

export function isAgentWorkMode(value: string | undefined): value is AgentWorkMode {
	return parseAgentWorkMode(value) !== undefined;
}

export function formatAgentWorkModeList(): string {
	return AGENT_WORK_MODES.join(", ");
}

export function isDefaultAgentWorkMode(mode: AgentWorkMode | undefined): boolean {
	return !mode || mode === "default";
}

export function getNextAgentWorkMode(mode: AgentWorkMode): AgentWorkMode {
	const index = AGENT_WORK_MODE_CYCLE.indexOf(mode as (typeof AGENT_WORK_MODE_CYCLE)[number]);
	if (index === -1) return "default";
	return AGENT_WORK_MODE_CYCLE[(index + 1) % AGENT_WORK_MODE_CYCLE.length]!;
}

export function formatAgentWorkModeCycleList(): string {
	return AGENT_WORK_MODE_CYCLE.join(" → ");
}

export function getAgentWorkModeLabel(mode: AgentWorkMode): string {
	return AGENT_WORK_MODE_CONFIG[mode].label;
}

export function getAgentWorkModeShortLabel(mode: AgentWorkMode): string {
	return AGENT_WORK_MODE_CONFIG[mode].shortLabel;
}

export function getAgentWorkModeSymbol(mode: AgentWorkMode): string {
	return AGENT_WORK_MODE_CONFIG[mode].symbol;
}

export function getAgentWorkModeFooterDetail(mode: AgentWorkMode): string {
	return AGENT_WORK_MODE_CONFIG[mode].footerDetail;
}

export function getAgentWorkModeToolSummary(mode: AgentWorkMode): string {
	return AGENT_WORK_MODE_CONFIG[mode].toolSummary;
}

export function getBuiltinToolNamesForAgentMode(mode: AgentWorkMode): string[] {
	switch (mode) {
		case "ask":
			return [];
		case "read-only":
			return ["read", "grep", "find", "ls", "lsp"];
		case "plan":
			return ["read", "grep", "find", "ls", "lsp", "todo", EXIT_PLAN_MODE_TOOL_NAME];
		case "default":
		case "accept-edits":
			return ["read", "grep", "find", "ls", "lsp", "todo", "agent", "mcp", "bash", "edit", "write"];
		case "full":
			return [];
	}
}

export function getAgentModePromptAppend(mode: AgentWorkMode): string {
	switch (mode) {
		case "ask":
			return [
				"# Active Neo Code mode: Ask",
				"No tools are available. Answer from the conversation context only.",
				"If you need project files or command output, ask the user to provide it or ask them to switch to `/mode read-only` or `/mode default`.",
			].join("\n");
		case "read-only":
			return [
				"# Active Neo Code mode: Read-only",
				"Only inspect the project with read/search/list tools. Do not modify files, create files, delete files, install packages, or run shell commands.",
				"Avoid repeating an identical read/search/list tool call with the same path and arguments unless the previous result is stale or insufficient; reuse the information already returned in the current turn.",
				"If the user asks for implementation, explain the recommended changes and ask them to switch to `/mode default` or `/mode accept-edits` before editing.",
			].join("\n");
		case "plan":
			return [
				"# Active Neo Code mode: Plan",
				"Plan mode is active. The user does not want execution yet. You MUST NOT modify files, create files, delete files, install packages, run shell commands, change configuration, make commits, or otherwise mutate the system.",
				"Only use read-only inspection tools (`read`, `grep`, `find`, `ls`, `lsp`) inside the workspace. If required information is outside the workspace, ask first instead of reading it silently.",
				"Do not repeat identical read/search/list tool calls with the same path and arguments in the same turn; use prior tool results unless you need different arguments.",
				`When the final implementation plan is ready, call ${EXIT_PLAN_MODE_TOOL_NAME} with the plan. Do not ask for plan approval in normal text.`,
				"Plan workflow: understand the request, inspect relevant files, identify existing functions/utilities/patterns to reuse, ask clarifying questions when requirements or approach are ambiguous, then present one recommended implementation plan.",
				"The final plan must be concise and actionable: include context, files to change, existing code to reuse with paths, implementation steps, risks/edge cases, and verification commands or checks.",
				`Do not ask generic approval questions like \`Should I proceed?\` in normal prose. ${EXIT_PLAN_MODE_TOOL_NAME} is the approval handoff.`,
			].join("\n");
		case "default":
			return [
				"# Active Neo Code mode: Default",
				"Use the available tools to solve coding tasks. Prefer `read`, `grep`, `find`, and `ls` for project inspection; these read-only tools run without approval inside the workspace. Use `bash` only when a command is needed, because shell commands still require approval in default mode.",
				"Avoid duplicate tool calls: if you already listed, searched, or read the same path with the same arguments in this turn, reuse that result instead of calling the same tool again.",
			].join("\n");
		case "accept-edits":
			return [
				"# Active Neo Code mode: Accept edits",
				"The user has selected a Claude-style accept-edits workflow. Use `read`, `grep`, `find`, `ls`, and `lsp` for project inspection without asking. Apply normal workspace file edits directly, while still avoiding destructive or broad changes unless clearly requested.",
				"Avoid duplicate tool calls: if you already listed, searched, or read the same path with the same arguments in this turn, reuse that result instead of calling the same tool again.",
				"Use `bash` only when command output is needed; shell commands still require approval. Keep changes small, validate when possible, and summarize what was changed.",
			].join("\n");
		case "full":
			return [
				"# Active Neo Code mode: Full",
				"All registered tools may be available. Be careful with destructive or broad changes, and keep changes small and reviewable.",
			].join("\n");
	}
}
