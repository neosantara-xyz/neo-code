/**
 * Memory injection — load relevant memories into session context.
 *
 * On session start, this module selects memories relevant to the current
 * workspace and formats them for inclusion in the system prompt.
 */

import { markMemoryUsed, searchMemories } from "./store.js";
import type { MemoryEntry, MemoryInjectionContext } from "./types.js";

const DEFAULT_MAX_MEMORIES = 10;
const DEFAULT_MAX_CHARS = 4000;

/**
 * Select and format memories for injection into the system prompt.
 *
 * Returns a formatted string ready to append to the system prompt, or
 * empty string if no relevant memories exist.
 */
export function buildMemoryInjection(context: MemoryInjectionContext): string {
	const maxMemories = context.maxMemories || DEFAULT_MAX_MEMORIES;
	const maxChars = context.maxChars || DEFAULT_MAX_CHARS;

	const candidates = searchMemories({
		workspace: context.workspace,
		limit: maxMemories * 2, // Fetch extra for char budget filtering
	});

	if (candidates.length === 0) return "";

	// Select memories that fit within the character budget
	const selected: MemoryEntry[] = [];
	let totalChars = 0;

	for (const memory of candidates) {
		const entrySize = memory.title.length + memory.content.length + 20; // overhead
		if (totalChars + entrySize > maxChars) {
			// Try to fit at least the title
			if (totalChars + memory.title.length + 50 > maxChars) break;
		}
		selected.push(memory);
		totalChars += entrySize;
		if (selected.length >= maxMemories) break;
	}

	if (selected.length === 0) return "";

	// Mark selected memories as used
	for (const memory of selected) {
		markMemoryUsed(memory.id);
	}

	// Format for system prompt
	const lines = ["# Project Memories", "", "Previously learned context about this workspace:", ""];

	for (const memory of selected) {
		lines.push(`## ${memory.title}`);
		lines.push(memory.content);
		if (memory.tags.length > 0) {
			lines.push(`_Tags: ${memory.tags.join(", ")}_`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Get a short summary of available memories for the /doctor screen.
 */
export function getMemorySummary(workspace: string): string {
	const all = searchMemories({});
	const relevant = searchMemories({ workspace });
	if (all.length === 0) return "no memories stored";
	return `${relevant.length} relevant / ${all.length} total memories`;
}
