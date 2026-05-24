import { describe, expect, it } from "vitest";
import { InMemorySettingsStorage, SettingsManager } from "../src/core/settings-manager.js";

describe("SettingsManager", () => {
	it("returns effective settings merged across global and project scopes", () => {
		const storage = new InMemorySettingsStorage();
		storage.withLock("global", () =>
			JSON.stringify({
				spinnerTipsEnabled: true,
				spinnerTipsOverride: { tips: ["global tip"] },
			}),
		);
		storage.withLock("project", () =>
			JSON.stringify({
				spinnerTipsOverride: { excludeDefault: true, tips: ["project tip"] },
			}),
		);

		const settings = SettingsManager.fromStorage(storage).getSettings();

		expect(settings.spinnerTipsEnabled).toBe(true);
		expect(settings.spinnerTipsOverride).toEqual({
			excludeDefault: true,
			tips: ["project tip"],
		});
	});
});
