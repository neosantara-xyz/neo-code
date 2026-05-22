import { describe, expect, it } from "vitest";
import { getExitPlanModePlan, type ToolApprovalDecision } from "../src/core/tool-approval.js";

describe("ToolApprovalDecision plan-handoff fields", () => {
	it("accepts forkAfterApproval alongside the existing nextMode field", () => {
		// This is primarily a TS-level guard. Capturing the shape here makes
		// downstream changes that drop `forkAfterApproval` an immediate
		// failure instead of a silent regression in the plan-handoff popup.
		const decision: ToolApprovalDecision = {
			behavior: "allow",
			scope: "once",
			nextMode: "default",
			forkAfterApproval: true,
		};
		expect(decision.behavior).toBe("allow");
		expect(decision.nextMode).toBe("default");
		expect(decision.forkAfterApproval).toBe(true);
	});

	it("treats forkAfterApproval as optional", () => {
		const decision: ToolApprovalDecision = { behavior: "allow", scope: "once", nextMode: "accept-edits" };
		expect(decision.forkAfterApproval).toBeUndefined();
	});
});

describe("getExitPlanModePlan", () => {
	it("returns the plan string when present", () => {
		expect(getExitPlanModePlan({ plan: "step 1\nstep 2" })).toBe("step 1\nstep 2");
	});

	it("trims whitespace around the plan", () => {
		expect(getExitPlanModePlan({ plan: "  trimmed plan  " })).toBe("trimmed plan");
	});

	it("returns undefined when args is not an object or lacks a plan field", () => {
		expect(getExitPlanModePlan(undefined)).toBeUndefined();
		expect(getExitPlanModePlan(null)).toBeUndefined();
		expect(getExitPlanModePlan("not an object")).toBeUndefined();
		expect(getExitPlanModePlan({ other: "field" })).toBeUndefined();
	});

	it("ignores empty plan strings", () => {
		expect(getExitPlanModePlan({ plan: "" })).toBeUndefined();
		expect(getExitPlanModePlan({ plan: "   " })).toBeUndefined();
	});
});
