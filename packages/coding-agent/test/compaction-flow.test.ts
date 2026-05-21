import type { AssistantMessage } from "@neosantara/ai";
import { describe, expect, it } from "vitest";
import {
	calculateContextTokens,
	estimateRawContextTokens,
	getAutoCompactTriggerTokens,
	shouldCompact,
} from "../src/core/compaction/index.js";

const settings = {
	enabled: true,
	reserveTokens: 16_384,
	keepRecentTokens: 20_000,
};

describe("compaction flow thresholds", () => {
	it("reserves output room plus an auto-compact buffer", () => {
		expect(getAutoCompactTriggerTokens(128_000, settings, 8_192)).toBe(106_808);
		expect(shouldCompact(106_807, 128_000, settings, 8_192)).toBe(false);
		expect(shouldCompact(106_808, 128_000, settings, 8_192)).toBe(true);
	});

	it("caps large model output reserve so huge-output models do not compact too early", () => {
		expect(getAutoCompactTriggerTokens(1_000_000, settings, 128_000)).toBe(967_000);
	});

	it("keeps the user configured reserve as the lower bound", () => {
		expect(getAutoCompactTriggerTokens(128_000, settings, 1_024)).toBe(111_616);
	});

	it("does not compact when disabled", () => {
		expect(shouldCompact(1_000_000, 128_000, { ...settings, enabled: false }, 8_192)).toBe(false);
	});
});

describe("post-compact context estimates", () => {
	it("ignores stale assistant usage from kept pre-compact messages", () => {
		const assistant: AssistantMessage = {
			role: "assistant",
			provider: "neosantara",
			model: "test-model",
			content: [{ type: "text", text: "small kept answer" }],
			stopReason: "stop",
			usage: {
				input: 900_000,
				output: 10_000,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 910_000,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			timestamp: Date.now(),
		};

		expect(calculateContextTokens(assistant.usage)).toBe(910_000);
		expect(estimateRawContextTokens([assistant])).toBeLessThan(20);
	});
});
