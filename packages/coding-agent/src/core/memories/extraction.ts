/**
 * Memory extraction — post-session summarization.
 *
 * After a session ends (or is compacted), this module extracts structured
 * learnings from the conversation and persists them as memory entries.
 *
 * Extraction is intentionally lightweight — it formats the conversation
 * into a prompt and asks the model to identify reusable learnings. This
 * avoids complex heuristics and leverages the model's understanding.
 */

import type { MemoryExtractionResult } from "./types.js";

const MIN_MESSAGES_FOR_EXTRACTION = 4;
const MAX_CONVERSATION_CHARS = 50_000;

/**
 * Build the extraction prompt from conversation messages.
 *
 * The prompt asks the model to identify project-specific learnings that
 * would be useful in future sessions working on the same codebase.
 */
export function buildExtractionPrompt(messages: Array<{ role: string; content: string }>, workspace: string): string {
	// Truncate conversation if too long
	let conversationText = "";
	for (const msg of messages) {
		const line = `[${msg.role}]: ${msg.content}\n\n`;
		if (conversationText.length + line.length > MAX_CONVERSATION_CHARS) break;
		conversationText += line;
	}

	return `You are a memory extraction assistant. Analyze the following coding session conversation and extract reusable learnings that would help in future sessions working on the same project.

## Workspace
${workspace}

## Conversation
${conversationText}

## Instructions
Extract 0-5 structured memories from this session. Each memory should capture something that would be useful to know in future sessions, such as:
- Project architecture decisions or patterns
- Important file locations or module responsibilities  
- User preferences for code style or conventions
- Common gotchas or workarounds specific to this project
- Build/test/deploy commands and their quirks
- Dependencies or tooling specifics

Respond in this exact JSON format:
\`\`\`json
{
  "memories": [
    {
      "title": "Short descriptive title (max 80 chars)",
      "content": "Detailed memory content. Be specific and actionable. Include file paths, command names, or code patterns where relevant.",
      "tags": ["tag1", "tag2"]
    }
  ],
  "skipped": false,
  "skipReason": null
}
\`\`\`

If the conversation is too short, trivial, or contains no project-specific learnings worth persisting, respond with:
\`\`\`json
{
  "memories": [],
  "skipped": true,
  "skipReason": "reason why no memories were extracted"
}
\`\`\`

Respond ONLY with the JSON block, no other text.`;
}

/**
 * Parse the model's extraction response into structured result.
 */
export function parseExtractionResponse(response: string): MemoryExtractionResult {
	try {
		// Extract JSON from markdown code block if present
		const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
		const jsonStr = jsonMatch ? jsonMatch[1]! : response.trim();
		const parsed = JSON.parse(jsonStr) as MemoryExtractionResult;

		// Validate structure
		if (!parsed || typeof parsed !== "object") {
			return { memories: [], skipped: true, skipReason: "Invalid extraction response format" };
		}

		if (parsed.skipped) {
			return { memories: [], skipped: true, skipReason: parsed.skipReason ?? "Model chose to skip" };
		}

		if (!Array.isArray(parsed.memories)) {
			return { memories: [], skipped: true, skipReason: "Invalid memories array" };
		}

		// Filter valid memories
		const validMemories = parsed.memories
			.filter(
				(m) =>
					m &&
					typeof m.title === "string" &&
					m.title.length > 0 &&
					typeof m.content === "string" &&
					m.content.length > 0,
			)
			.map((m) => ({
				title: m.title.slice(0, 120),
				content: m.content.slice(0, 2000),
				tags: Array.isArray(m.tags) ? m.tags.filter((t): t is string => typeof t === "string").slice(0, 10) : [],
			}));

		return { memories: validMemories, skipped: false };
	} catch {
		return { memories: [], skipped: true, skipReason: "Failed to parse extraction response" };
	}
}

/**
 * Determine if a session is worth extracting memories from.
 */
export function shouldExtractMemories(messageCount: number, hasToolCalls: boolean): boolean {
	// Need at least a few exchanges to have meaningful content
	if (messageCount < MIN_MESSAGES_FOR_EXTRACTION) return false;
	// Sessions with tool calls are more likely to contain project-specific learnings
	return hasToolCalls;
}

// ─── Secret Redaction ────────────────────────────────────────────────────────

const SECRET_PATTERNS = [
	// API keys and tokens (generic patterns)
	/\b(sk|pk|api|key|token|secret|password|auth)[-_]?[A-Za-z0-9]{20,}\b/gi,
	// Bearer tokens
	/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
	// AWS keys
	/AKIA[0-9A-Z]{16}/g,
	// GitHub tokens
	/gh[ps]_[A-Za-z0-9_]{36,}/g,
	/github_pat_[A-Za-z0-9_]{22,}/g,
	// npm tokens
	/npm_[A-Za-z0-9]{36}/g,
	// Generic hex secrets (32+ chars)
	/\b[0-9a-f]{32,}\b/gi,
	// JWT tokens
	/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
	// Private keys
	/-----BEGIN[A-Z ]+PRIVATE KEY-----[\s\S]*?-----END[A-Z ]+PRIVATE KEY-----/g,
];

/**
 * Redact potential secrets from memory content before storing.
 * Replaces matched patterns with [REDACTED].
 */
export function redactSecrets(text: string): string {
	let result = text;
	for (const pattern of SECRET_PATTERNS) {
		result = result.replace(pattern, "[REDACTED]");
	}
	return result;
}
