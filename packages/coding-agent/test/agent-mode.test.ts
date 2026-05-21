import { describe, expect, it } from "vitest";
import {
	DEFAULT_AGENT_WORK_MODE,
	getAgentModePromptAppend,
	getBuiltinToolNamesForAgentMode,
	getNextAgentWorkMode,
	parseAgentWorkMode,
} from "../src/core/agent-mode.js";
import { SettingsManager } from "../src/core/settings-manager.js";

describe("agent workflow modes", () => {
	it("parses canonical names and Claude-style aliases", () => {
		expect(DEFAULT_AGENT_WORK_MODE).toBe("default");
		expect(parseAgentWorkMode("ask")).toBe("ask");
		expect(parseAgentWorkMode("ask-only")).toBe("ask");
		expect(parseAgentWorkMode("readonly")).toBe("read-only");
		expect(parseAgentWorkMode("read_only")).toBe("read-only");
		expect(parseAgentWorkMode("planning")).toBe("plan");
		expect(parseAgentWorkMode("default")).toBe("default");
		expect(parseAgentWorkMode("agent")).toBe("default");
		expect(parseAgentWorkMode("acceptEdits")).toBe("accept-edits");
		expect(parseAgentWorkMode("all")).toBe("full");
		expect(parseAgentWorkMode("unknown")).toBeUndefined();
	});

	it("cycles Claude-style primary modes with Shift+Tab semantics", () => {
		expect(getNextAgentWorkMode("default")).toBe("accept-edits");
		expect(getNextAgentWorkMode("accept-edits")).toBe("plan");
		expect(getNextAgentWorkMode("plan")).toBe("default");
		expect(getNextAgentWorkMode("ask")).toBe("default");
		expect(getNextAgentWorkMode("read-only")).toBe("default");
		expect(getNextAgentWorkMode("full")).toBe("default");
	});

	it("maps restrictive modes to safe built-in tools", () => {
		expect(getBuiltinToolNamesForAgentMode("ask")).toEqual([]);
		expect(getBuiltinToolNamesForAgentMode("read-only")).toEqual(["read", "grep", "find", "ls", "lsp"]);
		expect(getBuiltinToolNamesForAgentMode("plan")).toEqual([
			"read",
			"grep",
			"find",
			"ls",
			"lsp",
			"todo",
			"ExitPlanMode",
		]);
		expect(getBuiltinToolNamesForAgentMode("default")).toEqual([
			"read",
			"grep",
			"find",
			"ls",
			"lsp",
			"todo",
			"agent",
			"mcp",
			"bash",
			"edit",
			"write",
		]);
		expect(getBuiltinToolNamesForAgentMode("accept-edits")).toEqual([
			"read",
			"grep",
			"find",
			"ls",
			"lsp",
			"todo",
			"agent",
			"mcp",
			"bash",
			"edit",
			"write",
		]);
	});

	it("adds mode-specific system prompt guardrails", () => {
		expect(getAgentModePromptAppend("ask")).toContain("No tools are available");
		expect(getAgentModePromptAppend("plan")).toContain("Plan workflow");
		expect(getAgentModePromptAppend("plan")).toContain("MUST NOT modify files");
		expect(getAgentModePromptAppend("plan")).toContain("files to change");
		expect(getAgentModePromptAppend("plan")).toContain("call ExitPlanMode");
		expect(getAgentModePromptAppend("plan")).toContain("Do not repeat identical read/search/list tool calls");
		expect(getAgentModePromptAppend("default")).toContain("read-only tools run without approval");
		expect(getAgentModePromptAppend("default")).toContain("Avoid duplicate tool calls");
		expect(getAgentModePromptAppend("accept-edits")).toContain("without asking");
	});

	it("persists normalized mode in settings", () => {
		const manager = SettingsManager.inMemory({ agentMode: "read_only" as never });
		expect(manager.getAgentMode()).toBe("read-only");
		manager.setAgentMode("plan");
		expect(manager.getAgentMode()).toBe("plan");
	});
});
