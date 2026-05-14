import { describe, expect, it } from "vitest";
import { type BashOperations, createBashToolDefinition } from "../src/core/tools/bash.js";
import {
	classifyBashCommand,
	formatToolActivityGroup,
	formatToolActivityLine,
	formatToolInputLoadingMessage,
	formatToolLoadingMessage,
	isBenignBashExit,
	isNoMatchBashExit,
	summarizeToolResult,
} from "../src/core/tools/tool-activity.js";

describe("tool activity summaries", () => {
	it("classifies grep/find/read bash commands as compact search/read activity", () => {
		expect(classifyBashCommand('grep -r -i -E "todo|fixme" src').kind).toBe("search");
		expect(classifyBashCommand('find . -type f -name "*.ts"').kind).toBe("search");
		expect(classifyBashCommand("head -30 src/index.ts").kind).toBe("read");
		expect(formatToolActivityLine("grep", { pattern: "todo|fixme", path: "src" })).toContain("✦ Searching files");
		expect(
			formatToolInputLoadingMessage("grep", {
				pattern: "todo|fixme",
				path: "src",
			}),
		).toBe("nyiapke alat…");
		expect(formatToolLoadingMessage("grep", { pattern: "todo|fixme", path: "src" })).toBe("nggoleki file…");
	});

	it("treats grep exit 1 with no output as no matches instead of an error", () => {
		const command = 'grep -r -i -E "todo|fixme" src';
		expect(isNoMatchBashExit(command, 1, "")).toBe(true);
		expect(isBenignBashExit(command, 1, "")).toBe(true);
		expect(
			summarizeToolResult("bash", { command }, { content: [{ type: "text", text: "No matches found" }] }),
		).toMatchObject({
			label: "no matches",
			status: "neutral",
		});
	});

	it("shows compact Neosantara-flavored pending activity without spinner markers", () => {
		const text = formatToolActivityGroup([
			{
				id: "grep-1",
				toolName: "grep",
				args: { pattern: "todo", path: "src" },
				isPartial: true,
				executionStarted: true,
			},
		]);

		expect(text).toContain("✦ Inspecting project · nyawang project…");
		expect(text).toContain("└─ nggoleki file: grep /todo/ in src");
		expect(text).not.toContain("●");
	});
});

describe("bash tool semantic exit handling", () => {
	it("returns a neutral no-match result for grep exit code 1", async () => {
		const operations: BashOperations = {
			exec: async () => ({ exitCode: 1 }),
		};
		const tool = createBashToolDefinition(process.cwd(), { operations });
		const result = await tool.execute(
			"call-1",
			{ command: 'grep -r -i -E "todo|fixme" src' },
			undefined,
			undefined,
			{} as any,
		);
		expect(result.content[0]?.text).toContain("No matches found");
		expect(result.details?.noMatches).toBe(true);
		expect(result.details?.exitCode).toBe(1);
	});

	it("still throws for real command failures", async () => {
		const operations: BashOperations = {
			exec: async (_command, _cwd, { onData }) => {
				onData(Buffer.from("fatal error"));
				return { exitCode: 2 };
			},
		};
		const tool = createBashToolDefinition(process.cwd(), { operations });
		await expect(
			tool.execute("call-2", { command: "node broken.js" }, undefined, undefined, {} as any),
		).rejects.toThrow("Command exited with code 2");
	});
});

describe("tool activity grouping", () => {
	it("collapses multiple search/read tools into one project inspection tree", () => {
		const text = formatToolActivityGroup([
			{
				id: "find-1",
				toolName: "find",
				args: { pattern: "*.ts", path: "src" },
				result: {
					content: [{ type: "text", text: "src/index.ts\nsrc/app.ts" }],
				},
				isError: false,
				isPartial: false,
			},
			{
				id: "grep-1",
				toolName: "grep",
				args: { pattern: "todo|fixme", path: "src" },
				result: { content: [{ type: "text", text: "No matches found" }] },
				isError: false,
				isPartial: false,
			},
		]);

		expect(text).toContain("✦ Inspecting project");
		expect(text).toContain("find *.ts in src → 2 files");
		expect(text).toContain("grep /todo|fixme/ in src → no matches");
	});
});
