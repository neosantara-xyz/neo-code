import { describe, expect, it } from "vitest";
import type { Model, OpenAIResponsesOptions } from "../src/index.js";
import { calculateCost, getModel, streamSimple } from "../src/index.js";
import { streamOpenAIResponses } from "../src/providers/openai-responses.js";
import type { Context } from "../src/types.js";

const baseModel = getModel("neosantara", "grok-4.1-fast-non-reasoning") as Model<"openai-responses">;

const minimalContext: Context = {
	systemPrompt: "Answer briefly.",
	messages: [{ role: "user", content: "Halo", timestamp: 0 }],
};

async function capturePayload<TModel extends Model<"openai-completions"> | Model<"openai-responses">>(
	model: TModel,
	options: Parameters<typeof streamSimple>[2] = {},
	context: Context = minimalContext,
): Promise<Record<string, unknown>> {
	let captured: unknown;
	const stream = streamSimple(model, context, {
		apiKey: "test-key",
		...options,
		onPayload: async (payload) => {
			captured = payload;
			throw new Error("stop after payload capture");
		},
	});
	await stream.result();
	return captured as Record<string, unknown>;
}

describe("openai-completions transport (Neosantara compat)", () => {
	it("declares max_completion_tokens by default and not max_tokens", async () => {
		const completionsModel: Model<"openai-completions"> = {
			...baseModel,
			id: "compat-default",
			api: "openai-completions",
		};
		const payload = await capturePayload(completionsModel, { maxTokens: 256 });
		expect(payload.max_completion_tokens).toBe(256);
		expect(payload.max_tokens).toBeUndefined();
	});

	it("uses max_tokens when compat overrides the field", async () => {
		const completionsModel: Model<"openai-completions"> = {
			...baseModel,
			id: "compat-legacy-max-tokens",
			api: "openai-completions",
			compat: { maxTokensField: "max_tokens" },
		};
		const payload = await capturePayload(completionsModel, { maxTokens: 128 });
		expect(payload.max_tokens).toBe(128);
		expect(payload.max_completion_tokens).toBeUndefined();
	});

	it("requests usage events in the stream by default", async () => {
		const completionsModel: Model<"openai-completions"> = {
			...baseModel,
			id: "compat-usage-default",
			api: "openai-completions",
		};
		const payload = await capturePayload(completionsModel, {});
		expect(payload.stream_options).toEqual({ include_usage: true });
	});

	it("omits stream usage events when the model opts out", async () => {
		const completionsModel: Model<"openai-completions"> = {
			...baseModel,
			id: "compat-no-stream-usage",
			api: "openai-completions",
			compat: { supportsUsageInStreaming: false },
		};
		const payload = await capturePayload(completionsModel, {});
		expect(payload.stream_options).toBeUndefined();
	});
});

describe("openai-responses transport (Neosantara compat)", () => {
	it("does not advertise gpt-5.5 priority pricing as a special case", async () => {
		// Regression: the priority cost multiplier used to hard-code 2.5x for
		// gpt-5.5. After the cleanup, the multiplier comes from the model's
		// compat config, defaulting to 2x for any model. Use the full transport
		// (not streamSimple) so serviceTier reaches the payload.
		let payload: Record<string, unknown> | undefined;
		const stream = streamOpenAIResponses(baseModel, minimalContext, {
			apiKey: "test-key",
			serviceTier: "priority",
			onPayload: async (next) => {
				payload = next as Record<string, unknown>;
				throw new Error("stop after payload capture");
			},
		} satisfies OpenAIResponsesOptions);
		await stream.result();
		expect(payload?.service_tier).toBe("priority");
	});

	it("defaults to short cache retention and never sends 24h on default models", async () => {
		const payload = await capturePayload(baseModel, { sessionId: "session-xyz" });
		expect(payload.prompt_cache_retention).toBeUndefined();
	});
});

describe("calculateCost", () => {
	it("returns a fresh cost object instead of mutating input", () => {
		const usage = {
			input: 1_000_000,
			output: 500_000,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 1_500_000,
			cost: { input: 999, output: 999, cacheRead: 999, cacheWrite: 999, total: 9999 },
		};
		const before = { ...usage.cost };
		const next = calculateCost(baseModel, usage);
		expect(usage.cost).toEqual(before);
		expect(next).not.toBe(usage.cost);
		expect(next.input).toBeCloseTo(baseModel.cost.input);
		expect(next.output).toBeCloseTo(baseModel.cost.output * 0.5);
		expect(next.total).toBeCloseTo(next.input + next.output + next.cacheRead + next.cacheWrite);
	});
});
