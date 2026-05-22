/**
 * Discriminated union of supported review targets.
 *
 * Each variant resolves to a different prompt template in
 * `review-prompts.ts`. Adding a new variant requires both a builder there
 * and a UI affordance in `review-selector.ts`.
 */
export type ReviewTarget =
	| { kind: "uncommitted" }
	| { kind: "base-branch"; branch: string; mergeBaseSha?: string }
	| { kind: "commit"; sha: string; title?: string }
	| { kind: "pull-request"; number: number; remote?: string }
	| { kind: "custom"; instructions: string };

/**
 * Returns a short human-readable hint describing the target. Used in the
 * activity status row and as part of the user-facing message echoed
 * into the chat history before the review starts.
 */
export function reviewTargetHint(target: ReviewTarget): string {
	switch (target.kind) {
		case "uncommitted":
			return "uncommitted changes";
		case "base-branch":
			return `changes against '${target.branch}'`;
		case "commit": {
			const shortSha = target.sha.slice(0, 7);
			return target.title ? `commit ${shortSha}: ${target.title}` : `commit ${shortSha}`;
		}
		case "pull-request":
			return target.remote ? `PR #${target.number} (${target.remote})` : `PR #${target.number}`;
		case "custom": {
			const trimmed = target.instructions.trim();
			return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
		}
	}
}

/**
 * Stable identifier for a target, useful for telemetry and logging without
 * leaking commit messages or PR titles.
 */
export function reviewTargetId(target: ReviewTarget): string {
	switch (target.kind) {
		case "uncommitted":
			return "uncommitted";
		case "base-branch":
			return `base:${target.branch}`;
		case "commit":
			return `commit:${target.sha.slice(0, 12)}`;
		case "pull-request":
			return `pr:${target.number}`;
		case "custom":
			return "custom";
	}
}
