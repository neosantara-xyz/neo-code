import { describe, expect, it } from "vitest";
import { InMemorySettingsStorage, SettingsManager } from "../src/core/settings-manager.js";

describe("termux notification settings", () => {
	it("is disabled by default with sane fallback values", () => {
		const manager = SettingsManager.inMemory();
		const cfg = manager.getTermuxNotificationSettings();
		expect(cfg.enabled).toBe(false);
		expect(cfg.minDurationMs).toBe(30_000);
		expect(cfg.vibrate).toBe(false);
		expect(cfg.sound).toBe(false);
	});

	it("setTermuxNotificationsEnabled toggles the flag and defaults vibrate to true", () => {
		const manager = SettingsManager.inMemory();
		manager.setTermuxNotificationsEnabled(true);
		const cfg = manager.getTermuxNotificationSettings();
		expect(cfg.enabled).toBe(true);
		expect(cfg.vibrate).toBe(true);
	});

	it("respects user-provided minDurationMs and vibrate overrides", () => {
		const manager = SettingsManager.inMemory({
			notifications: {
				termux: { enabled: true, minDurationMs: 60_000, vibrate: false, sound: true },
			},
		});
		const cfg = manager.getTermuxNotificationSettings();
		expect(cfg.enabled).toBe(true);
		expect(cfg.minDurationMs).toBe(60_000);
		expect(cfg.vibrate).toBe(false);
		expect(cfg.sound).toBe(true);
	});

	it("deeply merges Termux notification settings across scopes", () => {
		const storage = new InMemorySettingsStorage();
		storage.withLock("global", () =>
			JSON.stringify({
				notifications: {
					termux: { enabled: true, minDurationMs: 60_000, vibrate: false, sound: true },
				},
			}),
		);
		storage.withLock("project", () =>
			JSON.stringify({
				notifications: {
					termux: { minDurationMs: 10_000 },
				},
			}),
		);

		const cfg = SettingsManager.fromStorage(storage).getTermuxNotificationSettings();

		expect(cfg).toEqual({
			enabled: true,
			minDurationMs: 10_000,
			vibrate: false,
			sound: true,
		});
	});

	it("sanitizes invalid minDurationMs values", () => {
		const storage = new InMemorySettingsStorage();
		storage.withLock("global", () =>
			JSON.stringify({
				notifications: {
					termux: { enabled: true, minDurationMs: "soon" },
				},
			}),
		);
		const manager = SettingsManager.fromStorage(storage);

		expect(manager.getTermuxNotificationSettings().minDurationMs).toBe(30_000);
	});

	it("clamps negative minDurationMs values", () => {
		const manager = SettingsManager.inMemory({
			notifications: {
				termux: { enabled: true, minDurationMs: -1 },
			},
		});

		expect(manager.getTermuxNotificationSettings().minDurationMs).toBe(0);
	});
});
