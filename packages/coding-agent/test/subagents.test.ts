import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	findSubagentDefinition,
	getSubagentDefinitions,
	resolveSubagentMcpServers,
} from "../src/core/tools/subagents.js";

let previousHome: string | undefined;
let rootDir: string;
let cwd: string;

function writeAgent(relativePath: string, content: string): void {
	const file = join(cwd, relativePath);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, content);
}

describe("subagent definitions", () => {
	beforeEach(() => {
		previousHome = process.env.HOME;
		rootDir = mkdtempSync(join(tmpdir(), "neo-subagents-"));
		cwd = join(rootDir, "project");
		mkdirSync(cwd, { recursive: true });
		process.env.HOME = join(rootDir, "home");
		mkdirSync(process.env.HOME, { recursive: true });
	});

	afterEach(() => {
		if (previousHome === undefined) {
			delete process.env.HOME;
		} else {
			process.env.HOME = previousHome;
		}
		rmSync(rootDir, { recursive: true, force: true });
	});

	it("loads built-in Claude-style subagent types", () => {
		const names = getSubagentDefinitions(cwd).map((definition) => definition.name);

		expect(names).toContain("general-purpose");
		expect(names).toContain("explore");
		expect(names).toContain("plan");
		expect(names).toContain("verification");
	});

	it("loads custom Neo markdown agents with tool and model metadata", () => {
		writeAgent(
			".neo-code/agents/reviewer.md",
			`---
name: Reviewer
description: Checks implementation against project conventions
tools: Read, Grep, LSP, Bash
disallowedTools: Grep
model: neosantara/example-model
maxTurns: 3
---
Review the code and report issues only.
`,
		);

		const definition = findSubagentDefinition(cwd, "reviewer");

		expect(definition.name).toBe("reviewer");
		expect(definition.source).toBe("project");
		expect(definition.description).toBe("Checks implementation against project conventions");
		expect(definition.tools).toEqual(["Read", "Grep", "LSP", "Bash"]);
		expect(definition.disallowedTools).toEqual(["Grep"]);
		expect(definition.model).toBe("neosantara/example-model");
		expect(definition.maxTurns).toBe(3);
		expect(definition.prompt).toBe("Review the code and report issues only.");
	});

	it("supports Claude agents directories and lets project agents override built-ins", () => {
		writeAgent(
			".claude/agents/explore.md",
			`---
name: Explore
description: Project-specific exploration agent
---
Use the project override.
`,
		);

		const definition = findSubagentDefinition(cwd, "explore");

		expect(definition.source).toBe("claude-project");
		expect(definition.description).toBe("Project-specific exploration agent");
		expect(definition.prompt).toBe("Use the project override.");
	});
	it("falls back to general-purpose for unknown subagent types", () => {
		const definition = findSubagentDefinition(cwd, "does-not-exist");

		expect(definition.name).toBe("general-purpose");
	});

	it("parses and scopes custom agent MCP server references", () => {
		writeAgent(
			".neo-code/agents/mcp-reviewer.md",
			`---
name: MCP Reviewer
description: Reviews data through selected MCP servers
mcpServers:
  - repo
  - inline:
      command: node
      args: [server.js]
---
Use only the configured MCP servers.
`,
		);

		const definition = findSubagentDefinition(cwd, "mcp-reviewer");
		const scopedServers = resolveSubagentMcpServers(definition, {
			repo: { command: "node", args: ["repo.js"] },
			other: { command: "node", args: ["other.js"] },
		});

		expect(scopedServers).toEqual({
			repo: { command: "node", args: ["repo.js"] },
			inline: { command: "node", args: ["server.js"] },
		});
	});
});
