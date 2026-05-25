import { describe, expect, it } from "vitest";
import type { Settings } from "../../src/core/settings-manager.js";
import { InMemoryTipHistoryStore } from "../../src/core/tips/tip-history.js";
import {
	CONTEXT_TIP_URGENT_PERCENT,
	CONTEXT_TIP_WARNING_PERCENT,
	pickContextOverrideTip,
	pickTipForTurn,
	recordShownTip,
} from "../../src/core/tips/tip-scheduler.js";
import type { TipContext } from "../../src/core/tips/types.js";

function makeContext(partial: Partial<TipContext> = {}): TipContext {
	return {
		settings: partial.settings ?? ({} as Settings),
		platform: partial.platform ?? "linux",
		isTermux: partial.isTermux ?? false,
		termuxApiAvailable: partial.termuxApiAvailable ?? false,
		isSshSession: partial.isSshSession ?? false,
		numStartups: partial.numStartups ?? 1,
		contextPercent: partial.contextPercent,
	};
}

describe("pickTipForTurn", () => {
	it("returns undefined when spinnerTipsEnabled is explicitly false", () => {
		const ctx = makeContext({
			settings: { spinnerTipsEnabled: false } as Settings,
			numStartups: 5,
		});
		const history = new InMemoryTipHistoryStore({ numStartups: 5 });
		expect(pickTipForTurn(ctx, history)).toBeUndefined();
	});

	it("returns a built-in tip on a brand-new session", () => {
		const ctx = makeContext({ numStartups: 1 });
		const history = new InMemoryTipHistoryStore({ numStartups: 1 });
		const tip = pickTipForTurn(ctx, history);
		expect(tip).toBeDefined();
		expect(tip?.content.length).toBeGreaterThan(0);
	});

	it("prefers tips that have never been shown over recently shown ones", () => {
		const ctx = makeContext({ numStartups: 10 });
		const history = new InMemoryTipHistoryStore({
			numStartups: 10,
			history: { compact: 9, "at-file": 9, tree: 9, shortcuts: 9 },
		});
		const tip = pickTipForTurn(ctx, history);
		expect(tip).toBeDefined();
		// Tips that have never been shown should win because their gap is Infinity
		expect(["compact", "at-file", "tree", "shortcuts"]).not.toContain(tip!.id);
	});

	it("respects per-tip cooldown sessions", () => {
		const ctx = makeContext({ numStartups: 3 });
		const settings: Settings = {
			spinnerTipsOverride: { excludeDefault: true, tips: ["only-tip"] },
		} as Settings;
		const ctxWithCustom = makeContext({ settings, numStartups: 3 });
		const history = new InMemoryTipHistoryStore({ numStartups: 3 });
		// custom-tip-0 has cooldownSessions=0 so it should always be selectable
		const first = pickTipForTurn(ctxWithCustom, history);
		expect(first?.id).toBe("custom-tip-0");
		recordShownTip(first!, history);
		// Even after recording, with cooldown 0, it remains eligible
		const again = pickTipForTurn(ctxWithCustom, history);
		expect(again?.id).toBe("custom-tip-0");
		void ctx;
	});

	it("filters out tips still in cooldown and falls back to others", () => {
		const ctx = makeContext({ numStartups: 1 });
		const history = new InMemoryTipHistoryStore({
			numStartups: 1,
			history: { compact: 1 },
		});
		// /compact has cooldownSessions=5, just shown at startup 1, so its
		// gap is 0 which is less than 5, so it should be filtered out.
		const tip = pickTipForTurn(ctx, history);
		expect(tip).toBeDefined();
		expect(tip?.id).not.toBe("compact");
	});

	it("returns undefined when every relevant tip is in cooldown", () => {
		const ctx = makeContext({ numStartups: 1 });
		// Build a history where every built-in tip was just shown
		const seedHistory: Record<string, number> = {};
		const allTipIds = [
			"compact",
			"at-file",
			"tree",
			"shortcuts",
			"todo",
			"model",
			"agents",
			"skills",
			"mcp",
			"drag-drop-images",
			"image-paste",
			"termux-keys",
			"resume",
			"shift-tab-mode",
			"settings",
			"memory",
			"doctor",
			"usage",
		];
		for (const id of allTipIds) {
			seedHistory[id] = 1;
		}
		const history = new InMemoryTipHistoryStore({ numStartups: 1, history: seedHistory });
		expect(pickTipForTurn(ctx, history)).toBeUndefined();
	});

	it("applies relevance + cooldown together (Termux-only tip)", () => {
		const ctx = makeContext({ isTermux: true, numStartups: 6 });
		const history = new InMemoryTipHistoryStore({ numStartups: 6, history: { "termux-keys": 5 } });
		const tip = pickTipForTurn(ctx, history);
		// termux-keys has cooldown 6 and gap=1, so it is filtered out
		expect(tip?.id).not.toBe("termux-keys");
	});

	it("custom tips with override.excludeDefault eliminate built-ins entirely", () => {
		const settings: Settings = {
			spinnerTipsOverride: { excludeDefault: true, tips: ["a", "b"] },
		} as Settings;
		const ctx = makeContext({ settings, numStartups: 5 });
		const history = new InMemoryTipHistoryStore({ numStartups: 5 });
		const seen = new Set<string>();
		// Simulate several sessions: each iteration represents a turn that
		// records the picked tip and advances the startup counter.
		for (let i = 0; i < 8; i++) {
			const tip = pickTipForTurn(ctx, history);
			if (tip) {
				seen.add(tip.id);
				recordShownTip(tip, history);
			}
			history.bumpNumStartups();
		}
		expect([...seen].sort()).toEqual(["custom-tip-0", "custom-tip-1"]);
	});
});

describe("recordShownTip", () => {
	it("delegates to history.recordShown for the tip id", () => {
		const ctx = makeContext({ numStartups: 7 });
		const history = new InMemoryTipHistoryStore({ numStartups: 7 });
		const tip = pickTipForTurn(ctx, history);
		expect(tip).toBeDefined();
		recordShownTip(tip!, history);
		expect(history.getSessionsSinceLastShown(tip!.id)).toBe(0);
	});
});

describe("pickContextOverrideTip", () => {
	it("returns undefined when contextPercent is missing", () => {
		const ctx = makeContext({ numStartups: 5 });
		expect(pickContextOverrideTip(ctx)).toBeUndefined();
	});

	it("returns undefined when context is below the warning threshold", () => {
		const ctx = makeContext({ numStartups: 5, contextPercent: CONTEXT_TIP_WARNING_PERCENT - 0.1 });
		expect(pickContextOverrideTip(ctx)).toBeUndefined();
	});

	it("returns the warning tip at the warning threshold", () => {
		const ctx = makeContext({ numStartups: 5, contextPercent: CONTEXT_TIP_WARNING_PERCENT });
		const tip = pickContextOverrideTip(ctx);
		expect(tip).toBeDefined();
		expect(tip!.id).toBe("high-context-warning");
		expect(tip!.content).toContain("/compact");
		expect(tip!.cooldownSessions).toBe(0);
	});

	it("escalates to the urgent tip at the urgent threshold", () => {
		const ctx = makeContext({ numStartups: 5, contextPercent: CONTEXT_TIP_URGENT_PERCENT });
		const tip = pickContextOverrideTip(ctx);
		expect(tip).toBeDefined();
		expect(tip!.id).toBe("urgent-context-warning");
		expect(tip!.content).toContain("urgent");
	});

	it("returns undefined when spinnerTipsEnabled is explicitly false even at high context", () => {
		const ctx = makeContext({
			settings: { spinnerTipsEnabled: false } as Settings,
			numStartups: 5,
			contextPercent: 95,
		});
		expect(pickContextOverrideTip(ctx)).toBeUndefined();
	});

	it("never gets recorded so it can re-fire every turn", () => {
		const ctx = makeContext({ numStartups: 5, contextPercent: 80 });
		const history = new InMemoryTipHistoryStore({ numStartups: 5 });
		const first = pickContextOverrideTip(ctx);
		const second = pickContextOverrideTip(ctx);
		expect(first?.id).toBe(second?.id);
		// Sanity: pickContextOverrideTip is independent from pickTipForTurn,
		// so recording an override tip should not block the regular pick.
		recordShownTip(first!, history);
		expect(pickTipForTurn(ctx, history)).toBeDefined();
	});
});
