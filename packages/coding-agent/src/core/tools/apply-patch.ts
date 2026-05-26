/**
 * apply_patch — Unified multi-file editing tool.
 *
 * Accepts a compact patch format (*** Begin Patch / *** End Patch) and applies
 * file additions, deletions, and updates atomically. Designed to reduce token
 * usage vs per-file edit/write tools by batching all changes in a single call.
 *
 * Format:
 *   *** Begin Patch
 *   *** Add File: <path>
 *   +line1
 *   +line2
 *   *** Update File: <path>
 *   [@@ optional context header]
 *   [context lines (space-prefixed)]
 *   -old line
 *   +new line
 *   [context lines]
 *   *** Delete File: <path>
 *   *** End Patch
 *
 * Ported from OpenAI Codex's codex-rs/apply-patch (Rust) to TypeScript.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PatchHunkAdd {
	kind: "add";
	path: string;
	contents: string;
}

export interface PatchHunkDelete {
	kind: "delete";
	path: string;
}

export interface UpdateFileChunk {
	/** Optional @@ context line(s) for disambiguation. */
	changeContext: string | undefined;
	/** Lines in the original file to match (without prefix). */
	oldLines: string[];
	/** Replacement lines (without prefix). */
	newLines: string[];
	/** If true, old_lines must match at end of file. */
	isEndOfFile: boolean;
}

export interface PatchHunkUpdate {
	kind: "update";
	path: string;
	moveTo: string | undefined;
	chunks: UpdateFileChunk[];
}

export type PatchHunk = PatchHunkAdd | PatchHunkDelete | PatchHunkUpdate;

export interface ParsedPatch {
	hunks: PatchHunk[];
}

export interface ApplyPatchResult {
	added: string[];
	modified: string[];
	deleted: string[];
}

export class PatchParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PatchParseError";
	}
}

export class PatchApplyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PatchApplyError";
	}
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BEGIN_PATCH = "*** Begin Patch";
const END_PATCH = "*** End Patch";
const ADD_FILE = "*** Add File: ";
const DELETE_FILE = "*** Delete File: ";
const UPDATE_FILE = "*** Update File: ";
const MOVE_TO = "*** Move to: ";
const EOF_MARKER = "*** End of File";
const CONTEXT_MARKER = "@@";

// ─── Parser ──────────────────────────────────────────────────────────────────

export function parsePatch(patch: string): ParsedPatch {
	const rawLines = patch.split("\n");
	// Trim trailing empty lines
	while (rawLines.length > 0 && rawLines[rawLines.length - 1]!.trim() === "") {
		rawLines.pop();
	}

	// Find begin/end markers
	const beginIdx = rawLines.findIndex((l) => l.trim() === BEGIN_PATCH);
	if (beginIdx === -1) {
		throw new PatchParseError(`Missing "${BEGIN_PATCH}" marker`);
	}
	const endIdx = rawLines.findIndex((l, i) => i > beginIdx && l.trim() === END_PATCH);
	if (endIdx === -1) {
		throw new PatchParseError(`Missing "${END_PATCH}" marker`);
	}

	const lines = rawLines.slice(beginIdx + 1, endIdx);
	const hunks: PatchHunk[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i]!;

		if (line.startsWith(ADD_FILE)) {
			const path = line.slice(ADD_FILE.length).trim();
			validatePath(path, i);
			i++;
			const contentLines: string[] = [];
			while (i < lines.length && lines[i]!.startsWith("+")) {
				contentLines.push(lines[i]!.slice(1));
				i++;
			}
			hunks.push({ kind: "add", path, contents: contentLines.join("\n") });
		} else if (line.startsWith(DELETE_FILE)) {
			const path = line.slice(DELETE_FILE.length).trim();
			validatePath(path, i);
			hunks.push({ kind: "delete", path });
			i++;
		} else if (line.startsWith(UPDATE_FILE)) {
			const path = line.slice(UPDATE_FILE.length).trim();
			validatePath(path, i);
			i++;

			// Optional move
			let moveTo: string | undefined;
			if (i < lines.length && lines[i]!.startsWith(MOVE_TO)) {
				moveTo = lines[i]!.slice(MOVE_TO.length).trim();
				validatePath(moveTo, i);
				i++;
			}

			// Parse chunks (hunks within the file update)
			const chunks: UpdateFileChunk[] = [];
			while (i < lines.length && !isFileHeader(lines[i]!)) {
				const chunkLine = lines[i]!;

				if (chunkLine.trim() === CONTEXT_MARKER || chunkLine.startsWith(`${CONTEXT_MARKER} `)) {
					// Context header(s) — collect all consecutive @@ lines
					let changeContext: string | undefined;
					while (
						i < lines.length &&
						(lines[i]!.trim() === CONTEXT_MARKER || lines[i]!.startsWith(`${CONTEXT_MARKER} `))
					) {
						const ctx = lines[i]!.trim() === CONTEXT_MARKER ? undefined : lines[i]!.slice(3);
						if (ctx) {
							changeContext = ctx;
						}
						i++;
					}

					// Now collect the hunk lines (-, +, space)
					const oldLines: string[] = [];
					const newLines: string[] = [];
					let isEndOfFile = false;

					while (i < lines.length && !isFileHeader(lines[i]!) && !isContextHeader(lines[i]!)) {
						const hl = lines[i]!;
						if (hl === EOF_MARKER) {
							isEndOfFile = true;
							i++;
							break;
						}
						if (hl.startsWith("-")) {
							oldLines.push(hl.slice(1));
						} else if (hl.startsWith("+")) {
							newLines.push(hl.slice(1));
						} else if (hl.startsWith(" ")) {
							oldLines.push(hl.slice(1));
							newLines.push(hl.slice(1));
						} else {
							// Possibly a line without prefix — treat as context (lenient)
							oldLines.push(hl);
							newLines.push(hl);
						}
						i++;
					}

					if (oldLines.length > 0 || newLines.length > 0) {
						chunks.push({ changeContext, oldLines, newLines, isEndOfFile });
					}
				} else if (isHunkLine(chunkLine)) {
					// Hunk lines without a preceding @@ header
					const oldLines: string[] = [];
					const newLines: string[] = [];
					let isEndOfFile = false;

					while (i < lines.length && !isFileHeader(lines[i]!) && !isContextHeader(lines[i]!)) {
						const hl = lines[i]!;
						if (hl === EOF_MARKER) {
							isEndOfFile = true;
							i++;
							break;
						}
						if (hl.startsWith("-")) {
							oldLines.push(hl.slice(1));
						} else if (hl.startsWith("+")) {
							newLines.push(hl.slice(1));
						} else if (hl.startsWith(" ")) {
							oldLines.push(hl.slice(1));
							newLines.push(hl.slice(1));
						} else {
							break;
						}
						i++;
					}

					if (oldLines.length > 0 || newLines.length > 0) {
						chunks.push({ changeContext: undefined, oldLines, newLines, isEndOfFile });
					}
				} else {
					// Skip unrecognized lines (lenient parsing)
					i++;
				}
			}

			hunks.push({ kind: "update", path, moveTo, chunks });
		} else {
			// Skip blank or unrecognized lines
			i++;
		}
	}

	if (hunks.length === 0) {
		throw new PatchParseError("Patch contains no file operations");
	}

	return { hunks };
}

function isFileHeader(line: string): boolean {
	return (
		line.startsWith(ADD_FILE) ||
		line.startsWith(DELETE_FILE) ||
		line.startsWith(UPDATE_FILE) ||
		line.trim() === END_PATCH
	);
}

function isContextHeader(line: string): boolean {
	return line.trim() === CONTEXT_MARKER || line.startsWith(`${CONTEXT_MARKER} `);
}

function isHunkLine(line: string): boolean {
	return line.startsWith("-") || line.startsWith("+") || line.startsWith(" ");
}

function validatePath(path: string, lineNumber: number): void {
	if (!path) {
		throw new PatchParseError(`Empty file path at line ${lineNumber + 1}`);
	}
	if (isAbsolute(path)) {
		throw new PatchParseError(`Absolute paths are not allowed: "${path}" at line ${lineNumber + 1}`);
	}
	if (path.includes("..")) {
		throw new PatchParseError(`Path traversal (..) not allowed: "${path}" at line ${lineNumber + 1}`);
	}
}

// ─── Seek Sequence (fuzzy line matching) ─────────────────────────────────────

/**
 * Find `pattern` lines within `lines` starting at or after `start`.
 * Uses progressive relaxation: exact → trim-end → trim-both → unicode-normalized.
 * When `eof` is true, tries matching at end-of-file first.
 */
function seekSequence(lines: string[], pattern: string[], start: number, eof: boolean): number | undefined {
	if (pattern.length === 0) return start;
	if (pattern.length > lines.length) return undefined;

	const searchStart = eof && lines.length >= pattern.length ? lines.length - pattern.length : start;

	// Pass 1: exact match
	for (let i = searchStart; i <= lines.length - pattern.length; i++) {
		if (matchAt(lines, pattern, i, (a, b) => a === b)) return i;
	}
	// Pass 2: trim-end
	for (let i = searchStart; i <= lines.length - pattern.length; i++) {
		if (matchAt(lines, pattern, i, (a, b) => a.trimEnd() === b.trimEnd())) return i;
	}
	// Pass 3: trim both
	for (let i = searchStart; i <= lines.length - pattern.length; i++) {
		if (matchAt(lines, pattern, i, (a, b) => a.trim() === b.trim())) return i;
	}
	// Pass 4: unicode-normalized trim
	for (let i = searchStart; i <= lines.length - pattern.length; i++) {
		if (matchAt(lines, pattern, i, (a, b) => normalizeUnicode(a.trim()) === normalizeUnicode(b.trim()))) return i;
	}

	return undefined;
}

function matchAt(lines: string[], pattern: string[], idx: number, cmp: (a: string, b: string) => boolean): boolean {
	for (let j = 0; j < pattern.length; j++) {
		if (!cmp(lines[idx + j]!, pattern[j]!)) return false;
	}
	return true;
}

function normalizeUnicode(s: string): string {
	return s
		.replace(/[\u2010-\u2015\u2212]/g, "-")
		.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
		.replace(/[\u201C\u201D\u201E\u201F]/g, '"')
		.replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, " ");
}

// ─── Executor ────────────────────────────────────────────────────────────────

/**
 * Apply a parsed patch to the filesystem.
 *
 * @param patch - The patch text to parse and apply
 * @param cwd - Working directory (all paths resolved relative to this)
 * @returns Summary of files added/modified/deleted
 * @throws PatchParseError if patch format is invalid
 * @throws PatchApplyError if patch cannot be applied to files
 */
export function applyPatch(patch: string, cwd: string): ApplyPatchResult {
	const parsed = parsePatch(patch);
	return applyParsedPatch(parsed, cwd);
}

/**
 * Apply an already-parsed patch.
 */
export function applyParsedPatch(parsed: ParsedPatch, cwd: string): ApplyPatchResult {
	const result: ApplyPatchResult = { added: [], modified: [], deleted: [] };

	for (const hunk of parsed.hunks) {
		switch (hunk.kind) {
			case "add":
				applyAddFile(hunk, cwd);
				result.added.push(hunk.path);
				break;
			case "delete":
				applyDeleteFile(hunk, cwd);
				result.deleted.push(hunk.path);
				break;
			case "update":
				applyUpdateFile(hunk, cwd);
				result.modified.push(hunk.moveTo ?? hunk.path);
				break;
		}
	}

	return result;
}

function applyAddFile(hunk: PatchHunkAdd, cwd: string): void {
	const absPath = resolve(cwd, hunk.path);
	const dir = dirname(absPath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	// Add trailing newline if content is non-empty and doesn't end with one
	let content = hunk.contents;
	if (content.length > 0 && !content.endsWith("\n")) {
		content += "\n";
	}
	writeFileSync(absPath, content, "utf-8");
}

function applyDeleteFile(hunk: PatchHunkDelete, cwd: string): void {
	const absPath = resolve(cwd, hunk.path);
	if (!existsSync(absPath)) {
		throw new PatchApplyError(`Cannot delete file that does not exist: ${hunk.path}`);
	}
	rmSync(absPath);
}

function applyUpdateFile(hunk: PatchHunkUpdate, cwd: string): void {
	const absPath = resolve(cwd, hunk.path);
	if (!existsSync(absPath)) {
		throw new PatchApplyError(`Cannot update file that does not exist: ${hunk.path}`);
	}

	const originalContent = readFileSync(absPath, "utf-8");
	const originalLines = originalContent.split("\n");

	// Drop trailing empty element from final newline (matches codex behavior)
	if (originalLines.length > 0 && originalLines[originalLines.length - 1] === "") {
		originalLines.pop();
	}

	// Compute replacements from chunks
	const replacements = computeReplacements(originalLines, hunk.path, hunk.chunks);

	// Apply replacements in reverse order to preserve indices
	const newLines = applyReplacements(originalLines, replacements);

	// Ensure file ends with newline
	let finalLines = newLines;
	if (finalLines.length === 0 || finalLines[finalLines.length - 1] !== "") {
		finalLines = [...finalLines, ""];
	}

	const newContent = finalLines.join("\n");

	// Write to destination (handle move)
	const destPath = hunk.moveTo ? resolve(cwd, hunk.moveTo) : absPath;
	const destDir = dirname(destPath);
	if (!existsSync(destDir)) {
		mkdirSync(destDir, { recursive: true });
	}
	writeFileSync(destPath, newContent, "utf-8");

	// If moved, delete original
	if (hunk.moveTo && destPath !== absPath) {
		rmSync(absPath);
	}
}

interface Replacement {
	startIdx: number;
	oldLen: number;
	newLines: string[];
}

function computeReplacements(originalLines: string[], path: string, chunks: UpdateFileChunk[]): Replacement[] {
	const replacements: Replacement[] = [];
	let lineIndex = 0;

	for (const chunk of chunks) {
		// If chunk has changeContext, seek to it first
		if (chunk.changeContext) {
			const ctxIdx = seekSequence(originalLines, [chunk.changeContext], lineIndex, false);
			if (ctxIdx === undefined) {
				throw new PatchApplyError(`Failed to find context "${chunk.changeContext}" in ${path}`);
			}
			lineIndex = ctxIdx + 1;
		}

		if (chunk.oldLines.length === 0) {
			// Pure addition — insert at end (or before trailing empty line)
			const insertionIdx = originalLines.length;
			replacements.push({ startIdx: insertionIdx, oldLen: 0, newLines: chunk.newLines });
			continue;
		}

		// Find old lines in file
		let pattern = chunk.oldLines;
		let newSlice = chunk.newLines;
		let found = seekSequence(originalLines, pattern, lineIndex, chunk.isEndOfFile);

		// Retry without trailing empty line (same as codex behavior)
		if (found === undefined && pattern.length > 0 && pattern[pattern.length - 1] === "") {
			pattern = pattern.slice(0, -1);
			if (newSlice.length > 0 && newSlice[newSlice.length - 1] === "") {
				newSlice = newSlice.slice(0, -1);
			}
			found = seekSequence(originalLines, pattern, lineIndex, chunk.isEndOfFile);
		}

		if (found === undefined) {
			throw new PatchApplyError(`Failed to find expected lines in ${path}:\n${chunk.oldLines.join("\n")}`);
		}

		replacements.push({ startIdx: found, oldLen: pattern.length, newLines: newSlice });
		lineIndex = found + pattern.length;
	}

	// Sort by start index
	replacements.sort((a, b) => a.startIdx - b.startIdx);
	return replacements;
}

function applyReplacements(lines: string[], replacements: Replacement[]): string[] {
	const result = [...lines];

	// Apply in reverse to preserve indices
	for (let i = replacements.length - 1; i >= 0; i--) {
		const rep = replacements[i]!;
		result.splice(rep.startIdx, rep.oldLen, ...rep.newLines);
	}

	return result;
}
