import type { AssistantMessage } from "../types.js";

/**
 * Utilities for detecting context/input overflow errors from OpenAI-compatible endpoints.
 *
 * The exact error text can vary by upstream model, gateway, or compatibility layer.
 * Keep these regexes generic so this package stays Neosantara-first without shipping
 * provider-specific SDK logic.
 */

const OVERFLOW_PATTERNS = [
	/prompt is too long/i,
	/request_too_large/i,
	/input is too long for requested model/i,
	/exceeds the context window/i,
	/input token count.*exceeds the maximum/i,
	/maximum prompt length is \d+/i,
	/reduce the length of the messages/i,
	/maximum context length is \d+ tokens/i,
	/input \(\d+ tokens\) is longer than the model'?s context length \(\d+ tokens\)/i,
	/exceeds the limit of \d+/i,
	/exceeds the available context size/i,
	/greater than the context length/i,
	/context window exceeds limit/i,
	/exceeded model token limit/i,
	/too large for model with \d+ maximum context length/i,
	/model_context_window_exceeded/i,
	/prompt too long; exceeded (?:max )?context length/i,
	/context[_ ]length[_ ]exceeded/i,
	/too many tokens/i,
	/token limit exceeded/i,
	/input too large \(\d+ tokens\) for model context window \(\d+ tokens\)/i,
	/^4(?:00|13)\s*(?:status code)?\s*\(no body\)/i,
] as const;

const NON_OVERFLOW_PATTERNS = [
	/^(Throttling error|Service unavailable):/i,
	/rate limit/i,
	/too many requests/i,
] as const;

export function isContextOverflow(message: AssistantMessage, contextWindow?: number): boolean {
	if (message.stopReason === "error" && message.errorMessage) {
		const isNonOverflow = NON_OVERFLOW_PATTERNS.some((pattern) => pattern.test(message.errorMessage!));
		if (!isNonOverflow && OVERFLOW_PATTERNS.some((pattern) => pattern.test(message.errorMessage!))) {
			return true;
		}
	}

	if (contextWindow && message.stopReason === "stop") {
		const inputTokens = message.usage.input + message.usage.cacheRead;
		if (inputTokens > contextWindow) return true;
	}

	if (contextWindow && message.stopReason === "length" && message.usage.output === 0) {
		const inputTokens = message.usage.input + message.usage.cacheRead;
		if (inputTokens >= contextWindow * 0.99) return true;
	}

	return false;
}

export function isContextOverflowError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error ?? "");
	if (!message) return false;
	if (NON_OVERFLOW_PATTERNS.some((pattern) => pattern.test(message))) return false;
	return OVERFLOW_PATTERNS.some((pattern) => pattern.test(message));
}

export function getContextOverflowMessage(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error ?? "");
	return message || "The request exceeded the model context window.";
}

export function getOverflowPatterns(): RegExp[] {
	return [...OVERFLOW_PATTERNS];
}
