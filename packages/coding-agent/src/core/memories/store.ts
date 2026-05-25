/**
 * Memory store — file-backed persistence for memory entries.
 *
 * Storage layout:
 *   ~/.neo-code/memories/
 *     index.json          — array of MemoryEntry metadata (fast reads)
 *     entries/
 *       <id>.md           — full memory content as markdown
 *
 * The index is kept small (metadata only) for fast startup injection.
 * Full content is read on-demand for /memory view or search.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { MemoryEntry, MemorySearchOptions } from "./types.js";

const CONFIG_DIR_NAME = ".neo-code";
const MEMORIES_DIR = "memories";
const ENTRIES_DIR = "entries";
const INDEX_FILE = "index.json";

function getMemoriesDir(): string {
	return join(homedir(), CONFIG_DIR_NAME, MEMORIES_DIR);
}

function getEntriesDir(): string {
	return join(getMemoriesDir(), ENTRIES_DIR);
}

function getIndexPath(): string {
	return join(getMemoriesDir(), INDEX_FILE);
}

function ensureDir(dir: string): void {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

/**
 * Load all memory entries from the index.
 */
export function loadMemoryIndex(): MemoryEntry[] {
	const indexPath = getIndexPath();
	if (!existsSync(indexPath)) return [];
	try {
		const raw = readFileSync(indexPath, "utf-8");
		const entries = JSON.parse(raw) as unknown;
		if (!Array.isArray(entries)) return [];
		return entries as MemoryEntry[];
	} catch {
		return [];
	}
}

/**
 * Save the memory index to disk.
 */
function saveMemoryIndex(entries: MemoryEntry[]): void {
	ensureDir(getMemoriesDir());
	writeFileSync(getIndexPath(), JSON.stringify(entries, null, 2), "utf-8");
}

/**
 * Read the full content of a memory entry.
 */
export function readMemoryContent(id: string): string | undefined {
	const filePath = join(getEntriesDir(), `${id}.md`);
	if (!existsSync(filePath)) return undefined;
	try {
		return readFileSync(filePath, "utf-8");
	} catch {
		return undefined;
	}
}

/**
 * Add a new memory entry.
 */
export function addMemory(entry: MemoryEntry): void {
	const entries = loadMemoryIndex();
	// Deduplicate by title + workspace (avoid storing exact duplicates)
	const existing = entries.find((e) => e.title === entry.title && e.workspace === entry.workspace);
	if (existing) {
		// Update existing instead of creating duplicate
		existing.content = entry.content;
		existing.tags = [...new Set([...existing.tags, ...entry.tags])];
		existing.createdAt = entry.createdAt;
		existing.sourceSessionId = entry.sourceSessionId;
		saveMemoryIndex(entries);
		ensureDir(getEntriesDir());
		writeFileSync(join(getEntriesDir(), `${existing.id}.md`), entry.content, "utf-8");
		return;
	}

	entries.push(entry);
	saveMemoryIndex(entries);

	// Write full content to separate file
	ensureDir(getEntriesDir());
	writeFileSync(join(getEntriesDir(), `${entry.id}.md`), entry.content, "utf-8");
}

/**
 * Delete a memory entry by ID.
 */
export function deleteMemory(id: string): boolean {
	const entries = loadMemoryIndex();
	const idx = entries.findIndex((e) => e.id === id);
	if (idx === -1) return false;

	entries.splice(idx, 1);
	saveMemoryIndex(entries);

	// Remove content file
	const filePath = join(getEntriesDir(), `${id}.md`);
	if (existsSync(filePath)) {
		rmSync(filePath);
	}
	return true;
}

/**
 * Mark a memory as used (increment counter, update timestamp).
 */
export function markMemoryUsed(id: string): void {
	const entries = loadMemoryIndex();
	const entry = entries.find((e) => e.id === id);
	if (!entry) return;
	entry.usageCount++;
	entry.lastUsedAt = new Date().toISOString();
	saveMemoryIndex(entries);
}

/**
 * Search memories with optional filters.
 */
export function searchMemories(options: MemorySearchOptions = {}): MemoryEntry[] {
	let entries = loadMemoryIndex();

	if (options.workspace) {
		const ws = options.workspace;
		entries = entries.filter((e) => e.workspace === ws || e.workspace.startsWith(ws) || ws.startsWith(e.workspace));
	}

	if (options.tags && options.tags.length > 0) {
		const searchTags = new Set(options.tags.map((t) => t.toLowerCase()));
		entries = entries.filter((e) => e.tags.some((t) => searchTags.has(t.toLowerCase())));
	}

	if (options.query) {
		const q = options.query.toLowerCase();
		entries = entries.filter(
			(e) =>
				e.title.toLowerCase().includes(q) ||
				e.content.toLowerCase().includes(q) ||
				e.tags.some((t) => t.toLowerCase().includes(q)),
		);
	}

	// Sort by usage count (most used first), then by recency
	entries.sort((a, b) => {
		if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
		return (b.lastUsedAt ?? b.createdAt).localeCompare(a.lastUsedAt ?? a.createdAt);
	});

	if (options.limit && options.limit > 0) {
		entries = entries.slice(0, options.limit);
	}

	return entries;
}

/**
 * Get total memory count.
 */
export function getMemoryCount(): number {
	return loadMemoryIndex().length;
}

/**
 * Prune memories that have not been used and are older than the given number of days.
 * Returns the number of memories deleted.
 */
export function pruneStaleMemories(maxAgeDays: number): number {
	const entries = loadMemoryIndex();
	const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
	const stale = entries.filter((e) => {
		if (e.usageCount > 0) return false; // Keep used memories
		const createdMs = new Date(e.createdAt).getTime();
		return createdMs < cutoff;
	});
	for (const entry of stale) {
		deleteMemory(entry.id);
	}
	return stale.length;
}

/**
 * Enforce max stored limit by removing oldest unused memories.
 * Returns number of entries pruned.
 */
export function enforceMaxStored(maxStored: number): number {
	const entries = loadMemoryIndex();
	if (entries.length <= maxStored) return 0;

	// Sort by usage count ascending, then by creation date ascending (oldest first)
	const sorted = [...entries].sort((a, b) => {
		if (a.usageCount !== b.usageCount) return a.usageCount - b.usageCount;
		return a.createdAt.localeCompare(b.createdAt);
	});

	const toRemove = sorted.slice(0, entries.length - maxStored);
	for (const entry of toRemove) {
		deleteMemory(entry.id);
	}
	return toRemove.length;
}
