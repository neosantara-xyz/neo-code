import { describe, expect, it } from "vitest";
import { UsageScreenComponent } from "../src/modes/interactive/components/usage-screen.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";

initTheme("dark");

describe("usage screen", () => {
	it("renders the Neosantara PAYG account view without per-model breakdown", () => {
		let closed = false;
		const component = new UsageScreenComponent(
			{
				version: "0.76.6",
				workspace: "~/repo",
				account: "Neosantara (environment: NEOSANTARA_API_KEY)",
				currentModel: "gemini-3-flash (High)",
				billingMode: "Neosantara PAYG · IDR",
				balance: "Rp100.000",
				periodSpend: "Rp25.000",
				sessionTokens: "10,000 tokens",
				sessionCost: "Rp100",
				sessionDuration: "15s",
				backendStatus: "connected",
			},
			() => 18,
			() => {
				closed = true;
			},
		);

		const firstRender = component.render(72).join("\n");
		expect(firstRender).toContain("Neo Code 0.76.6");
		expect(firstRender).toContain("Account billing");
		expect(firstRender).toContain("Current session");
		expect(firstRender).not.toContain("▄▀▀▄");
		expect(firstRender).not.toContain("Model Usage");
		expect(firstRender).toContain("Close");

		component.handleInput("\x1b");
		expect(closed).toBe(true);
	});
});
