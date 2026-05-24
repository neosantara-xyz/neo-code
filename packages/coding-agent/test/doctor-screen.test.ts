import { describe, expect, it } from "vitest";
import { DoctorScreenComponent } from "../src/modes/interactive/components/doctor-screen.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";

initTheme("dark");

describe("doctor screen", () => {
	it("renders sections with an aggregate summary across all checks", () => {
		let closed = false;
		const component = new DoctorScreenComponent(
			{
				version: "0.76.6",
				sections: [
					{
						title: "Runtime",
						lines: [
							{ label: "Node", status: "ok", detail: "v24.13.0" },
							{ label: "Workspace", status: "ok", detail: "/repo" },
						],
					},
					{
						title: "Local tools",
						lines: [
							{ label: "git", status: "ok", detail: "git version 2.53" },
							{ label: "rg", status: "warn", detail: "not found" },
						],
					},
					{
						title: "Termux",
						lines: [{ label: "Touch keys", status: "warn", detail: "not configured" }],
					},
				],
				summary: { errors: 0, warnings: 2 },
				resourceDiagnostics: [],
				tip: "Use /status for account/model summary.",
			},
			() => 30,
			() => {
				closed = true;
			},
		);

		const out = component.render(72).join("\n");
		expect(out).toContain("Neo Code Doctor");
		expect(out).toContain("Summary");
		expect(out).toContain("0 errors, 2 warnings");
		expect(out).toContain("Runtime");
		expect(out).toContain("Local tools");
		expect(out).toContain("Termux");
		expect(out).toContain("not configured");

		component.handleInput("\x1b");
		expect(closed).toBe(true);
	});

	it("escalates summary marker to error when any line fails", () => {
		const component = new DoctorScreenComponent(
			{
				version: "0.0.1",
				sections: [
					{
						title: "Provider",
						lines: [{ label: "Model", status: "fail", detail: "not selected" }],
					},
				],
				summary: { errors: 1, warnings: 0 },
				resourceDiagnostics: [{ type: "error", message: "broken skill", path: "/x.md" }],
			},
			() => 20,
			() => {},
		);
		const out = component.render(60).join("\n");
		expect(out).toContain("1 errors, 0 warnings");
		expect(out).toContain("broken skill");
		expect(out).toContain("/x.md");
	});
});
