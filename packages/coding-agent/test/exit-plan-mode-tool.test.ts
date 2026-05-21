import { describe, expect, it } from "vitest";
import type { AgentWorkMode } from "../src/core/agent-mode.js";
import { createExitPlanModeToolDefinition } from "../src/core/tools/exit-plan-mode.js";

describe("ExitPlanMode tool", () => {
	it("rejects calls outside plan mode", async () => {
		const tool = createExitPlanModeToolDefinition({
			getCurrentMode: () => "default",
			onApproved: () => "default",
		});

		await expect(
			tool.execute("call_1", { plan: "## Plan" }, undefined, undefined, undefined as never),
		).rejects.toThrow("only available in plan mode");
	});

	it("submits the approved plan and restores the pre-plan mode", async () => {
		let currentMode: AgentWorkMode = "plan";
		const tool = createExitPlanModeToolDefinition({
			getCurrentMode: () => currentMode,
			onApproved: () => {
				currentMode = "accept-edits";
				return currentMode;
			},
		});

		const result = await tool.execute(
			"call_2",
			{
				plan: "## Plan\n- Reuse src/core/agent-mode.ts\n- Run npm run check",
				allowedPrompts: [{ tool: "Bash", prompt: "run validation" }],
			},
			undefined,
			undefined,
			undefined as never,
		);

		expect(currentMode).toBe("accept-edits");
		expect(result.details.restoredMode).toBe("accept-edits");
		expect(result.content[0]?.type).toBe("text");
		expect(result.content[0]?.text).toContain("User approved the plan");
		expect(result.content[0]?.text).toContain("## Approved Plan");
		expect(result.content[0]?.text).toContain("Bash: run validation");
	});
});
