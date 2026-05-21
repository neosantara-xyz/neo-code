import { homedir } from "node:os";
import { join } from "node:path";
import { Container } from "@neosantara/tui";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { type BashOperations, createBashToolDefinition } from "../src/core/tools/bash.js";
import {
	canMergeToolIntoActivityGroup,
	classifyBashCommand,
	formatToolActivityGroup,
	formatToolActivityLine,
	formatToolInputLoadingMessage,
	formatToolLoadingMessage,
	isBenignBashExit,
	isNoMatchBashExit,
	summarizeToolResult,
} from "../src/core/tools/tool-activity.js";
import { ToolActivityGroupComponent } from "../src/modes/interactive/components/tool-activity-group.js";
import type { ToolExecutionComponent } from "../src/modes/interactive/components/tool-execution.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";
import { stripAnsi } from "../src/utils/ansi.js";

type ToolResult = {
	content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
	details?: unknown;
	isError: boolean;
};

class StubToolExecutionComponent extends Container {
	setExpanded(_expanded: boolean): void {}
	setShowImages(_show: boolean): void {}
	setImageWidthCells(_width: number): void {}
	updateArgs(_args: unknown): void {}
	markExecutionStarted(): void {}
	updateResult(_result: ToolResult, _isPartial?: boolean): void {}
	setArgsComplete(): void {}
}

function createStubToolExecutionComponent(): ToolExecutionComponent {
	return new StubToolExecutionComponent() as unknown as ToolExecutionComponent;
}

function renderRaw(component: ToolActivityGroupComponent): string {
	return component.render(100).join("\n");
}

describe("tool activity summaries", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	afterEach(() => {
		vi.useRealTimers();
	});

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
		expect(formatToolLoadingMessage("grep", { pattern: "todo|fixme", path: "src" })).toBe(
			"nggoleki file: grep /todo|fixme/ in src…",
		);
	});

	it("uses model-provided bash descriptions as the compact tool summary", () => {
		const activity = classifyBashCommand("npm test -- --runInBand", "Run the unit test suite");
		expect(activity.title).toBe("Running tests");
		expect(activity.compact).toBe("Run the unit test suite");
		expect(formatToolActivityLine("bash", { command: "npm test", description: "Run unit tests" })).toContain(
			"├─ Run unit tests",
		);
		expect(formatToolLoadingMessage("bash", { command: "npm test", description: "Run unit tests" })).toBe(
			"Run unit tests…",
		);
	});

	it("includes write/edit targets in loading messages without requiring raw expansion", () => {
		expect(formatToolLoadingMessage("write", { path: "src/app.ts", content: "export {};" })).toBe(
			"nulis file: src/app.ts…",
		);
		expect(formatToolLoadingMessage("edit", { file_path: "src/app.ts", oldText: "a", newText: "b" })).toBe(
			"mbeneri file: src/app.ts…",
		);
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

		expect(text).toContain("● Search /todo/ in src");
		expect(text).toContain("└ searching…");
		expect(text).not.toContain("⏺");
	});

	it("freezes tool activity shimmer while approval owns focus", () => {
		vi.useFakeTimers();
		const group = new ToolActivityGroupComponent();

		group.addTool(
			"grep",
			"grep-approval-1",
			{ pattern: "permission", path: "src" },
			createStubToolExecutionComponent(),
		);

		expect(vi.getTimerCount()).toBe(1);

		group.setAnimationPaused(true);
		const pausedRender = renderRaw(group);

		expect(vi.getTimerCount()).toBe(0);
		expect(stripAnsi(pausedRender)).toContain("Review details in permission card");
		expect(stripAnsi(pausedRender)).not.toContain("expand live tool output");

		vi.advanceTimersByTime(720);

		expect(renderRaw(group)).toBe(pausedRender);

		group.setAnimationPaused(false);

		expect(vi.getTimerCount()).toBe(1);

		group.dispose();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("updates the current activity tree immediately while running", () => {
		vi.useFakeTimers();
		const group = new ToolActivityGroupComponent();

		group.addTool("read", "read-1", { path: "src/one.ts" }, createStubToolExecutionComponent());
		expect(stripAnsi(renderRaw(group))).toContain("● Read src/one.ts");
		expect(stripAnsi(renderRaw(group))).toContain("└ reading…");

		group.addTool("read", "read-2", { path: "src/two.ts" }, createStubToolExecutionComponent());
		const rendered = stripAnsi(renderRaw(group));

		expect(rendered).toContain("reading 2 files");
		expect(rendered).toContain("one.ts");
		expect(rendered).toContain("two.ts");
		expect(rendered).toContain("⠋ reading two.ts");

		group.dispose();
	});

	it("reveals stacked live activity tools incrementally", () => {
		vi.useFakeTimers();
		const requestRender = vi.fn();
		const group = new ToolActivityGroupComponent(false, {
			gradualReveal: true,
			requestRender,
			revealDelayMs: 80,
		});

		group.addTool("read", "read-1", { path: "src/one.ts" }, createStubToolExecutionComponent());
		group.addTool("read", "read-2", { path: "src/two.ts" }, createStubToolExecutionComponent());
		group.addTool("read", "read-3", { path: "src/three.ts" }, createStubToolExecutionComponent());

		let rendered = stripAnsi(renderRaw(group));
		expect(rendered).toContain("● Read src/one.ts");
		expect(rendered).not.toContain("two.ts");
		expect(rendered).not.toContain("three.ts");

		vi.advanceTimersByTime(80);
		rendered = stripAnsi(renderRaw(group));
		expect(requestRender).toHaveBeenCalledTimes(1);
		expect(rendered).toContain("reading 2 files");
		expect(rendered).toContain("one.ts");
		expect(rendered).toContain("two.ts");
		expect(rendered).not.toContain("three.ts");

		vi.advanceTimersByTime(80);
		rendered = stripAnsi(renderRaw(group));
		expect(requestRender).toHaveBeenCalledTimes(2);
		expect(rendered).toContain("reading 3 files");
		expect(rendered).toContain("three.ts");

		group.dispose();
	});

	it("reveals queued live activity tools immediately when expanded", () => {
		vi.useFakeTimers();
		const requestRender = vi.fn();
		const group = new ToolActivityGroupComponent(false, {
			gradualReveal: true,
			requestRender,
			revealDelayMs: 80,
		});

		group.addTool("read", "read-1", { path: "src/one.ts" }, createStubToolExecutionComponent());
		group.addTool("read", "read-2", { path: "src/two.ts" }, createStubToolExecutionComponent());
		group.addTool("read", "read-3", { path: "src/three.ts" }, createStubToolExecutionComponent());

		expect(stripAnsi(renderRaw(group))).not.toContain("three.ts");

		group.setExpanded(true);
		const rendered = stripAnsi(renderRaw(group));

		expect(rendered).toContain("reading 3 files");
		expect(rendered).toContain("one.ts");
		expect(rendered).toContain("two.ts");
		expect(rendered).toContain("three.ts");
		expect(vi.getTimerCount()).toBe(1);

		vi.advanceTimersByTime(80);
		expect(requestRender).not.toHaveBeenCalled();

		group.dispose();
	});

	it("does not stagger new activity tools while output is expanded", () => {
		vi.useFakeTimers();
		const group = new ToolActivityGroupComponent(true, {
			gradualReveal: true,
			revealDelayMs: 80,
		});

		group.addTool("read", "read-1", { path: "src/one.ts" }, createStubToolExecutionComponent());
		group.addTool("read", "read-2", { path: "src/two.ts" }, createStubToolExecutionComponent());

		const rendered = stripAnsi(renderRaw(group));
		expect(rendered).toContain("reading 2 files");
		expect(rendered).toContain("one.ts");
		expect(rendered).toContain("two.ts");
		expect(rendered).not.toContain("expand tool output");

		group.dispose();
	});

	it("keeps tool activity counts monotonic while a group is active", () => {
		const group = new ToolActivityGroupComponent();

		group.addTool("grep", "grep-1", { pattern: "one", path: "src" }, createStubToolExecutionComponent());
		group.addTool("grep", "grep-2", { pattern: "two", path: "src" }, createStubToolExecutionComponent());
		group.updateToolResult("grep-1", { content: [{ type: "text", text: "a.ts:1:one" }], isError: false });
		group.updateToolResult("grep-2", { content: [{ type: "text", text: "b.ts:1:two" }], isError: false });

		expect(renderRaw(group)).toContain("searched 2 patterns");

		group.updateToolArgs("grep-2", { pattern: "two updated", path: "src" });

		expect(renderRaw(group)).toContain("searched 2 patterns");
		group.dispose();
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
	it("collapses multiple search tools into one unified activity group", () => {
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

		expect(text).toContain("✦ Searched files");
		expect(text).toContain("└─ searched 2 patterns · *.ts in src · /todo|fixme/ in src");
	});

	it("keeps mixed read-only activity as one unified inspection group", () => {
		const text = formatToolActivityGroup([
			{
				id: "ls-1",
				toolName: "ls",
				args: { path: "docs" },
				result: { content: [{ type: "text", text: "intro.md" }] },
				isError: false,
				isPartial: false,
			},
			{
				id: "grep-1",
				toolName: "grep",
				args: { pattern: "ExitPlanMode", path: "src" },
				result: { content: [{ type: "text", text: "src/plan.ts:1:ExitPlanMode" }] },
				isError: false,
				isPartial: false,
			},
			{
				id: "read-1",
				toolName: "read",
				args: { path: "packages/coding-agent/src/core/tools/tool-activity.ts" },
				result: { content: [{ type: "text", text: "line one\nline two" }] },
				isError: false,
				isPartial: false,
			},
		]);

		expect(text).toContain("✦ Inspected project");
		expect(text).toContain("├─ List");
		expect(text).toContain("│  └─ listed 1 directory");
		expect(text).toContain("├─ Search");
		expect(text).toContain("│  └─ searched 1 pattern");
		expect(text).toContain("└─ Read");
		expect(text).toContain("├─ read 1 file");
		expect(text).toContain("└─ tool-activity.ts");
		expect(text).not.toContain("intro.md");
		expect(text).not.toContain("ExitPlanMode");
	});

	it("keeps command activity in its own single-line group", () => {
		const text = formatToolActivityGroup([
			{
				id: "bash-1",
				toolName: "bash",
				args: { command: "npm run check", description: "Run repository check" },
				result: { content: [{ type: "text", text: "ok" }], details: { exitCode: 0 } },
				isError: false,
				isPartial: false,
			},
		]);

		expect(text).toContain("● Run repository check (shell)");
		expect(text).toContain("│ npm run check");
		expect(text).toContain("└ exit 0 · 1 line");
	});

	it("keeps command and mutation tools in separate intent groups", () => {
		const inspectItems = [
			{
				id: "ls-1",
				toolName: "ls",
				args: { path: "docs" },
				result: { content: [{ type: "text", text: "intro.md" }] },
				isError: false,
				isPartial: false,
			},
		];

		expect(canMergeToolIntoActivityGroup(inspectItems, "grep", { pattern: "todo", path: "src" })).toBe(true);
		expect(canMergeToolIntoActivityGroup(inspectItems, "bash", { command: "npm run check" })).toBe(false);
		expect(canMergeToolIntoActivityGroup(inspectItems, "edit", { path: "src/index.ts" })).toBe(false);
		expect(
			canMergeToolIntoActivityGroup(
				[
					{
						id: "bash-1",
						toolName: "bash",
						args: { command: "npm run check" },
						isPartial: true,
					},
				],
				"bash",
				{ command: "npm test" },
			),
		).toBe(false);
	});

	it("summarizes repeated read-only inspection calls instead of rendering duplicate rows", () => {
		const text = formatToolActivityGroup([
			{
				id: "ls-1",
				toolName: "ls",
				args: { path: "docs" },
				result: { content: [{ type: "text", text: "a.md\nb.md\nc.md" }] },
				isError: false,
				isPartial: false,
			},
			{
				id: "ls-2",
				toolName: "ls",
				args: { path: "docs" },
				result: { content: [{ type: "text", text: "a.md\nb.md\nc.md" }] },
				isError: false,
				isPartial: false,
			},
		]);

		expect(text).toContain("✦ Listed files");
		expect(text).toContain("└─ listed 2 directories · docs");
		expect(text).not.toContain("+1 more");
		expect(text.match(/docs/g)?.length).toBe(1);
	});

	it("keeps completed multi-file reads stacked after loading finishes", () => {
		const text = formatToolActivityGroup([
			{
				id: "read-1",
				toolName: "read",
				args: { path: "src/one.ts" },
				result: { content: [{ type: "text", text: "line one" }] },
				isError: false,
				isPartial: false,
			},
			{
				id: "read-2",
				toolName: "read",
				args: { path: "src/two.ts" },
				result: { content: [{ type: "text", text: "line two" }] },
				isError: false,
				isPartial: false,
			},
		]);

		expect(text).toContain("✦ Read files");
		expect(text).toContain("└─ Read");
		expect(text).toContain("├─ read 2 files");
		expect(text).toContain("├─ one.ts");
		expect(text).toContain("└─ two.ts");
	});

	it("shows latest active target as a hint row for mixed tool trees", () => {
		const text = formatToolActivityGroup([
			{
				id: "ls-1",
				toolName: "ls",
				args: { path: "docs" },
				result: { content: [{ type: "text", text: "intro.md" }] },
				isError: false,
				isPartial: false,
			},
			{
				id: "read-1",
				toolName: "read",
				args: { path: "packages/coding-agent/src/core/tools/tool-activity.ts" },
				isPartial: true,
				executionStarted: true,
			},
		]);

		expect(text).toContain("✦ Inspecting project");
		expect(text).toContain("├─ List");
		expect(text).toContain("│  └─ listed 1 directory");
		expect(text).toContain("├─ Read");
		expect(text).toContain("│  ├─ reading 1 file");
		expect(text).toContain("│  └─ tool-activity.ts");
		expect(text).toContain("└─ Current");
		expect(text).toContain("⠋ reading tool-activity.ts");
	});

	it("renders cwd paths as short relative labels", () => {
		const cwd = process.cwd();
		const docsPath = join(cwd, "docs");
		const filePath = join(cwd, "packages/coding-agent/src/core/tools/tool-activity.ts");
		const text = formatToolActivityGroup([
			{
				id: "ls-absolute-1",
				toolName: "ls",
				args: { path: docsPath },
				result: { content: [{ type: "text", text: "intro.md" }] },
				isError: false,
				isPartial: false,
			},
			{
				id: "read-absolute-1",
				toolName: "read",
				args: { path: filePath },
				result: { content: [{ type: "text", text: "line one" }] },
				isError: false,
				isPartial: false,
			},
		]);

		expect(text).toContain("✦ Inspected project");
		expect(text).toContain("listed 1 directory");
		expect(text).toContain("read 1 file");
		expect(text).not.toContain(cwd.replace(/\\/g, "/"));
	});

	it("normalizes absolute cwd and home paths in bash descriptions", () => {
		const cwd = process.cwd().replace(/\\/g, "/");
		const home = homedir().replace(/\\/g, "/");
		const text = formatToolActivityGroup([
			{
				id: "bash-description-absolute-1",
				toolName: "bash",
				args: {
					command: "npm run check",
					description: `Run check in ${cwd}/packages/coding-agent and inspect ${home}/.neo-code`,
				},
				result: { content: [{ type: "text", text: "ok" }], details: { exitCode: 0 } },
				isError: false,
				isPartial: false,
			},
		]);

		expect(text).toContain("Run check in packages/coding-agent and inspect ~/.neo-code");
		expect(text).not.toContain(cwd);
		expect(text).not.toContain(home);
	});
});
