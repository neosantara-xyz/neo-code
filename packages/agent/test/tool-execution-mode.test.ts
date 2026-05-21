import { type AssistantMessage, createAssistantMessageEventStream, type Model, Type } from "@neosantara/ai";
import { describe, expect, it } from "vitest";

import { runAgentLoop } from "../src/agent-loop.js";
import type { AgentEvent, AgentTool, StreamFn } from "../src/types.js";

const EMPTY_USAGE = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

const model = {
	id: "test-model",
	name: "test-model",
	api: "openai-responses",
	provider: "neosantara",
	baseUrl: "",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128_000,
	maxTokens: 4096,
} as Model<any>;

function createTool(name: string, events: string[], executionMode?: "parallel" | "sequential"): AgentTool<any> {
	return {
		name,
		label: name,
		description: `${name} test tool`,
		parameters: Type.Object({}),
		executionMode,
		execute: async () => {
			events.push(`execute:${name}:start`);
			await new Promise((resolve) => setTimeout(resolve, 20));
			events.push(`execute:${name}:end`);
			return {
				content: [{ type: "text", text: `done ${name}` }],
				details: {},
			};
		},
	};
}

describe("tool execution modes", () => {
	it("runs consecutive parallel-safe tools together but isolates sequential tools", async () => {
		const executionEvents: string[] = [];
		const agentEvents: string[] = [];
		const assistant: AssistantMessage = {
			role: "assistant",
			content: [
				{ type: "toolCall", id: "safe-1", name: "safeA", arguments: {} },
				{ type: "toolCall", id: "safe-2", name: "safeB", arguments: {} },
				{ type: "toolCall", id: "write-1", name: "write", arguments: {} },
			],
			api: "openai-responses",
			provider: "neosantara",
			model: "test-model",
			usage: EMPTY_USAGE,
			stopReason: "toolUse",
			timestamp: Date.now(),
		};
		const streamFn: StreamFn = () => {
			const stream = createAssistantMessageEventStream();
			queueMicrotask(() => {
				stream.push({ type: "done", reason: "toolUse", message: assistant });
			});
			return stream;
		};

		await runAgentLoop(
			[{ role: "user", content: [{ type: "text", text: "go" }], timestamp: Date.now() }],
			{
				systemPrompt: "",
				messages: [],
				tools: [
					createTool("safeA", executionEvents),
					createTool("safeB", executionEvents),
					createTool("write", executionEvents, "sequential"),
				],
			},
			{
				model,
				toolExecution: "parallel",
				convertToLlm: (messages) => messages as any,
				shouldStopAfterTurn: () => true,
			},
			(event: AgentEvent) => {
				if (event.type === "tool_execution_start" || event.type === "tool_execution_end") {
					agentEvents.push(`${event.type}:${event.toolName}`);
				}
			},
			undefined,
			streamFn,
		);

		expect(agentEvents.slice(0, 2)).toEqual(["tool_execution_start:safeA", "tool_execution_start:safeB"]);
		expect(executionEvents.indexOf("execute:safeB:start")).toBeLessThan(executionEvents.indexOf("execute:safeA:end"));
		expect(executionEvents.indexOf("execute:write:start")).toBeGreaterThan(
			executionEvents.indexOf("execute:safeA:end"),
		);
		expect(executionEvents.indexOf("execute:write:start")).toBeGreaterThan(
			executionEvents.indexOf("execute:safeB:end"),
		);
	});
});
