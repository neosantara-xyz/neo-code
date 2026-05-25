/**
 * apply_patch tool definition.
 *
 * Registers the apply_patch parser/executor as a proper tool in the neo-code
 * tool system. This tool enables the model to make multi-file edits in a
 * single call using a compact patch format, dramatically reducing token usage.
 */

import type { AgentToolResult } from "@neosantara/agent-core";
import { type Static, Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { type ApplyPatchResult, applyPatch, PatchApplyError, PatchParseError } from "./apply-patch.js";
import { withFileMutationQueue } from "./file-mutation-queue.js";

const applyPatchSchema = Type.Object({
	patch: Type.String({
		description:
			"The patch to apply. Must use the *** Begin Patch / *** End Patch format with Add File, Delete File, and Update File operations. Lines prefixed with + are additions, - are deletions, and space are context.",
	}),
});

export type ApplyPatchToolInput = Static<typeof applyPatchSchema>;

export interface ApplyPatchToolDetails {
	added: string[];
	modified: string[];
	deleted: string[];
	error?: string;
}

export function createApplyPatchToolDefinition(
	cwd: string,
): ToolDefinition<typeof applyPatchSchema, ApplyPatchToolDetails> {
	return {
		name: "apply_patch",
		label: "Apply patch",
		description:
			"Apply a multi-file patch to the workspace. Supports adding new files, deleting files, and updating existing files with context-based matching. Use this tool when making changes to multiple files at once or when making several edits to a single file — it is more token-efficient than separate edit/write calls.",
		promptSnippet: "Apply multi-file patches using the *** Begin Patch format.",
		promptGuidelines: [
			"Use apply_patch for multi-file edits or multiple edits to a single file.",
			"Include 3 lines of context (space-prefixed) above and below each change for reliable matching.",
			"Use @@ class/function headers when context lines alone are not unique enough.",
			"Paths must be relative to the workspace root. Never use absolute paths.",
			"Prefix new lines with + even in Add File sections.",
		],
		parameters: applyPatchSchema,
		getActivityDescription: (args) => {
			// Quick count of file operations for the activity label
			const addCount = (args.patch.match(/\*\*\* Add File:/g) ?? []).length;
			const updateCount = (args.patch.match(/\*\*\* Update File:/g) ?? []).length;
			const deleteCount = (args.patch.match(/\*\*\* Delete File:/g) ?? []).length;
			const parts: string[] = [];
			if (addCount > 0) parts.push(`+${addCount}`);
			if (updateCount > 0) parts.push(`~${updateCount}`);
			if (deleteCount > 0) parts.push(`-${deleteCount}`);
			return `patching ${parts.join(" ")} files`;
		},
		getToolUseSummary: (args) => {
			const addCount = (args.patch.match(/\*\*\* Add File:/g) ?? []).length;
			const updateCount = (args.patch.match(/\*\*\* Update File:/g) ?? []).length;
			const deleteCount = (args.patch.match(/\*\*\* Delete File:/g) ?? []).length;
			const total = addCount + updateCount + deleteCount;
			return `Apply patch: ${total} file${total !== 1 ? "s" : ""}`;
		},
		renderToolResultSummary: (result) => {
			const d = result.details;
			if (d.error) return `patch failed: ${d.error}`;
			const parts: string[] = [];
			if (d.added.length > 0) parts.push(`${d.added.length} added`);
			if (d.modified.length > 0) parts.push(`${d.modified.length} modified`);
			if (d.deleted.length > 0) parts.push(`${d.deleted.length} deleted`);
			return `patch applied: ${parts.join(", ")}`;
		},
		async execute(_toolCallId, params): Promise<AgentToolResult<ApplyPatchToolDetails>> {
			return withFileMutationQueue(cwd, async () => {
				try {
					const result: ApplyPatchResult = applyPatch(params.patch, cwd);

					const summary = formatSummary(result);
					return {
						content: [{ type: "text", text: summary }],
						details: {
							added: result.added,
							modified: result.modified,
							deleted: result.deleted,
						},
					};
				} catch (error) {
					const message =
						error instanceof PatchParseError
							? `Parse error: ${error.message}`
							: error instanceof PatchApplyError
								? `Apply error: ${error.message}`
								: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;

					return {
						content: [{ type: "text", text: message }],
						details: {
							added: [],
							modified: [],
							deleted: [],
							error: message,
						},
					};
				}
			});
		},
	};
}

function formatSummary(result: ApplyPatchResult): string {
	const lines: string[] = ["Patch applied successfully."];
	for (const path of result.added) {
		lines.push(`A ${path}`);
	}
	for (const path of result.modified) {
		lines.push(`M ${path}`);
	}
	for (const path of result.deleted) {
		lines.push(`D ${path}`);
	}
	return lines.join("\n");
}
