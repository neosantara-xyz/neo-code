import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../src/core/system-prompt.js";

describe("system prompt", () => {
	it("uses Claude-style Neo Code coding guidance", () => {
		const prompt = buildSystemPrompt({
			cwd: "/repo/project",
			selectedTools: ["read", "grep", "find", "ls", "bash", "edit", "write"],
			toolSnippets: {
				read: "Read file contents",
				grep: "Search file contents",
				find: "Find files",
				ls: "List directories",
				bash: "Run shell commands",
				edit: "Edit files",
				write: "Write files",
			},
			promptGuidelines: ["Use edit for precise changes."],
		});

		expect(prompt).toContain("You are Neo Code, Neosantara's interactive CLI coding agent");
		expect(prompt).toContain("If the user denies a tool call, do not retry the exact same call");
		expect(prompt).toContain("The conversation may be compacted with /compact");
		expect(prompt).toContain("Always check for existing functions, utilities, components");
		expect(prompt).toContain("Use dedicated read-only tools for project inspection instead of bash");
		expect(prompt).toContain("Use edit for precise single-site modifications to existing files. Read the file first");
		expect(prompt).toContain("Use write for new files or complete rewrites");
		expect(prompt).toContain("Do not create README, documentation, changelog, or other markdown files");
		expect(prompt).toContain("Use edit for precise changes.");
	});

	it("renders project context with scoped ordering guidance", () => {
		const prompt = buildSystemPrompt({
			cwd: "/repo/project",
			selectedTools: ["read"],
			toolSnippets: { read: "Read file contents" },
			contextFiles: [
				{ path: "~/AGENTS.md", content: "home rules" },
				{ path: "AGENTS.md", content: "project rules" },
			],
		});

		expect(prompt).toContain("Project-specific instructions are loaded from broad to specific scope");
		expect(prompt).toContain("## ~/AGENTS.md");
		expect(prompt).toContain("## AGENTS.md");
		expect(prompt).toContain("Current working directory: /repo/project");
	});
});
