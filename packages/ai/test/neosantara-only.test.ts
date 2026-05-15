import { describe, expect, it } from "vitest";
import { findEnvKeys, getEnvApiKey } from "../src/env-api-keys.js";
import { getModel, getModels, getProviders } from "../src/models.js";
import { streamSimple } from "../src/stream.js";
import type { Context } from "../src/types.js";

const context: Context = {
	systemPrompt: "You are a concise coding assistant.",
	messages: [{ role: "user", content: "Say hi", timestamp: 0 }],
	tools: [],
};

async function capturePayload(
	options: Parameters<typeof streamSimple>[2],
	model = getModel("neosantara", "grok-4.1-fast-reasoning"),
	nextContext = context,
) {
	let payload: unknown;
	const stream = streamSimple(model, nextContext, {
		apiKey: "test-key",
		...options,
		onPayload: async (nextPayload) => {
			payload = nextPayload;
			throw new Error("stop after payload capture");
		},
	});
	await stream.result();
	return payload as { reasoning?: { effort?: string; summary?: string }; include?: string[] };
}

describe("Neosantara model registry", () => {
	it("exposes only Neosantara as a built-in provider", () => {
		expect(getProviders()).toEqual(["neosantara"]);
	});

	it("has the default Neosantara model", () => {
		const model = getModel("neosantara", "grok-4.1-fast-non-reasoning");
		expect(model?.api).toBe("openai-responses");
		expect(model?.baseUrl).toBe("https://api.neosantara.xyz/v1");
		expect(model?.costCurrency).toBe("IDR");
	});

	it("includes tool-capable Neosantara chat models", () => {
		expect(getModel("neosantara", "garda-core")).toBeDefined();
		expect(getModel("neosantara", "claude-sonnet-4-6")).toBeDefined();
	});

	it("omits text models that do not advertise function calling", () => {
		expect(getModel("neosantara", "archipelago-core-70b")).toBeUndefined();
		expect(getModel("neosantara", "deepseek-r1")).toBeUndefined();
	});

	it("keeps all built-in models under the Neosantara provider", () => {
		expect(getModels().every((model) => model.provider === "neosantara")).toBe(true);
	});

	it("does not report env keys when Neosantara credentials are absent", () => {
		const previous = process.env.NEOSANTARA_API_KEY;
		delete process.env.NEOSANTARA_API_KEY;
		try {
			expect(findEnvKeys("neosantara")).toBeUndefined();
		} finally {
			if (previous === undefined) delete process.env.NEOSANTARA_API_KEY;
			else process.env.NEOSANTARA_API_KEY = previous;
		}
	});

	it("uses NEOSANTARA_API_KEY as the only built-in API key env var", () => {
		const previous = process.env.NEOSANTARA_API_KEY;
		process.env.NEOSANTARA_API_KEY = "test-neosantara-key";
		try {
			expect(findEnvKeys("neosantara")).toEqual(["NEOSANTARA_API_KEY"]);
			expect(getEnvApiKey("neosantara")).toBe("test-neosantara-key");
		} finally {
			if (previous === undefined) delete process.env.NEOSANTARA_API_KEY;
			else process.env.NEOSANTARA_API_KEY = previous;
		}
	});

	it("does not send reasoning params when thinking is off", async () => {
		const payload = await capturePayload({});
		expect(payload.reasoning).toBeUndefined();
		expect(payload.include).toBeUndefined();
	});

	it("sends Neosantara reasoning effort only when requested", async () => {
		const payload = await capturePayload({ reasoning: "high" });
		expect(payload.reasoning).toEqual({ effort: "high", summary: "auto" });
		expect(payload.include).toEqual(["reasoning.encrypted_content"]);
	});

	it("does not send reasoning with DeepSeek Responses tool requests", async () => {
		const payload = await capturePayload({ reasoning: "medium" }, getModel("neosantara", "deepseek-v4-flash"), {
			...context,
			tools: [
				{
					name: "list_files",
					description: "List files",
					parameters: {
						type: "object",
						properties: { path: { type: "string" } },
						required: ["path"],
						additionalProperties: false,
					},
				},
			],
		});
		expect(payload.reasoning).toBeUndefined();
		expect(payload.include).toBeUndefined();
		expect(payload.tools).toHaveLength(1);
	});
});
