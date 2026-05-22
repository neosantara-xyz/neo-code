import { type ReviewTarget, reviewTargetHint } from "./types.js";

/**
 * Reviewer system instructions prepended to every `/review` invocation.
 *
 * Adapted from Codex's `core/review_prompt.md` with two changes:
 *  - Findings are rendered as Markdown (Neo Code's chat format) instead of
 *    the JSON schema Codex consumes for inline-comment threading.
 *  - References to OpenAI-specific tooling (`code_location.absolute_file_path`,
 *    `gh`-only PR review) are dropped or generalized.
 */
export const REVIEW_SYSTEM_INSTRUCTIONS = `You are acting as a code reviewer for proposed changes made by another engineer.

# What counts as a finding

Flag an issue only when it meaningfully impacts correctness, performance, security, or maintainability. A finding must be:

1. Discrete and actionable (not a general critique of the codebase or a bundle of multiple issues).
2. Caused by the change being reviewed (do not flag pre-existing problems).
3. Defensible without speculation about unrelated parts of the codebase or unstated author intent.
4. Clearly not an intentional design choice by the author.

When in doubt, prefer not to flag.

# Priority levels

Tag every finding with one of:

- \`[P0]\` — Drop everything. Blocks release, breaks production, or causes data loss / security incidents. Use only for issues that are universally bad regardless of input.
- \`[P1]\` — Urgent. Should be fixed in the next cycle.
- \`[P2]\` — Normal. Worth fixing eventually.
- \`[P3]\` — Low. Nice to have.

# Comment style

- One paragraph, matter-of-fact, no flattery, no apologies.
- Briefly explain *why* it is a bug.
- Cite the file path and line range that pinpoints the problem (use ranges no longer than ~10 lines).
- Use inline code spans for short identifiers and fenced code blocks only when a concrete fix snippet is helpful (≤ 5 lines).
- State the conditions under which the bug arises if severity depends on them.

Do not propose a full PR fix. Surface the issue precisely; let the author decide on the patch.

# Output format

Render the review as Markdown with the following sections, in this order:

\`\`\`
## Findings

### [P1] Short imperative title
<one-paragraph body explaining the issue, citing file:line>

### [P2] Another finding…
…
\`\`\`

If there are no qualifying findings, output \`## Findings\` followed by \`No qualifying findings.\` on the next line.

End with:

\`\`\`
## Verdict

<one of: "patch is correct" or "patch is incorrect">. <1–3 sentences justifying the call.>
\`\`\`

Do not pad the response with summaries of the change, conclusions about overall design, or commentary outside these sections.`;

/**
 * User prompt prepended with target-specific context. The model receives
 * {@link REVIEW_SYSTEM_INSTRUCTIONS} as the developer-style guideline and the
 * output of this builder as the user message that kicks off the review.
 */
export function buildReviewUserPrompt(target: ReviewTarget): string {
	const heading = `Review ${reviewTargetHint(target)} and provide prioritized findings.`;
	const directive = targetDirective(target);
	return [REVIEW_SYSTEM_INSTRUCTIONS, "", "---", "", heading, "", directive].join("\n");
}

function targetDirective(target: ReviewTarget): string {
	switch (target.kind) {
		case "uncommitted":
			return [
				"Inspect the current workspace state. Cover staged, unstaged, and untracked changes.",
				"Useful commands you may run via the bash tool when available:",
				"- `git status --short` — list changed files",
				"- `git diff --cached` — staged changes",
				"- `git diff` — unstaged changes",
				"- `git ls-files --others --exclude-standard` — untracked files",
			].join("\n");

		case "base-branch": {
			const branch = target.branch;
			const sha = target.mergeBaseSha;
			if (sha) {
				return [
					`Review the changes that would be merged into '${branch}'.`,
					`The merge base for HEAD against '${branch}' is ${sha}.`,
					`Run \`git diff ${sha}\` to inspect the changes relative to '${branch}'.`,
				].join("\n");
			}
			return [
				`Review the changes that would be merged into '${branch}'.`,
				`First locate the merge base, e.g. \`git merge-base HEAD ${branch}\` (or its upstream), then run \`git diff <merge-base>..HEAD\` to inspect the diff.`,
			].join("\n");
		}

		case "commit": {
			const titleNote = target.title ? ` ("${target.title}")` : "";
			return [
				`Review the changes introduced by commit ${target.sha}${titleNote}.`,
				`Run \`git show --stat ${target.sha}\` for a summary and \`git show ${target.sha}\` for the full diff.`,
			].join("\n");
		}

		case "pull-request": {
			const remote = target.remote ? ` on remote '${target.remote}'` : "";
			return [
				`Review pull request #${target.number}${remote}.`,
				`If \`gh\` is available, run:`,
				"- `gh pr view <number>` for metadata",
				"- `gh pr diff <number>` for the full diff",
				"Otherwise fetch the PR's branch via git and diff against the base branch.",
			].join("\n");
		}

		case "custom":
			return target.instructions.trim();
	}
}

/**
 * Echoed into chat history before the review prompt fires so the user sees
 * exactly which target Neo Code resolved their command into.
 */
export function buildReviewKickoffMessage(target: ReviewTarget): string {
	return `Reviewing ${reviewTargetHint(target)}.`;
}
