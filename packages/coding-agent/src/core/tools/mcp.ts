import type { AgentToolResult } from "@neosantara/agent-core";
import { type Static, Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { type McpServersSettings, parseMcpToolsList, withMcpServer } from "../mcp.js";

const mcpSchema = Type.Object({
	action: Type.Union([Type.Literal("list"), Type.Literal("call")]),
	server: Type.Optional(
		Type.String({ description: "Configured MCP server name. Omit for list to query all servers." }),
	),
	tool: Type.Optional(Type.String({ description: "MCP tool name when action is call" })),
	arguments: Type.Optional(
		Type.Record(Type.String(), Type.Unknown(), { description: "Arguments to pass to the MCP tool" }),
	),
});

export type McpToolInput = Static<typeof mcpSchema>;

export interface McpToolDetails {
	action: McpToolInput["action"];
	serverCount: number;
	toolCount?: number;
	server?: string;
	tool?: string;
}

function extractText(payload: unknown): string {
	if (typeof payload === "string") return payload;
	if (payload && typeof payload === "object" && "content" in payload && Array.isArray(payload.content)) {
		const parts = payload.content
			.map((item) => {
				if (item && typeof item === "object" && "text" in item && typeof item.text === "string") return item.text;
				return JSON.stringify(item);
			})
			.filter(Boolean);
		if (parts.length > 0) return parts.join("\n");
	}
	return JSON.stringify(payload, null, 2);
}

export function createMcpToolDefinition(
	getServers: () => McpServersSettings,
): ToolDefinition<typeof mcpSchema, McpToolDetails> {
	return {
		name: "mcp",
		label: "MCP",
		description:
			"List configured Model Context Protocol tools or call a specific MCP tool. MCP servers are configured in settings.mcpServers.",
		promptSnippet: "Use configured Model Context Protocol servers and tools.",
		promptGuidelines: [
			"Use mcp only when a configured MCP server provides information or actions that built-in tools cannot provide. List tools before calling an unfamiliar server tool.",
		],
		parameters: mcpSchema,
		executionMode: "sequential",
		getActivityDescription: (args) =>
			args.action === "call" ? `calling MCP ${args.server}/${args.tool}` : "listing MCP tools",
		getToolUseSummary: (args) => (args.action === "call" ? `MCP call ${args.server}/${args.tool}` : "List MCP tools"),
		renderToolResultSummary: (result) =>
			result.details.action === "list"
				? `MCP ${result.details.serverCount} servers, ${result.details.toolCount ?? 0} tools`
				: `MCP ${result.details.server}/${result.details.tool}`,
		async execute(_toolCallId, params, signal): Promise<AgentToolResult<McpToolDetails>> {
			const servers = getServers();
			const entries = Object.entries(servers);
			if (entries.length === 0) {
				return {
					content: [
						{
							type: "text",
							text: "No MCP servers configured. Add settings.mcpServers to global or project settings.",
						},
					],
					details: { action: params.action, serverCount: 0, toolCount: 0 },
				};
			}

			if (params.action === "list") {
				const selected = params.server ? entries.filter(([name]) => name === params.server) : entries;
				if (selected.length === 0) throw new Error(`Unknown MCP server: ${params.server}`);
				const allTools = [];
				for (const [serverName, config] of selected) {
					const payload = await withMcpServer(serverName, config, (request) => request("tools/list"), { signal });
					allTools.push(...parseMcpToolsList(serverName, payload));
				}
				const text = allTools.length
					? allTools
							.map((tool) => `${tool.server}/${tool.name}${tool.description ? ` — ${tool.description}` : ""}`)
							.join("\n")
					: "No MCP tools reported by configured server(s).";
				return {
					content: [{ type: "text", text }],
					details: { action: "list", serverCount: selected.length, toolCount: allTools.length },
				};
			}

			if (!params.server) throw new Error("server is required for MCP call");
			if (!params.tool) throw new Error("tool is required for MCP call");
			const config = servers[params.server];
			if (!config) throw new Error(`Unknown MCP server: ${params.server}`);
			const payload = await withMcpServer(
				params.server,
				config,
				(request) => request("tools/call", { name: params.tool, arguments: params.arguments ?? {} }),
				{ signal },
			);
			return {
				content: [{ type: "text", text: extractText(payload) }],
				details: { action: "call", serverCount: entries.length, server: params.server, tool: params.tool },
			};
		},
	};
}
