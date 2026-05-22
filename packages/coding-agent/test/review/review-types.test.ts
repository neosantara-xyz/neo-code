import { describe, expect, it } from "vitest";
import { type ReviewTarget, reviewTargetHint, reviewTargetId } from "../../src/core/review/types.js";

describe("reviewTargetHint", () => {
	it("describes uncommitted target", () => {
		expect(reviewTargetHint({ kind: "uncommitted" })).toBe("uncommitted changes");
	});

	it("describes a base-branch target with the branch name", () => {
		expect(reviewTargetHint({ kind: "base-branch", branch: "main" })).toBe("changes against 'main'");
	});

	it("describes a commit with a short SHA and optional subject", () => {
		expect(reviewTargetHint({ kind: "commit", sha: "abcdef1234567890" })).toBe("commit abcdef1");
		expect(
			reviewTargetHint({
				kind: "commit",
				sha: "abcdef1234567890",
				title: "Fix racy test setup",
			}),
		).toBe("commit abcdef1: Fix racy test setup");
	});

	it("describes a pull-request target with optional remote", () => {
		expect(reviewTargetHint({ kind: "pull-request", number: 42 })).toBe("PR #42");
		expect(reviewTargetHint({ kind: "pull-request", number: 42, remote: "origin" })).toBe("PR #42 (origin)");
	});

	it("truncates long custom instructions in the hint", () => {
		const long = "x".repeat(120);
		const hint = reviewTargetHint({ kind: "custom", instructions: long });
		expect(hint.length).toBeLessThanOrEqual(60);
		expect(hint.endsWith("…")).toBe(true);
	});

	it("uses the trimmed instructions when short enough", () => {
		expect(reviewTargetHint({ kind: "custom", instructions: "  spot leaks  " })).toBe("spot leaks");
	});
});

describe("reviewTargetId", () => {
	it("collapses sensitive content to opaque ids", () => {
		const targets: ReviewTarget[] = [
			{ kind: "uncommitted" },
			{ kind: "base-branch", branch: "feat/refactor" },
			{ kind: "commit", sha: "0123456789abcdef0123456789abcdef" },
			{ kind: "pull-request", number: 7 },
			{ kind: "custom", instructions: "review the auth module" },
		];
		expect(targets.map(reviewTargetId)).toEqual([
			"uncommitted",
			"base:feat/refactor",
			"commit:0123456789ab",
			"pr:7",
			"custom",
		]);
	});
});
