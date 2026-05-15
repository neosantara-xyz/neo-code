import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	expandSkillInvocationText,
	formatSkillsForPrompt,
	getSkillDescription,
	getSkillDisplayName,
	loadSkillsFromDir,
} from "../src/core/skills.js";

describe("skills loader", () => {
	it("loads Codex-style agents/openai.yaml interface metadata", () => {
		const root = mkdtempSync(join(tmpdir(), "neo-skills-"));
		const skillDir = join(root, "review-helper");
		mkdirSync(join(skillDir, "agents"), { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			[
				"---",
				"name: review-helper",
				"description: Full description for model matching",
				"metadata:",
				"  short-description: Frontmatter short",
				"---",
				"",
				"Review instructions.",
			].join("\n"),
		);
		writeFileSync(
			join(skillDir, "agents", "openai.yaml"),
			[
				"interface:",
				'  display_name: "Review Helper"',
				'  short_description: "UI short description"',
				'  default_prompt: "Use $review-helper for reviews."',
			].join("\n"),
		);

		const result = loadSkillsFromDir({ dir: root, source: "path" });

		expect(result.diagnostics).toEqual([]);
		expect(result.skills[0]).toMatchObject({
			name: "review-helper",
			description: "Full description for model matching",
			shortDescription: "Frontmatter short",
			interface: {
				displayName: "Review Helper",
				shortDescription: "UI short description",
				defaultPrompt: "Use $review-helper for reviews.",
			},
		});
		expect(formatSkillsForPrompt(result.skills)).toContain("Full description for model matching");
		expect(getSkillDisplayName(result.skills[0])).toBe("Review Helper");
		expect(getSkillDescription(result.skills[0])).toBe("UI short description");
	});

	it("expands explicit dollar skill mentions into a skill block", () => {
		const root = mkdtempSync(join(tmpdir(), "neo-skill-mention-"));
		const skillDir = join(root, "review-helper");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(skillDir, "SKILL.md"),
			[
				"---",
				"name: review-helper",
				"description: Review code changes",
				"---",
				"",
				"Read the diff before commenting.",
			].join("\n"),
		);
		const result = loadSkillsFromDir({ dir: root, source: "path" });

		const expanded = expandSkillInvocationText("please use $review-helper on this diff", result.skills);

		expect(expanded).toContain('<skill name="review-helper"');
		expect(expanded).toContain("Read the diff before commenting.");
		expect(expanded).toContain("please use $review-helper on this diff");
	});
});
