export { type AgentToolDetails, type AgentToolInput, createAgentToolDefinition } from "./agent.js";
export {
	type ApplyPatchToolDetails,
	type ApplyPatchToolInput,
	createApplyPatchToolDefinition,
} from "./apply-patch-tool.js";
export {
	type BashOperations,
	type BashSpawnContext,
	type BashSpawnHook,
	type BashToolDetails,
	type BashToolInput,
	type BashToolOptions,
	createBashTool,
	createBashToolDefinition,
	createLocalBashOperations,
} from "./bash.js";
export {
	createEditTool,
	createEditToolDefinition,
	type EditOperations,
	type EditToolDetails,
	type EditToolInput,
	type EditToolOptions,
} from "./edit.js";
export {
	createExitPlanModeToolDefinition,
	EXIT_PLAN_MODE_TOOL_NAME,
	type ExitPlanModeToolDetails,
	type ExitPlanModeToolInput,
	type ExitPlanModeToolOptions,
} from "./exit-plan-mode.js";
export { withFileMutationQueue } from "./file-mutation-queue.js";
export {
	createFindTool,
	createFindToolDefinition,
	type FindOperations,
	type FindToolDetails,
	type FindToolInput,
	type FindToolOptions,
} from "./find.js";
export {
	createGrepTool,
	createGrepToolDefinition,
	type GrepOperations,
	type GrepToolDetails,
	type GrepToolInput,
	type GrepToolOptions,
} from "./grep.js";
export {
	createLsTool,
	createLsToolDefinition,
	type LsOperations,
	type LsToolDetails,
	type LsToolInput,
	type LsToolOptions,
} from "./ls.js";
export { createLspToolDefinition, type LspToolDetails, type LspToolInput } from "./lsp.js";
export { createMcpToolDefinition, type McpToolDetails, type McpToolInput } from "./mcp.js";
export {
	createReadTool,
	createReadToolDefinition,
	type ReadOperations,
	type ReadToolDetails,
	type ReadToolInput,
	type ReadToolOptions,
} from "./read.js";
export { createTodoToolDefinition, type TodoToolDetails, type TodoToolInput } from "./todo.js";
export {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	type TruncationOptions,
	type TruncationResult,
	truncateHead,
	truncateLine,
	truncateTail,
} from "./truncate.js";
export {
	createWriteTool,
	createWriteToolDefinition,
	type WriteOperations,
	type WriteToolInput,
	type WriteToolOptions,
} from "./write.js";

import type { AgentTool } from "@neosantara/agent-core";
import type { ToolDefinition } from "../extensions/types.js";
import { createAgentToolDefinition } from "./agent.js";
import { createApplyPatchToolDefinition } from "./apply-patch-tool.js";
import { type BashToolOptions, createBashTool, createBashToolDefinition } from "./bash.js";
import { createEditTool, createEditToolDefinition, type EditToolOptions } from "./edit.js";
import {
	createExitPlanModeToolDefinition,
	EXIT_PLAN_MODE_TOOL_NAME,
	type ExitPlanModeToolOptions,
} from "./exit-plan-mode.js";
import { createFindTool, createFindToolDefinition, type FindToolOptions } from "./find.js";
import { createGrepTool, createGrepToolDefinition, type GrepToolOptions } from "./grep.js";
import { createLsTool, createLsToolDefinition, type LsToolOptions } from "./ls.js";
import { createLspToolDefinition } from "./lsp.js";
import { createMcpToolDefinition } from "./mcp.js";
import { createReadTool, createReadToolDefinition, type ReadToolOptions } from "./read.js";
import { createTodoToolDefinition } from "./todo.js";
import { createWriteTool, createWriteToolDefinition, type WriteToolOptions } from "./write.js";

export type Tool = AgentTool<any>;
export type ToolDef = ToolDefinition<any, any>;
export type ToolName =
	| "read"
	| "bash"
	| "edit"
	| "write"
	| "grep"
	| "find"
	| "ls"
	| "todo"
	| "lsp"
	| "apply_patch"
	| "agent"
	| "mcp"
	| typeof EXIT_PLAN_MODE_TOOL_NAME;
export const allToolNames: Set<ToolName> = new Set([
	"read",
	"bash",
	"edit",
	"write",
	"grep",
	"find",
	"ls",
	"todo",
	"lsp",
	"apply_patch",
	"agent",
	"mcp",
	EXIT_PLAN_MODE_TOOL_NAME,
]);

export interface ToolsOptions {
	read?: ReadToolOptions;
	bash?: BashToolOptions;
	write?: WriteToolOptions;
	edit?: EditToolOptions;
	grep?: GrepToolOptions;
	find?: FindToolOptions;
	ls?: LsToolOptions;
	mcp?: { getServers?: () => import("../mcp.js").McpServersSettings };
	exitPlanMode?: ExitPlanModeToolOptions;
}

export function createToolDefinition(toolName: ToolName, cwd: string, options?: ToolsOptions): ToolDef {
	switch (toolName) {
		case "read":
			return createReadToolDefinition(cwd, options?.read);
		case "bash":
			return createBashToolDefinition(cwd, options?.bash);
		case "edit":
			return createEditToolDefinition(cwd, options?.edit);
		case "write":
			return createWriteToolDefinition(cwd, options?.write);
		case "grep":
			return createGrepToolDefinition(cwd, options?.grep);
		case "find":
			return createFindToolDefinition(cwd, options?.find);
		case "ls":
			return createLsToolDefinition(cwd, options?.ls);
		case "todo":
			return createTodoToolDefinition(cwd);
		case "lsp":
			return createLspToolDefinition(cwd);
		case "apply_patch":
			return createApplyPatchToolDefinition(cwd);
		case "agent":
			return createAgentToolDefinition(cwd, { getMcpServers: options?.mcp?.getServers });
		case "mcp":
			return createMcpToolDefinition(options?.mcp?.getServers ?? (() => ({})));
		case EXIT_PLAN_MODE_TOOL_NAME:
			if (!options?.exitPlanMode) throw new Error(`${EXIT_PLAN_MODE_TOOL_NAME} requires exitPlanMode options`);
			return createExitPlanModeToolDefinition(options.exitPlanMode);
		default:
			throw new Error(`Unknown tool name: ${toolName}`);
	}
}

export function createTool(toolName: ToolName, cwd: string, options?: ToolsOptions): Tool {
	switch (toolName) {
		case "read":
			return createReadTool(cwd, options?.read);
		case "bash":
			return createBashTool(cwd, options?.bash);
		case "edit":
			return createEditTool(cwd, options?.edit);
		case "write":
			return createWriteTool(cwd, options?.write);
		case "grep":
			return createGrepTool(cwd, options?.grep);
		case "find":
			return createFindTool(cwd, options?.find);
		case "ls":
			return createLsTool(cwd, options?.ls);
		case "todo":
			return createTodoToolDefinition(cwd) as Tool;
		case "lsp":
			return createLspToolDefinition(cwd) as Tool;
		case "apply_patch":
			return createApplyPatchToolDefinition(cwd) as Tool;
		case "agent":
			return createAgentToolDefinition(cwd, { getMcpServers: options?.mcp?.getServers }) as Tool;
		case "mcp":
			return createMcpToolDefinition(options?.mcp?.getServers ?? (() => ({}))) as Tool;
		case EXIT_PLAN_MODE_TOOL_NAME:
			if (!options?.exitPlanMode) throw new Error(`${EXIT_PLAN_MODE_TOOL_NAME} requires exitPlanMode options`);
			return createExitPlanModeToolDefinition(options.exitPlanMode) as Tool;
		default:
			throw new Error(`Unknown tool name: ${toolName}`);
	}
}

export function createCodingToolDefinitions(cwd: string, options?: ToolsOptions): ToolDef[] {
	return [
		createReadToolDefinition(cwd, options?.read),
		createBashToolDefinition(cwd, options?.bash),
		createEditToolDefinition(cwd, options?.edit),
		createWriteToolDefinition(cwd, options?.write),
		createApplyPatchToolDefinition(cwd),
	];
}

export function createReadOnlyToolDefinitions(cwd: string, options?: ToolsOptions): ToolDef[] {
	return [
		createReadToolDefinition(cwd, options?.read),
		createGrepToolDefinition(cwd, options?.grep),
		createFindToolDefinition(cwd, options?.find),
		createLsToolDefinition(cwd, options?.ls),
	];
}

export function createAllToolDefinitions(cwd: string, options?: ToolsOptions): Record<ToolName, ToolDef> {
	return {
		read: createReadToolDefinition(cwd, options?.read),
		bash: createBashToolDefinition(cwd, options?.bash),
		edit: createEditToolDefinition(cwd, options?.edit),
		write: createWriteToolDefinition(cwd, options?.write),
		grep: createGrepToolDefinition(cwd, options?.grep),
		find: createFindToolDefinition(cwd, options?.find),
		ls: createLsToolDefinition(cwd, options?.ls),
		todo: createTodoToolDefinition(cwd),
		lsp: createLspToolDefinition(cwd),
		apply_patch: createApplyPatchToolDefinition(cwd),
		agent: createAgentToolDefinition(cwd, { getMcpServers: options?.mcp?.getServers }),
		mcp: createMcpToolDefinition(options?.mcp?.getServers ?? (() => ({}))),
		[EXIT_PLAN_MODE_TOOL_NAME]: options?.exitPlanMode
			? createExitPlanModeToolDefinition(options.exitPlanMode)
			: createExitPlanModeToolDefinition({
					getCurrentMode: () => "plan",
					onApproved: () => "default",
				}),
	};
}

export function createCodingTools(cwd: string, options?: ToolsOptions): Tool[] {
	return [
		createReadTool(cwd, options?.read),
		createBashTool(cwd, options?.bash),
		createEditTool(cwd, options?.edit),
		createWriteTool(cwd, options?.write),
	];
}

export function createReadOnlyTools(cwd: string, options?: ToolsOptions): Tool[] {
	return [
		createReadTool(cwd, options?.read),
		createGrepTool(cwd, options?.grep),
		createFindTool(cwd, options?.find),
		createLsTool(cwd, options?.ls),
	];
}

export function createAllTools(cwd: string, options?: ToolsOptions): Record<ToolName, Tool> {
	return {
		read: createReadTool(cwd, options?.read),
		bash: createBashTool(cwd, options?.bash),
		edit: createEditTool(cwd, options?.edit),
		write: createWriteTool(cwd, options?.write),
		grep: createGrepTool(cwd, options?.grep),
		find: createFindTool(cwd, options?.find),
		ls: createLsTool(cwd, options?.ls),
		todo: createTodoToolDefinition(cwd) as Tool,
		lsp: createLspToolDefinition(cwd) as Tool,
		apply_patch: createApplyPatchToolDefinition(cwd) as Tool,
		agent: createAgentToolDefinition(cwd, { getMcpServers: options?.mcp?.getServers }) as Tool,
		mcp: createMcpToolDefinition(options?.mcp?.getServers ?? (() => ({}))) as Tool,
		[EXIT_PLAN_MODE_TOOL_NAME]: options?.exitPlanMode
			? (createExitPlanModeToolDefinition(options.exitPlanMode) as Tool)
			: (createExitPlanModeToolDefinition({
					getCurrentMode: () => "plan",
					onApproved: () => "default",
				}) as Tool),
	};
}
