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

	it("does not expose redundant or advanced aliases in the default slash palette", () => {
		const commandNames = BUILTIN_SLASH_COMMANDS.map((command) => command.name);

		expect(commandNames).not.toContain("memory");
		expect(commandNames).not.toContain("readonly");
		expect(commandNames).not.toContain("agent");
		expect(commandNames).not.toContain("acceptedits");
		expect(commandNames).not.toContain("scoped-models");
		expect(commandNames).not.toContain("reload");
		expect(commandNames).not.toContain("hooks");
		expect(commandNames.length).toBeLessThanOrEqual(30);
	});
});
