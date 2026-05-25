/**
 * Memory system — cross-session context persistence.
 *
 * Re-exports the public API for the memory subsystem.
 */

export { buildConsolidationPrompt, parseConsolidationResponse, shouldConsolidate } from "./consolidation.js";
export { buildExtractionPrompt, parseExtractionResponse, redactSecrets, shouldExtractMemories } from "./extraction.js";
export { buildMemoryInjection, getMemorySummary } from "./injection.js";
export {
	addMemory,
	deleteMemory,
	enforceMaxStored,
	getMemoryCount,
	loadConsolidationState,
	loadMemoryIndex,
	pruneStaleMemories,
	readMemoryContent,
	saveConsolidationState,
	searchMemories,
	writeMemoryMd,
} from "./store.js";
export type {
	ConsolidationResult,
	ConsolidationState,
	MemoryEntry,
	MemoryExtractionResult,
	MemoryInjectionContext,
	MemorySearchOptions,
} from "./types.js";
