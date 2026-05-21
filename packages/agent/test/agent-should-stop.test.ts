import { type AssistantMessage, createAssistantMessageEventStream, type Model, Type } from "@neosantara/ai";
import { describe, expect, it } from "vitest";
import { Agent } from "../src/agent.js";
import type { AgentTool, StreamFn } from "../src/types.js";

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
} satisfies Model<"openai-responses">;

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

function createStreamFn(messages: AssistantMessage[], calls: { count: number }): StreamFn {
	let index = 0;
	return () => {
		calls.count += 1;
		const message = messages[index++];
		if (!message) throw new Error("No more assistant messages");
		const stream = createAssistantMessageEventStream();
		queueMicrotask(() => {
			stream.push({ type: "done", reason: message.stopReason, message });
		});
		return stream;
	};
}

function createTool(): AgentTool {
	return {
		name: "lookup",
		label: "Lookup",
		description: "Lookup test tool",
		parameters: Type.Object({}),
		execute: async () => ({ content: [{ type: "text", text: "lookup result" }], details: {} }),
	};
}

describe("Agent shouldStopAfterTurn", () => {
	it("stops after a completed tool turn before requesting another model response", async () => {
		const calls = { count: 0 };
		const agent = new Agent({
			initialState: {
				model,
				systemPrompt: "",
				tools: [createTool()],
			},
			streamFn: createStreamFn(
				[
					createAssistant([{ type: "toolCall", id: "lookup-1", name: "lookup", arguments: {} }], "toolUse"),
					createAssistant([{ type: "text", text: "should not be requested" }], "stop"),
				],
				calls,
			),
			shouldStopAfterTurn: () => true,
		});

		await agent.prompt("go");

		expect(calls.count).toBe(1);
		expect(agent.state.messages.some((message) => message.role === "toolResult")).toBe(true);
	});
});
