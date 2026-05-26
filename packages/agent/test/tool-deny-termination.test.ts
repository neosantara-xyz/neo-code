import { type AssistantMessage, createAssistantMessageEventStream, type Model, Type } from "@neosantara-xyz/ai";
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

function createTool(name: string, executions: string[]): AgentTool<any> {
	return {
		name,
		label: name,
		description: `${name} test tool`,
		parameters: Type.Object({}),
		executionMode: "sequential",
		execute: async () => {
			executions.push(name);
			return {
				content: [{ type: "text", text: `done ${name}` }],
				details: {},
			};
		},
	};
}

function createAssistant(
	content: AssistantMessage["content"],
	stopReason: AssistantMessage["stopReason"],
): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "openai-responses",
		provider: "neosantara",
		model: "test-model",
		usage: EMPTY_USAGE,
		stopReason,
		timestamp: Date.now(),
	};
}

function createStreamFn(messages: AssistantMessage[]): StreamFn {
	let index = 0;
	return () => {
		const message = messages[index++];
		if (!message) throw new Error("No more assistant messages");
		const stream = createAssistantMessageEventStream();
		queueMicrotask(() => {
			stream.push({ type: "done", reason: message.stopReason, message });
		});
		return stream;
	};
}

describe("tool denial termination", () => {
	it("stops the run after a terminating permission denial", async () => {
		const executions: string[] = [];
		const starts: string[] = [];
		const streamFn = createStreamFn([
			createAssistant(
				[
					{ type: "toolCall", id: "deny-1", name: "write", arguments: {} },
					{ type: "toolCall", id: "skip-1", name: "bash", arguments: {} },
				],
				"toolUse",
			),
			createAssistant([{ type: "text", text: "should not run" }], "stop"),
		]);

		await runAgentLoop(
			[{ role: "user", content: [{ type: "text", text: "go" }], timestamp: Date.now() }],
			{
				systemPrompt: "",
				messages: [],
				tools: [createTool("write", executions), createTool("bash", executions)],
			},
			{
				model,
				toolExecution: "parallel",
				convertToLlm: (messages) => messages as any,
				beforeToolCall: async () => ({
					block: true,
					reason: "User denied permission",
					terminate: true,
				}),
			},
			(event: AgentEvent) => {
				if (event.type === "tool_execution_start") starts.push(event.toolName);
			},
			undefined,
			streamFn,
		);

		expect(starts).toEqual(["write"]);
		expect(executions).toEqual([]);
	});

	it("continues when a blocked tool result is non-terminating", async () => {
		let providerCalls = 0;
		const streamFn: StreamFn = () => {
			providerCalls++;
			const message =
				providerCalls === 1
					? createAssistant([{ type: "toolCall", id: "blocked-1", name: "write", arguments: {} }], "toolUse")
					: createAssistant([{ type: "text", text: "adjusted" }], "stop");
			const stream = createAssistantMessageEventStream();
			queueMicrotask(() => {
				stream.push({ type: "done", reason: message.stopReason, message });
			});
			return stream;
		};

		await runAgentLoop(
			[{ role: "user", content: [{ type: "text", text: "go" }], timestamp: Date.now() }],
			{
				systemPrompt: "",
				messages: [],
				tools: [createTool("write", [])],
			},
			{
				model,
				toolExecution: "parallel",
				convertToLlm: (messages) => messages as any,
				beforeToolCall: async () => ({
					block: true,
					reason: "User denied permission: use a safer path",
					terminate: false,
				}),
			},
			() => {},
			undefined,
			streamFn,
		);

		expect(providerCalls).toBe(2);
	});
});
