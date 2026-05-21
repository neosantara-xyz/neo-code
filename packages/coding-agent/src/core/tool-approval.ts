import { homedir } from "node:os";
import { isAbsolute, relative, resolve as resolvePath } from "node:path";
import type { AgentWorkMode } from "./agent-mode.js";

export type ToolApprovalBehavior = "allow" | "deny";
export type ToolApprovalScope = "once" | "session";
export type ToolApprovalRisk = "safe" | "command" | "write" | "extension";
export type ToolApprovalPolicy = "auto" | "ask";

export interface ToolApprovalRequest {
	toolName: string;
	toolCallId: string;
	args: unknown;
	mode: AgentWorkMode;
	risk: ToolApprovalRisk;
	summary: string;
	detail?: string;
	ruleKey: string;
}

export interface ToolApprovalDecision {
	behavior: ToolApprovalBehavior;
	scope?: ToolApprovalScope;
	feedback?: string;
	reason?: string;
	/** ExitPlanMode-only: permission mode to use after the plan is approved. */
	nextMode?: Exclude<AgentWorkMode, "plan">;
}

export type ToolApprovalHandler = (
	request: ToolApprovalRequest,
) => Promise<ToolApprovalDecision> | ToolApprovalDecision;

const SAFE_BUILTIN_TOOLS = new Set(["read", "grep", "find", "ls", "lsp", "todo"]);
const EDIT_BUILTIN_TOOLS = new Set(["edit", "write"]);
const EXIT_PLAN_MODE_TOOL_NAME = "ExitPlanMode";
const BUILTIN_TOOLS = new Set([
	"read",
	"grep",
	"find",
	"ls",
	"lsp",
	"todo",
	"agent",
	"mcp",
	"bash",
	"edit",
	"write",
	EXIT_PLAN_MODE_TOOL_NAME,
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function stringField(args: unknown, ...names: string[]): string | undefined {
	const record = asRecord(args);
	if (!record) return undefined;
	for (const name of names) {
		const value = record[name];
		if (typeof value === "string" && value.trim().length > 0) return value.trim();
	}
	return undefined;
}

function compact(value: string, max = 180): string {
	const normalized = value.replace(/\s+/g, " ").trim();
	if (normalized.length <= max) return normalized;
	return `${normalized.slice(0, Math.max(0, max - 1))}…`;
}

function expandApprovalPath(filePath: string): string {
	const normalized = filePath.startsWith("@") ? filePath.slice(1) : filePath;
	if (normalized === "~") return homedir();
	if (normalized.startsWith("~/")) return `${homedir()}${normalized.slice(1)}`;
	return normalized;
}

function resolveApprovalPath(filePath: string, cwd: string): string {
	const expanded = expandApprovalPath(filePath);
	return isAbsolute(expanded) ? expanded : resolvePath(cwd, expanded);
}

function isInsideDirectory(parentDir: string, targetPath: string): boolean {
	const relativePath = relative(parentDir, targetPath);
	return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function safeToolPathArg(toolName: string, args: unknown): string | undefined {
	switch (toolName) {
		case "read":
			return stringField(args, "path", "filePath", "filename");
		case "grep":
		case "find":
		case "ls":
		case "lsp":
			return stringField(args, "path", "dir", "directory");
		default:
			return undefined;
	}
}

export function isSafeToolRequestInsideCwd(toolName: string, args: unknown, cwd: string): boolean {
	if (!SAFE_BUILTIN_TOOLS.has(toolName)) return false;
	const requestedPath = safeToolPathArg(toolName, args);
	if (!requestedPath) return true;
	return isInsideDirectory(resolvePath(cwd), resolveApprovalPath(requestedPath, cwd));
}

export function getToolApprovalRisk(toolName: string): ToolApprovalRisk {
	if (SAFE_BUILTIN_TOOLS.has(toolName)) return "safe";
	if (toolName === "bash") return "command";
	if (EDIT_BUILTIN_TOOLS.has(toolName)) return "write";
	if (toolName === EXIT_PLAN_MODE_TOOL_NAME) return "extension";
	return "extension";
}

export function getToolApprovalPolicy(
	mode: AgentWorkMode,
	toolName: string,
	args?: unknown,
	cwd?: string,
): ToolApprovalPolicy {
	if (mode === "full") return "auto";
	if (mode === "ask") return "ask";
	if (SAFE_BUILTIN_TOOLS.has(toolName)) {
		return cwd && !isSafeToolRequestInsideCwd(toolName, args, cwd) ? "ask" : "auto";
	}
	if (mode === "read-only" || mode === "plan") return "ask";
	if (mode === "accept-edits" && EDIT_BUILTIN_TOOLS.has(toolName)) return "auto";
	return "ask";
}

export function formatToolApprovalSummary(toolName: string, args: unknown): string {
	switch (toolName) {
		case "bash": {
			const description = stringField(args, "description", "reason");
			if (description) return compact(description, 120);
			const command = stringField(args, "command", "cmd", "shell");
			return command ? `$ ${compact(command)}` : "Run a shell command";
		}
		case "write": {
			const filePath = stringField(args, "filePath", "path", "filename");
			return filePath ? `Write ${filePath}` : "Write a file";
		}
		case "edit": {
			const filePath = stringField(args, "filePath", "path", "filename");
			return filePath ? `Edit ${filePath}` : "Edit a file";
		}
		case "read": {
			const filePath = stringField(args, "filePath", "path", "filename");
			return filePath ? `Read ${filePath}` : "Read a file";
		}
		case "grep": {
			const pattern = stringField(args, "pattern", "query", "search");
			return pattern ? `Search for ${compact(pattern, 80)}` : "Search files";
		}
		case "find": {
			const pattern = stringField(args, "pattern", "query", "name");
			return pattern ? `Find ${compact(pattern, 80)}` : "Find files";
		}
		case "ls": {
			const filePath = stringField(args, "path", "dir", "directory");
			return filePath ? `List ${filePath}` : "List files";
		}
		case "lsp": {
			const query = stringField(args, "query");
			return query ? `Code navigation for ${compact(query, 80)}` : "Code navigation";
		}
		case "todo":
			return "Update todo plan";
		case "agent": {
			const description = stringField(args, "description");
			return description ? `Run subagent: ${compact(description, 100)}` : "Run subagent";
		}
		case "mcp": {
			const server = stringField(args, "server");
			const tool = stringField(args, "tool");
			return server && tool ? `Call MCP ${server}/${tool}` : "Use MCP";
		}
		case EXIT_PLAN_MODE_TOOL_NAME: {
			const plan = stringField(args, "plan");
			return plan ? `Submit plan: ${compact(plan, 120)}` : "Submit final plan";
		}
		default:
			return `Use ${toolName}`;
	}
}

export function getExitPlanModePlan(args: unknown): string | undefined {
	return stringField(args, "plan");
}

export function formatToolApprovalDetail(toolName: string, args: unknown): string | undefined {
	const record = asRecord(args);
	if (!record) return undefined;
	if (toolName === "bash") {
		const command = stringField(args, "command", "cmd", "shell");
		return command ? `$ ${compact(command, 220)}` : undefined;
	}
	if (toolName === EXIT_PLAN_MODE_TOOL_NAME) {
		const plan = getExitPlanModePlan(args);
		return plan ? compact(plan, 220) : undefined;
	}
	const keys = Object.keys(record).filter((key) => !["content", "newString", "oldString"].includes(key));
	if (keys.length === 0) return undefined;
	return compact(
		keys
			.slice(0, 5)
			.map((key) => `${key}: ${JSON.stringify(record[key])}`)
			.join(", "),
		220,
	);
}

export function createToolApprovalRuleKey(toolName: string, args: unknown): string {
	if (toolName === "bash") {
		const command = stringField(args, "command", "cmd", "shell");
		return `bash:${command ?? "*"}`;
	}
	if (toolName === "write" || toolName === "edit" || toolName === "read" || toolName === "lsp") {
		const filePath = stringField(args, "filePath", "path", "filename");
		return `${toolName}:${filePath ?? "*"}`;
	}
	if (BUILTIN_TOOLS.has(toolName)) return `${toolName}:*`;
	return `extension:${toolName}`;
}

export function createToolApprovalRequest(input: {
	toolName: string;
	toolCallId: string;
	args: unknown;
	mode: AgentWorkMode;
}): ToolApprovalRequest {
	return {
		...input,
		risk: getToolApprovalRisk(input.toolName),
		summary: formatToolApprovalSummary(input.toolName, input.args),
		detail: formatToolApprovalDetail(input.toolName, input.args),
		ruleKey: createToolApprovalRuleKey(input.toolName, input.args),
	};
}

export function formatToolApprovalDeniedReason(request: ToolApprovalRequest, decision?: ToolApprovalDecision): string {
	const feedback = decision?.feedback?.trim() || decision?.reason?.trim();
	return feedback
		? `User denied ${request.toolName}: ${feedback}`
		: `User denied permission to use ${request.toolName}`;
}
