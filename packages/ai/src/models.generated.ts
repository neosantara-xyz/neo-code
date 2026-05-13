// Static Neosantara model registry for the OpenAI-SDK-only build.

import type { Api, Model } from "./types.js";

const NEOSANTARA_BASE_URL = "https://api.neosantara.xyz/v1";

function neosantaraModel(
	id: string,
	name: string,
	options: Partial<Model<"openai-responses">> = {},
): Model<"openai-responses"> {
	return {
		id,
		name,
		api: "openai-responses",
		provider: "neosantara",
		baseUrl: NEOSANTARA_BASE_URL,
		reasoning: options.reasoning ?? false,
		input: options.input ?? ["text", "image"],
		cost: options.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: options.contextWindow ?? 131072,
		maxTokens: options.maxTokens ?? 32000,
		compat: {
			sendSessionIdHeader: false,
			supportsLongCacheRetention: false,
			...options.compat,
		},
	};
}

export const MODELS = {
	neosantara: {
		"grok-4.1-fast-non-reasoning": neosantaraModel(
			"grok-4.1-fast-non-reasoning",
			"Grok 4.1 Fast Non Reasoning",
			{ maxTokens: 32000 },
		),
		"claude-4.5-sonnet": neosantaraModel("claude-4.5-sonnet", "Claude 4.5 Sonnet", {
			reasoning: true,
			maxTokens: 64000,
		}),
		"gemini-3-flash": neosantaraModel("gemini-3-flash", "Gemini 3 Flash", { maxTokens: 32000 }),
		"qwen3-32b": neosantaraModel("qwen3-32b", "Qwen3 32B", { reasoning: true, maxTokens: 32000 }),
		"deepseek-r1": neosantaraModel("deepseek-r1", "DeepSeek R1", { reasoning: true, maxTokens: 32000 }),
		"nusantara-base": neosantaraModel("nusantara-base", "Nusantara Base", {
			input: ["text"],
			maxTokens: 16000,
		}),
	},
} as const satisfies Record<string, Record<string, Model<Api>>>;
