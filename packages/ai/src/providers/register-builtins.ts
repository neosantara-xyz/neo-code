import { clearApiProviders, registerApiProvider } from "../api-registry.js";
import { streamOpenAICompletions, streamSimpleOpenAICompletions } from "./openai-completions.js";
import { streamOpenAIResponses, streamSimpleOpenAIResponses } from "./openai-responses.js";

export { streamOpenAICompletions, streamSimpleOpenAICompletions } from "./openai-completions.js";
export { streamOpenAIResponses, streamSimpleOpenAIResponses } from "./openai-responses.js";

export function registerBuiltInApiProviders(): void {
	registerApiProvider({
		api: "openai-completions",
		stream: streamOpenAICompletions,
		streamSimple: streamSimpleOpenAICompletions,
	});

	registerApiProvider({
		api: "openai-responses",
		stream: streamOpenAIResponses,
		streamSimple: streamSimpleOpenAIResponses,
	});
}

export function resetApiProviders(): void {
	clearApiProviders();
	registerBuiltInApiProviders();
}

registerBuiltInApiProviders();
