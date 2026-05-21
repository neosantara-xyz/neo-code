import { describe, expect, it } from "vitest";
import {
	createToolApprovalRequest,
	formatToolApprovalDeniedReason,
	getToolApprovalPolicy,
	isSafeToolRequestInsideCwd,
} from "../src/core/tool-approval.js";

describe("tool approval", () => {
	it("asks for mutating tools in default mode but auto-allows read-only tools", () => {
		expect(getToolApprovalPolicy("default", "read")).toBe("auto");
		expect(getToolApprovalPolicy("default", "grep")).toBe("auto");
		expect(getToolApprovalPolicy("default", "find")).toBe("auto");
		expect(getToolApprovalPolicy("default", "ls")).toBe("auto");
		expect(getToolApprovalPolicy("default", "bash")).toBe("ask");
		expect(getToolApprovalPolicy("default", "edit")).toBe("ask");
		expect(getToolApprovalPolicy("default", "write")).toBe("ask");
		expect(getToolApprovalPolicy("plan", "ExitPlanMode")).toBe("ask");
	});

	it("auto-allows read/search/list tools in read-only and plan modes", () => {
		for (const toolName of ["read", "grep", "find", "ls"]) {
			expect(getToolApprovalPolicy("ask", toolName)).toBe("ask");
			expect(getToolApprovalPolicy("read-only", toolName)).toBe("auto");
			expect(getToolApprovalPolicy("plan", toolName)).toBe("auto");
		}
	});

	it("asks before read-only tools inspect outside the workspace", () => {
		const cwd = "/repo/project";

		expect(getToolApprovalPolicy("plan", "read", { path: "src/index.ts" }, cwd)).toBe("auto");
		expect(getToolApprovalPolicy("plan", "grep", { pattern: "token", path: "src" }, cwd)).toBe("auto");
		expect(getToolApprovalPolicy("plan", "ls", { path: "../secrets" }, cwd)).toBe("ask");
		expect(getToolApprovalPolicy("read-only", "read", { path: "/etc/passwd" }, cwd)).toBe("ask");
		expect(isSafeToolRequestInsideCwd("find", { pattern: "*.ts" }, cwd)).toBe(true);
		expect(isSafeToolRequestInsideCwd("find", { pattern: "*.ts", path: "../other" }, cwd)).toBe(false);
	});

	it("matches Claude-style accept-edits by allowing file edits while still asking for bash", () => {
		expect(getToolApprovalPolicy("accept-edits", "edit")).toBe("auto");
		expect(getToolApprovalPolicy("accept-edits", "write")).toBe("auto");
		expect(getToolApprovalPolicy("accept-edits", "read")).toBe("auto");
		expect(getToolApprovalPolicy("accept-edits", "grep")).toBe("auto");
		expect(getToolApprovalPolicy("accept-edits", "find")).toBe("auto");
		expect(getToolApprovalPolicy("accept-edits", "ls")).toBe("auto");
		expect(getToolApprovalPolicy("accept-edits", "bash")).toBe("ask");
	});

	it("uses full mode as the explicit approval bypass", () => {
		expect(getToolApprovalPolicy("full", "bash")).toBe("auto");
		expect(getToolApprovalPolicy("full", "write")).toBe("auto");
		expect(getToolApprovalPolicy("full", "extension_tool")).toBe("auto");
	});

	it("formats stable approval request summaries and denial feedback", () => {
		const request = createToolApprovalRequest({
			mode: "default",
			toolName: "bash",
			toolCallId: "call_1",
			args: { command: "npm test -- --runInBand" },
		});
		expect(request.summary).toBe("$ npm test -- --runInBand");
		expect(request.ruleKey).toBe("bash:npm test -- --runInBand");
		expect(
			formatToolApprovalDeniedReason(request, {
				behavior: "deny",
				feedback: "use read-only inspection",
			}),
		).toContain("use read-only inspection");
	});

	it("uses bash descriptions as approval summaries and keeps the raw command as detail", () => {
		const request = createToolApprovalRequest({
			mode: "default",
			toolName: "bash",
			toolCallId: "call_2",
			args: { command: "npm test -- --runInBand", description: "Run unit tests" },
		});
		expect(request.summary).toBe("Run unit tests");
		expect(request.detail).toBe("$ npm test -- --runInBand");
	});

	it("formats ExitPlanMode approval as a plan handoff", () => {
		const request = createToolApprovalRequest({
			mode: "plan",
			toolName: "ExitPlanMode",
			toolCallId: "call_plan",
			args: { plan: "## Plan\n- Edit src/index.ts\n- Run npm run check" },
		});

		expect(request.summary).toContain("Submit plan");
		expect(request.detail).toContain("Edit src/index.ts");
		expect(request.ruleKey).toBe("ExitPlanMode:*");
	});
});
