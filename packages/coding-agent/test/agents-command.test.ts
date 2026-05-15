import { describe, expect, it } from "vitest";
import { AGENTS_FILE_NAME, INIT_AGENTS_PROMPT } from "../src/core/agents-command.js";
import { BUILTIN_SLASH_COMMANDS } from "../src/core/slash-commands.js";

describe("agents slash commands", () => {
	it("exposes /init as the AGENTS.md generator command", () => {
		expect(AGENTS_FILE_NAME).toBe("AGENTS.md");
		expect(INIT_AGENTS_PROMPT).toContain("Generate a file named AGENTS.md");
		expect(BUILTIN_SLASH_COMMANDS).toContainEqual({
			name: "init",
			description: "Create an AGENTS.md contributor guide for this repository",
		});
	});
});
