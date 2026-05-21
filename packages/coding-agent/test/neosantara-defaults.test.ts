import { describe, expect, it } from "vitest";
import { defaultModelPerProvider } from "../src/core/model-resolver.js";
import { BUILT_IN_PROVIDER_DISPLAY_NAMES } from "../src/core/provider-display-names.js";

describe("Neosantara coding-agent defaults", () => {
	it("uses Neosantara as the only built-in provider default", () => {
		expect(defaultModelPerProvider).toEqual({
			neosantara: "grok-4.1-fast-reasoning",
		});
	});

	it("has a provider display name", () => {
		expect(BUILT_IN_PROVIDER_DISPLAY_NAMES.neosantara).toBe("Neosantara");
	});
});
