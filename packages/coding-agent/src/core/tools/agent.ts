import { Agent, type AgentMessage, type AgentTool } from "@neosantara/agent-core";
import { type Api, type Model, streamSimple } from "@neosantara/ai";
import { Text } from "@neosantara/tui";
import { type Static, Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import type { McpServersSettings } from "../mcp.js";
import { findExactModelReferenceMatch } from "../model-resolver.js";
import { createFindTool } from "./find.js";
import { createGrepTool } from "./grep.js";
import { createLsTool } from "./ls.js";
import { createLspToolDefinition } from "./lsp.js";
import { createMcpToolDefinition } from "./mcp.js";
import { createReadTool } from "./read.js";
import {
	findSubagentDefinition,
	formatSubagentList,
	getSubagentDefinitions,
	resolveSubagentMcpServers,
	type SubagentDefinition,
} from "./subagents.js";
import { createTodoToolDefinition } from "./todo.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const agentSchema = Type.Object({
	description: Type.String({ description: "Short 3-5 word description of the delegated task" }),
	prompt: Type.String({ description: "Detailed prompt for the subagent" }),
	subagent_type: Type.Optional(
		Type.String({ description: "Specialized subagent type to use. Omit for general-purpose." }),
	),
	model: Type.Optional(
		Type.String({
			description: "Optional model override as provider/model-id or model-id. Defaults to inherited model.",
		}),
	),
});

export type AgentToolInput = Static<typeof agentSchema>;

export interface AgentToolDetails {
	subagentType: string;
	messageCount: number;
	toolCalls: number;
	tools: string[];
	model: string;
}

export interface AgentToolOptions {
	getMcpServers?: () => McpServersSettings;
}

const DEFAULT_SUBAGENT_TOOLS = ["read", "grep", "find", "ls", "lsp"] as const;
const SUPPORTED_SUBAGENT_TOOLS = new Set(["read", "grep", "find", "ls", "lsp", "mcp", "todo"]);

function extractAssistantText(messages: AgentMessage[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message.role !== "assistant") continue;
		const texts = message.content
			.filter((part): part is { type: "text"; text: string } => part.type === "text")
			.map((part) => part.text.trim())
			.filter(Boolean);
		if (texts.length > 0) return texts.join("\n\n");
	}
	return "Subagent completed without a text response.";
}

function normalizeToolName(name: string): string {
	const normalized = name.trim();
	if (normalized === "Read") return "read";
	if (normalized === "Grep") return "grep";
	if (normalized === "Glob" || normalized === "Find") return "find";
	if (normalized === "LS") return "ls";
	if (normalized === "TodoWrite" || normalized === "TodoRead") return "todo";
	if (normalized === "MCP" || normalized === "mcp") return "mcp";
	if (normalized === "LSP" || normalized === "lsp") return "lsp";
	return normalized.toLowerCase();
}

function resolveSubagentToolNames(definition: SubagentDefinition): string[] {
	const requested = definition.tools?.length ? definition.tools : [...DEFAULT_SUBAGENT_TOOLS];
	const disallowed = new Set((definition.disallowedTools ?? []).map(normalizeToolName));
	return [...new Set(requested.map(normalizeToolName))]
		.filter((name) => SUPPORTED_SUBAGENT_TOOLS.has(name))
		.filter((name) => !disallowed.has(name));
}

function createSubagentTools(
	cwd: string,
	definition: SubagentDefinition,
	options: AgentToolOptions | undefined,
): AgentTool[] {
	const toolNames = resolveSubagentToolNames(definition);
	const tools: AgentTool[] = [];
	for (const name of toolNames) {
		switch (name) {
			case "read":
				tools.push(createReadTool(cwd));
				break;
			case "grep":
				tools.push(createGrepTool(cwd));
				break;
			case "find":
				tools.push(createFindTool(cwd));
				break;
			case "ls":
				tools.push(createLsTool(cwd));
				break;
			case "lsp":
				tools.push(wrapToolDefinition(createLspToolDefinition(cwd)));
				break;
			case "mcp": {
				const getConfiguredServers = options?.getMcpServers ?? (() => ({}));
				tools.push(
					wrapToolDefinition(
						createMcpToolDefinition(() => resolveSubagentMcpServers(definition, getConfiguredServers())),
					),
				);
				break;
			}
			case "todo":
				tools.push(wrapToolDefinition(createTodoToolDefinition(cwd)));
				break;
		}
	}
	return tools;
}

function resolveModelOverride(
	requestedModel: string | undefined,
	definition: SubagentDefinition,
	inheritedModel: Model<Api>,
	availableModels: Model<Api>[],
): Model<Api> {
	const modelRef =
		requestedModel ?? (definition.model && definition.model !== "inherit" ? definition.model : undefined);
	if (!modelRef) return inheritedModel;
	const resolved = findExactModelReferenceMatch(modelRef, availableModels);
	if (!resolved) {
		throw new Error(`Unknown subagent model override: ${modelRef}`);
	}
	return resolved;
}

function buildSubagentSystemPrompt(cwd: string, definition: SubagentDefinition, tools: AgentTool[]): string {
	return [
		`You are the '${definition.name}' Neo Code subagent.`,
		definition.prompt,
		"",
		"Subagent operating rules:",
		"- Work independently on the delegated task and return only the findings needed by the parent agent.",
		"- Do not spawn another subagent.",
		"- Do not modify project files. Use read/search/navigation tools unless explicitly configured otherwise.",
		"- Include file paths and line numbers when they support your findings.",
		`- Current working directory: ${cwd}`,
		`- Available subagent tools: ${tools.map((tool) => tool.name).join(", ") || "none"}.`,
	].join("\n");
}

function buildToolDescription(cwd: string): string {
	const agents = getSubagentDefinitions(cwd);
	return [
		"Run a focused subagent for independent codebase investigation or planning.",
		"Subagents are isolated from the parent context except for the prompt you provide, and return a concise final report.",
		"Available subagent_type values:",
		formatSubagentList(agents),
	].join("\n");
}

export function createAgentToolDefinition(
	cwd: string,
	options?: AgentToolOptions,
): ToolDefinition<typeof agentSchema, AgentToolDetails> {
	return {
		name: "agent",
		label: "Agent",
		description: buildToolDescription(cwd),
		promptSnippet:
			"Delegate independent codebase research, planning, or verification to a focused subagent using optional subagent_type.",
		promptGuidelines: [
			"Use agent for independent research/planning/verification tasks that can be summarized back to you without keeping every intermediate tool result in your context.",
			"Set subagent_type when a specialized built-in or custom subagent matches the work; omit it for general-purpose.",
			"Do not use agent for tiny lookups where a direct read, grep, find, ls, or lsp call would be simpler.",
		],
		parameters: agentSchema,
		executionMode: "parallel",
		getActivityDescription: (args) => args.description,
		getToolUseSummary: (args) => `Subagent${args.subagent_type ? ` ${args.subagent_type}` : ""}: ${args.description}`,
		renderCall(args, theme, context) {
			const name = args.subagent_type || "agent";
			const desc = args.description || args.prompt?.slice(0, 80) || "working";
			const label =
				context.isPartial && context.executionStarted
					? `${theme.fg("accent", `@${name}`)} ${theme.fg("dim", `${desc}…`)}`
					: `${theme.fg("accent", `@${name}`)} ${desc}`;
			const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			text.setText(label);
			return text;
		},
		renderToolResultSummary: (result) =>
			`${result.details.subagentType} subagent returned ${result.details.messageCount} messages`,
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const inheritedModel = ctx.model;
			if (!inheritedModel) throw new Error("No active model is available for subagent delegation");

			const definition = findSubagentDefinition(cwd, params.subagent_type);
			const tools = createSubagentTools(cwd, definition, options);
			const model = resolveModelOverride(params.model, definition, inheritedModel, ctx.modelRegistry.getAvailable());
			onUpdate?.({
				content: [{ type: "text", text: `Starting ${definition.name} subagent with ${tools.length} tools...` }],
				details: {
					subagentType: definition.name,
					messageCount: 0,
					toolCalls: 0,
					tools: tools.map((tool) => tool.name),
					model: `${model.provider}/${model.id}`,
				},
			});

			let assistantTurns = 0;
			const maxTurns = definition.maxTurns;
			const subagent = new Agent({
				initialState: {
					model,
					thinkingLevel: "off",
					systemPrompt: buildSubagentSystemPrompt(cwd, definition, tools),
					tools,
				},
				streamFn: async (activeModel, context, streamOptions) => {
					const auth = await ctx.modelRegistry.getApiKeyAndHeaders(activeModel);
					if (!auth.ok) throw new Error(auth.error);
					return streamSimple(activeModel, context, {
						...streamOptions,
						apiKey: auth.apiKey,
						headers: auth.headers,
					});
				},
				toolExecution: "parallel",
				shouldStopAfterTurn: maxTurns
					? (turn) => {
							if (turn.message.role === "assistant") assistantTurns += 1;
							return assistantTurns >= maxTurns;
						}
					: undefined,
			});

			let toolCalls = 0;
			const unsubscribe = subagent.subscribe((event) => {
				if (event.type === "tool_execution_start") {
					toolCalls += 1;
					onUpdate?.({
						content: [{ type: "text", text: `${definition.name} using ${event.toolName}...` }],
						details: {
							subagentType: definition.name,
							messageCount: subagent.state.messages.length,
							toolCalls,
							tools: tools.map((tool) => tool.name),
							model: `${model.provider}/${model.id}`,
						},
					});
				}
			});

			if (signal?.aborted) throw new Error("Subagent aborted");
			const abort = () => subagent.abort();
			signal?.addEventListener("abort", abort, { once: true });
			try {
				const prompt = definition.maxTurns
					? `${params.prompt}\n\nLimit yourself to at most ${definition.maxTurns} agent turns.`
					: params.prompt;
				await subagent.prompt(prompt);
			} finally {
				signal?.removeEventListener("abort", abort);
				unsubscribe();
			}

			const messages = subagent.state.messages;
			return {
				content: [{ type: "text", text: extractAssistantText(messages) }],
				details: {
					subagentType: definition.name,
					messageCount: messages.length,
					toolCalls,
					tools: tools.map((tool) => tool.name),
					model: `${model.provider}/${model.id}`,
				},
			};
		},
	};
}
