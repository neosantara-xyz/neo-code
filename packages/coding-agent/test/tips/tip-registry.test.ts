import { describe, expect, it } from "vitest";
import type { Settings } from "../../src/core/settings-manager.js";
import { getBuiltinTipIds, getRelevantTips } from "../../src/core/tips/tip-registry.js";
import type { TipContext } from "../../src/core/tips/types.js";

function makeContext(partial: Partial<TipContext> = {}): TipContext {
	return {
		settings: partial.settings ?? ({} as Settings),
		platform: partial.platform ?? "linux",
		isTermux: partial.isTermux ?? false,
		isSshSession: partial.isSshSession ?? false,
		numStartups: partial.numStartups ?? 1,
	};
}

describe("getBuiltinTipIds", () => {
	it("returns a non-empty list with stable ids and no duplicates", () => {
		const ids = getBuiltinTipIds();
		expect(ids.length).toBeGreaterThan(5);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("does not reference vendor-specific Anthropic features", () => {
		const ids = getBuiltinTipIds();
		const banned = ["btw", "passes", "extra-usage", "install-github-app", "install-slack-app", "desktop", "mobile"];
		for (const phrase of banned) {
			expect(ids).not.toContain(phrase);
		}
	});
});

describe("getRelevantTips - context filtering", () => {
	it("keeps the always-relevant /compact tip on a fresh session", () => {
		const tips = getRelevantTips(makeContext({ numStartups: 1 }));
		const ids = tips.map((t) => t.id);
		expect(ids).toContain("compact");
		expect(ids).toContain("at-file");
		expect(ids).toContain("tree");
	});

	it("hides drag-drop and image-paste tips inside SSH sessions", () => {
		const tips = getRelevantTips(makeContext({ isSshSession: true, numStartups: 5 }));
		const ids = tips.map((t) => t.id);
		expect(ids).not.toContain("drag-drop-images");
		expect(ids).not.toContain("image-paste");
	});

	it("hides drag-drop and image-paste tips on Termux but enables /termux-keys", () => {
		const tips = getRelevantTips(makeContext({ isTermux: true, numStartups: 5 }));
		const ids = tips.map((t) => t.id);
		expect(ids).not.toContain("drag-drop-images");
		expect(ids).not.toContain("image-paste");
		expect(ids).toContain("termux-keys");
	});

	it("hides /termux-keys outside Termux", () => {
		const tips = getRelevantTips(makeContext({ isTermux: false, numStartups: 5 }));
		expect(tips.map((t) => t.id)).not.toContain("termux-keys");
	});

	it("withholds advanced tips for first-time users (numStartups <= 1)", () => {
		const tips = getRelevantTips(makeContext({ numStartups: 1 }));
		const ids = tips.map((t) => t.id);
		expect(ids).not.toContain("doctor");
		expect(ids).not.toContain("memory");
		expect(ids).not.toContain("settings");
	});

	it("reveals /doctor and /settings once the user has several sessions", () => {
		const tips = getRelevantTips(makeContext({ numStartups: 12 }));
		const ids = tips.map((t) => t.id);
		expect(ids).toContain("doctor");
		expect(ids).toContain("settings");
	});
});

describe("getRelevantTips - custom tip overrides", () => {
	it("appends custom tips after built-ins by default", () => {
		const settings: Settings = {
			spinnerTipsOverride: { tips: ["my custom tip"] },
		} as Settings;
		const tips = getRelevantTips(makeContext({ settings, numStartups: 5 }));
		const ids = tips.map((t) => t.id);
		expect(ids).toContain("compact");
		expect(ids).toContain("custom-tip-0");
		expect(ids[ids.length - 1]).toBe("custom-tip-0");
	});

	it("excludes built-ins when excludeDefault is true and at least one custom tip is provided", () => {
		const settings: Settings = {
			spinnerTipsOverride: { excludeDefault: true, tips: ["only this", "and this"] },
		} as Settings;
		const tips = getRelevantTips(makeContext({ settings, numStartups: 5 }));
		expect(tips.map((t) => t.id)).toEqual(["custom-tip-0", "custom-tip-1"]);
		expect(tips.every((t) => t.cooldownSessions === 0)).toBe(true);
	});

	it("falls back to built-ins when excludeDefault is true but tips are empty", () => {
		const settings: Settings = {
			spinnerTipsOverride: { excludeDefault: true, tips: [] },
		} as Settings;
		const tips = getRelevantTips(makeContext({ settings, numStartups: 5 }));
		expect(tips.length).toBeGreaterThan(0);
		expect(tips.some((t) => t.id.startsWith("custom-tip-"))).toBe(false);
	});

	it("trims whitespace and skips empty / non-string custom entries", () => {
		const settings: Settings = {
			spinnerTipsOverride: {
				tips: ["  spaced  ", "", "   ", "valid"],
			},
		} as Settings;
		const tips = getRelevantTips(makeContext({ settings, numStartups: 5 }));
		const customs = tips.filter((t) => t.id.startsWith("custom-tip-"));
		const ids = customs.map((t) => t.id);
		// indices preserved from original order, dropped entries are skipped
		expect(ids).toEqual(["custom-tip-0", "custom-tip-3"]);
		expect(customs.find((t) => t.id === "custom-tip-0")?.content).toBe("spaced");
	});
});
