/**
 * Memory system types.
 *
 * Memories are cross-session learnings persisted to disk and injected into
 * future sessions. They capture project-specific patterns, user preferences,
 * architecture decisions, and workspace conventions that the agent discovers
 * during normal operation.
 */

export interface MemoryEntry {
	/** Unique identifier (UUID v7 for time-ordered sorting). */
	id: string;
	/** ISO timestamp of when this memory was created. */
	createdAt: string;
	/** The workspace root this memory was extracted from (can match multiple). */
	workspace: string;
	/** Short human-readable title. */
	title: string;
	/** The full memory content — structured learning. */
	content: string;
	/** Tags for categorization and search. */
	tags: string[];
	/** Number of times this memory was injected into a session. */
	usageCount: number;
	/** ISO timestamp of last injection. */
	lastUsedAt: string | null;
	/** Source session ID. */
	sourceSessionId: string | null;
}

export interface MemoryExtractionResult {
	/** Extracted memories from the session. */
	memories: Array<{
		title: string;
		content: string;
		tags: string[];
	}>;
	/** Whether extraction was skipped (too short, no learnings, etc). */
	skipped: boolean;
	/** Reason if skipped. */
	skipReason?: string;
}

export interface MemoryInjectionContext {
	/** Workspace root for relevance matching. */
	workspace: string;
	/** Maximum number of memories to inject. */
	maxMemories: number;
	/** Maximum total characters for memory injection. */
	maxChars: number;
}

export interface MemorySearchOptions {
	/** Filter by workspace (exact or prefix match). */
	workspace?: string;
	/** Search query to match against title + content. */
	query?: string;
	/** Filter by tags. */
	tags?: string[];
	/** Maximum results. */
	limit?: number;
}
