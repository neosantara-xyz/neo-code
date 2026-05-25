/**
 * Memory system — cross-session context persistence.
 *
 * Re-exports the public API for the memory subsystem.
 */

export { buildExtractionPrompt, parseExtractionResponse, redactSecrets, shouldExtractMemories } from "./extraction.js";
export { buildMemoryInjection, getMemorySummary } from "./injection.js";
export {
	addMemory,
	deleteMemory,
	enforceMaxStored,
	getMemoryCount,
	loadMemoryIndex,
	pruneStaleMemories,
	readMemoryContent,
	searchMemories,
} from "./store.js";
export type { MemoryEntry, MemoryExtractionResult, MemoryInjectionContext, MemorySearchOptions } from "./types.js";
