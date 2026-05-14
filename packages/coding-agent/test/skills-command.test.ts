import { describe, expect, it } from "vitest";
import { parseSkillsCommand } from "../src/core/skills-command.js";

describe("skills slash command parser", () => {
	it("parses install source and local flag", () => {
		expect(parseSkillsCommand("/skills install git:github.com/acme/skills --local")).toEqual({
			action: "install",
			source: "git:github.com/acme/skills",
			local: true,
		});
	});

	it("parses list command", () => {
		expect(parseSkillsCommand("/skills list")).toEqual({ action: "list" });
	});

	it("returns a usage error when install has no source", () => {
		expect(parseSkillsCommand("/skills install")).toEqual({
			action: "error",
			message: "Usage: /skills install <source> [-l|--local]",
		});
	});
});
