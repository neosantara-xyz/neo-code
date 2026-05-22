import { beforeAll, describe, expect, it } from "vitest";
import type { ToolApprovalDecision, ToolApprovalRequest } from "../src/core/tool-approval.js";
import { ToolApprovalRequestComponent } from "../src/modes/interactive/components/tool-approval-request.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";
import { stripAnsi } from "../src/utils/ansi.js";

function createRequest(overrides: Partial<ToolApprovalRequest> = {}): ToolApprovalRequest {
	return {
		mode: "default",
		toolName: "bash",
		toolCallId: "call_approval",
		args: { command: "npm run check", description: "Run validation" },
		risk: "command",
		summary: "Run validation",
		detail: "$ npm run check",
		ruleKey: "bash:npm run check",
		...overrides,
	};
}

function renderPlain(component: ToolApprovalRequestComponent): string {
	return component
		.render(100)
		.map((line) => stripAnsi(line).trimEnd())
		.join("\n");
}

describe("tool approval request component", () => {
	beforeAll(() => {
		initTheme("dark");
	});
	it("renders a focused interactive approval card instead of textarea instructions", () => {
		const component = new ToolApprovalRequestComponent(createRequest());
		const rendered = renderPlain(component);

		expect(rendered).toContain("Neo wants to run a command");
		expect(rendered).toContain("PERMISSION · command · default mode");
		expect(rendered).toContain("› 1. Allow once");
		expect(rendered).toContain("2. Allow command for session");
		expect(rendered).toContain("3. Deny");
		expect(rendered).toContain("4. Deny with feedback");
		expect(rendered).toContain("Do you want to proceed?");
		expect(rendered).toContain("↑/↓ select · Enter confirm");
		expect(rendered).not.toContain("Type: deny:");
		expect(rendered).not.toContain("Permission prompt expects");
	});

	it("shows write content directly in the permission card", () => {
		const component = new ToolApprovalRequestComponent(
			createRequest({
				toolName: "write",
				risk: "write",
				args: {
					path: "src/new-file.ts",
					content: "export const answer = 42;\nconsole.log(answer);\n",
				},
				summary: "Write src/new-file.ts",
				detail: 'path: "src/new-file.ts"',
				ruleKey: "write:src/new-file.ts",
			}),
		);

		const rendered = renderPlain(component);

		expect(rendered).toContain("Neo wants to write a file");
		expect(rendered).toContain("Diff Neo wants to write:");
		expect(rendered).toContain("write preview: 2 lines");
		expect(rendered).toContain("target: src/new-file.ts");
		expect(rendered).toContain("+ export const answer = 42;");
		expect(rendered).toContain("+ console.log(answer);");
		expect(rendered).toContain("1. Allow once");
	});

	it("shows edit replacement details directly in the permission card", () => {
		const component = new ToolApprovalRequestComponent(
			createRequest({
				toolName: "edit",
				risk: "write",
				args: {
					path: "src/app.ts",
					edits: [{ oldText: 'const mode = "old";', newText: 'const mode = "new";' }],
				},
				summary: "Edit src/app.ts",
				detail: 'path: "src/app.ts"',
				ruleKey: "edit:src/app.ts",
			}),
		);

		const rendered = renderPlain(component);

		expect(rendered).toContain("Neo wants to edit a file");
		expect(rendered).toContain("Diff Neo wants to apply:");
		expect(rendered).toContain("edit preview: 1 replacement");
		expect(rendered).toContain("remove:");
		expect(rendered).toContain('- const mode = "old";');
		expect(rendered).toContain("add:");
		expect(rendered).toContain('+ const mode = "new";');
		expect(rendered).toContain("1. Allow once");
	});

	it("emits quick-key approval decisions without requiring prompt submission", () => {
		const decisions: ToolApprovalDecision[] = [];
		const component = new ToolApprovalRequestComponent(createRequest(), (decision) => {
			decisions.push(decision);
		});

		component.handleInput("2");

		expect(decisions).toEqual([{ behavior: "allow", scope: "session" }]);
	});

	it("supports arrow selection followed by enter confirm", () => {
		const decisions: ToolApprovalDecision[] = [];
		const component = new ToolApprovalRequestComponent(createRequest(), (decision) => {
			decisions.push(decision);
		});

		component.handleInput("\x1b[B");
		component.handleInput("\r");

		expect(decisions).toEqual([{ behavior: "allow", scope: "session" }]);
	});

	it("captures deny feedback inline inside the approval card", () => {
		const decisions: ToolApprovalDecision[] = [];
		const component = new ToolApprovalRequestComponent(createRequest(), (decision) => {
			decisions.push(decision);
		});

		component.handleInput("4");
		for (const char of "use read-only checks") {
			component.handleInput(char);
		}

		expect(renderPlain(component)).toContain("No, and tell Neo: use read-only checks");

		component.handleInput("\r");

		expect(decisions).toEqual([{ behavior: "deny", feedback: "use read-only checks" }]);
	});

	it("renders ExitPlanMode as a plan approval card", () => {
		const component = new ToolApprovalRequestComponent(
			createRequest({
				mode: "plan",
				toolName: "ExitPlanMode",
				risk: "extension",
				summary: "Submit plan: update approval flow",
				detail: "## Plan\n- Update approval flow",
				ruleKey: "ExitPlanMode:*",
			}),
		);

		const rendered = renderPlain(component);

		expect(rendered).toContain("Ready to code?");
		expect(rendered).toContain("PERMISSION · plan approval · plan mode");
		expect(rendered).toContain("Here is Neo's plan:");
		expect(rendered).toContain("## Plan");
		expect(rendered).toContain("Neo has written up a plan and is ready to execute.");
		expect(rendered).toContain("Would you like to proceed?");
		expect(rendered).toContain("1. Yes, auto-accept edits");
		expect(rendered).toContain("2. Yes, manually approve edits");
		expect(rendered).toContain("3. Yes, fork to fresh context");
		expect(rendered).toContain("4. No, keep planning");
	});

	it("keeps ExitPlanMode actions visible for long plans", () => {
		const longPlan = Array.from({ length: 18 }, (_, index) => `- Step ${index + 1}`).join("\n");
		const component = new ToolApprovalRequestComponent(
			createRequest({
				mode: "plan",
				toolName: "ExitPlanMode",
				risk: "extension",
				summary: "Submit plan: long plan",
				detail: `## Plan\n${longPlan}`,
				ruleKey: "ExitPlanMode:*",
			}),
		);

		const rendered = renderPlain(component);

		expect(rendered).toContain("actions stay below");
		expect(rendered).toContain("1. Yes, auto-accept edits");
		expect(rendered).toContain("2. Yes, manually approve edits");
		expect(rendered).toContain("3. Yes, fork to fresh context");
		expect(rendered).toContain("4. No, keep planning");
	});

	it("emits ExitPlanMode approval mode choices", () => {
		const decisions: ToolApprovalDecision[] = [];
		const component = new ToolApprovalRequestComponent(
			createRequest({
				mode: "plan",
				toolName: "ExitPlanMode",
				risk: "extension",
				summary: "Submit plan: update approval flow",
				detail: "## Plan\n- Update approval flow",
				ruleKey: "ExitPlanMode:*",
			}),
			(decision) => {
				decisions.push(decision);
			},
		);

		component.handleInput("1");

		expect(decisions).toEqual([{ behavior: "allow", scope: "once", nextMode: "accept-edits" }]);
	});

	it("renders resolved approvals as static transcript cards with no active choices", () => {
		const component = new ToolApprovalRequestComponent(createRequest());

		component.resolve({ behavior: "allow", scope: "once" });
		const rendered = renderPlain(component);

		expect(rendered).toContain("ALLOWED · command · default mode");
		expect(rendered).toContain("✓ allowed once");
		expect(rendered).not.toContain("1. Allow once");
		expect(rendered).not.toContain("↑/↓ select");
	});
});
