/**
 * Memory consolidation — periodic merging and deduplication of memories.
 *
 * When enough new memories have accumulated since the last consolidation,
 * this module asks the model to merge duplicates, group related items,
 * remove outdated information, and produce a condensed set of entries
 * plus a human-readable MEMORY.md summary.
 */

import type { ConsolidationResult, ConsolidationState, MemoryEntry } from "./types.js";

const MIN_NEW_MEMORIES_FOR_CONSOLIDATION = 3;
const MAX_CONSOLIDATED_ENTRIES = 30;

/**
 * Determine whether consolidation should run based on new memory count.
 */
export function shouldConsolidate(entries: MemoryEntry[], state: ConsolidationState): boolean {
	return entries.length - state.memoryCountAtLastConsolidation >= MIN_NEW_MEMORIES_FOR_CONSOLIDATION;
}

/**
 * Build the consolidation prompt from all current memory entries.
 */
export function buildConsolidationPrompt(entries: MemoryEntry[]): string {
	let memoriesText = "";
	for (const entry of entries) {
		memoriesText += `### ${entry.title}\n`;
		memoriesText += `Tags: ${entry.tags.join(", ") || "none"}\n`;
		memoriesText += `${entry.content}\n\n`;
	}

	return `You are a memory consolidation assistant. You have been given a set of memories that were extracted from past coding sessions. Your job is to consolidate them by merging duplicates, grouping related items, and removing outdated or contradictory information.

## Current Memories (${entries.length} total)

${memoriesText}

## Instructions

Consolidate the memories above into a clean, deduplicated set. You should:
- Merge memories that cover the same topic or overlap significantly
- Group related memories by theme (e.g., project architecture, build tooling, user preferences)
- Remove outdated or contradictory information (keep the most recent/accurate version)
- Preserve all unique, actionable learnings
- Produce at most ${MAX_CONSOLIDATED_ENTRIES} consolidated entries

Also produce a human-readable MEMORY.md summary that organizes the key learnings by category.

Respond in this exact JSON format:
\`\`\`json
{
  "entries": [
    {
      "title": "Short descriptive title (max 80 chars)",
      "content": "Detailed consolidated content. Be specific and actionable.",
      "tags": ["tag1", "tag2"]
    }
  ],
  "summary": "# Project Memory\\n\\n## Category\\n- Key learning 1\\n- Key learning 2\\n..."
}
\`\`\`

Respond ONLY with the JSON block, no other text.`;
}

/**
 * Parse the model's consolidation response into structured result.
 */
export function parseConsolidationResponse(response: string): ConsolidationResult {
	try {
		// Extract JSON from markdown code block if present
		const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
		const jsonStr = jsonMatch ? jsonMatch[1]! : response.trim();
		const parsed = JSON.parse(jsonStr) as { entries?: unknown[]; summary?: string };

		// Validate structure
		if (!parsed || typeof parsed !== "object") {
			return { entries: [], memorySummary: "", skipped: true, skipReason: "Invalid consolidation response format" };
		}

		if (!Array.isArray(parsed.entries)) {
			return { entries: [], memorySummary: "", skipped: true, skipReason: "Invalid entries array" };
		}

		// Filter valid entries
		const validEntries = parsed.entries
			.filter(
				(e): e is { title: string; content: string; tags: string[] } =>
					e !== null &&
					typeof e === "object" &&
					"title" in e &&
					typeof (e as { title: unknown }).title === "string" &&
					(e as { title: string }).title.length > 0 &&
					"content" in e &&
					typeof (e as { content: unknown }).content === "string" &&
					(e as { content: string }).content.length > 0,
			)
			.slice(0, MAX_CONSOLIDATED_ENTRIES)
			.map((e) => ({
				title: e.title.slice(0, 120),
				content: e.content.slice(0, 2000),
				tags: Array.isArray(e.tags) ? e.tags.filter((t): t is string => typeof t === "string").slice(0, 10) : [],
			}));

		const memorySummary = typeof parsed.summary === "string" ? parsed.summary : "";

		return { entries: validEntries, memorySummary, skipped: false };
	} catch {
		return { entries: [], memorySummary: "", skipped: true, skipReason: "Failed to parse consolidation response" };
	}
}
