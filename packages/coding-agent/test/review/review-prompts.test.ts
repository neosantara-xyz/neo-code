import { describe, expect, it } from "vitest";
import {
	buildReviewKickoffMessage,
	buildReviewUserPrompt,
	REVIEW_SYSTEM_INSTRUCTIONS,
} from "../../src/core/review/review-prompts.js";

describe("REVIEW_SYSTEM_INSTRUCTIONS", () => {
	it("documents the four priority tags", () => {
		expect(REVIEW_SYSTEM_INSTRUCTIONS).toContain("[P0]");
		expect(REVIEW_SYSTEM_INSTRUCTIONS).toContain("[P1]");
		expect(REVIEW_SYSTEM_INSTRUCTIONS).toContain("[P2]");
		expect(REVIEW_SYSTEM_INSTRUCTIONS).toContain("[P3]");
	});

	it("requires the Findings and Verdict sections", () => {
		expect(REVIEW_SYSTEM_INSTRUCTIONS).toContain("## Findings");
		expect(REVIEW_SYSTEM_INSTRUCTIONS).toContain("## Verdict");
	});

	it("prefers no findings over speculative ones", () => {
		expect(REVIEW_SYSTEM_INSTRUCTIONS.toLowerCase()).toContain("when in doubt");
	});

	it("does not leak Codex- or OpenAI-specific protocol identifiers", () => {
		expect(REVIEW_SYSTEM_INSTRUCTIONS).not.toContain("absolute_file_path");
		expect(REVIEW_SYSTEM_INSTRUCTIONS).not.toContain("confidence_score");
		expect(REVIEW_SYSTEM_INSTRUCTIONS).not.toContain("overall_correctness");
	});
});

describe("buildReviewUserPrompt", () => {
	it("embeds the system instructions plus a uncommitted-specific directive", () => {
		const prompt = buildReviewUserPrompt({ kind: "uncommitted" });
		expect(prompt).toContain(REVIEW_SYSTEM_INSTRUCTIONS);
		expect(prompt).toContain("Review uncommitted changes");
		expect(prompt).toContain("git status --short");
		expect(prompt).toContain("git diff --cached");
		expect(prompt).toContain("git ls-files --others --exclude-standard");
	});

	it("threads the merge-base SHA into the base-branch directive when known", () => {
		const prompt = buildReviewUserPrompt({
			kind: "base-branch",
			branch: "main",
			mergeBaseSha: "deadbeef",
		});
		expect(prompt).toContain("merge base for HEAD against 'main' is deadbeef");
		expect(prompt).toContain("git diff deadbeef");
	});

	it("falls back to merge-base advice when SHA is not available", () => {
		const prompt = buildReviewUserPrompt({ kind: "base-branch", branch: "develop" });
		expect(prompt).toContain("git merge-base HEAD develop");
		expect(prompt).not.toContain("merge base for HEAD against 'develop' is");
	});

	it("includes the commit SHA and title in commit reviews", () => {
		const prompt = buildReviewUserPrompt({
			kind: "commit",
			sha: "abcdef1",
			title: "Fix off-by-one",
		});
		expect(prompt).toContain("commit abcdef1");
		expect(prompt).toContain('("Fix off-by-one")');
		expect(prompt).toContain("git show --stat abcdef1");
	});

	it("offers gh and git fallbacks for pull-request reviews", () => {
		const prompt = buildReviewUserPrompt({ kind: "pull-request", number: 17 });
		expect(prompt).toContain("pull request #17");
		expect(prompt).toContain("gh pr view");
		expect(prompt).toContain("gh pr diff");
		expect(prompt).toContain("Otherwise fetch the PR's branch");
	});

	it("trims and forwards custom instructions verbatim after the system prompt", () => {
		const prompt = buildReviewUserPrompt({ kind: "custom", instructions: "  audit auth flow " });
		expect(prompt).toContain("audit auth flow");
		expect(prompt).not.toContain("  audit auth flow ");
	});
});

describe("buildReviewKickoffMessage", () => {
	it("prefixes with 'Reviewing' and uses the target hint", () => {
		expect(buildReviewKickoffMessage({ kind: "uncommitted" })).toBe("Reviewing uncommitted changes.");
		expect(buildReviewKickoffMessage({ kind: "pull-request", number: 9 })).toBe("Reviewing PR #9.");
	});
});
