import { describe, expect, it } from "vitest";
import { formatUsageQuotaBar, UsageScreenComponent } from "../src/modes/interactive/components/usage-screen.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";

initTheme("dark");

describe("usage screen", () => {
	it("renders grouped quota bars like the model quota screen", () => {
		expect(formatUsageQuotaBar(100)).toBe("███████████ ███████████ ███████████ ███████████ ███████████");
		expect(formatUsageQuotaBar(0)).toBe("░░░░░░░░░░░ ░░░░░░░░░░░ ░░░░░░░░░░░ ░░░░░░░░░░░ ░░░░░░░░░░░");
	});

	it("renders a scrollable Neosantara PAYG usage view", () => {
		let closed = false;
		const component = new UsageScreenComponent(
			{
				version: "0.76.6",
				workspace: "~/repo",
				account: "Neosantara (environment: NEOSANTARA_API_KEY)",
				currentModel: "gemini-3-flash (High)",
				billingMode: "Neosantara PAYG · IDR billing",
				balance: "Rp100.000",
				periodSpend: "Rp25.000",
				sessionTokens: "10,000 tokens",
				sessionCost: "Rp100",
				backendStatus: "connected",
				models: Array.from({ length: 8 }, (_, index) => ({
					id: `model-${index}`,
					displayName: `Model ${index}`,
					providerName: "Neosantara",
					active: index === 0,
					percentAvailable: 100,
					status: "PAYG access available",
					statusKind: "success" as const,
				})),
			},
			() => 18,
			() => {
				closed = true;
			},
		);

		const firstRender = component.render(72).join("\n");
		expect(firstRender).toContain("Neo Code 0.76.6");
		expect(firstRender).toContain("Model Usage");
		expect(firstRender).toContain("PAYG access available");
		expect(firstRender).toContain("Close");

		component.handleInput("\x1b");
		expect(closed).toBe(true);
	});
});
