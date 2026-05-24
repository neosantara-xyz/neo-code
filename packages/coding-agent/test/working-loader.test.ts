import { describe, expect, it } from "vitest";
import {
	formatDefaultWorkingMessage,
	pickDefaultWorkingMessageIndex,
	shouldAttachSpinnerTipForMode,
} from "../src/modes/interactive/working-loader-state.js";

describe("working loader state", () => {
	it("picks a stable default loading label index from randomness", () => {
		expect(pickDefaultWorkingMessageIndex(4, () => 0)).toBe(0);
		expect(pickDefaultWorkingMessageIndex(4, () => 0.5)).toBe(2);
		expect(pickDefaultWorkingMessageIndex(4, () => 0.999)).toBe(3);
	});

	it("falls back to the first label when the label list is empty", () => {
		expect(pickDefaultWorkingMessageIndex(0, () => 0.5)).toBe(0);
		expect(formatDefaultWorkingMessage([], 3)).toBe("ngulik...");
	});

	it("keeps spinner tips on the response loader only", () => {
		expect(shouldAttachSpinnerTipForMode("responding")).toBe(true);
		expect(shouldAttachSpinnerTipForMode("tool-input")).toBe(false);
		expect(shouldAttachSpinnerTipForMode("tool-use")).toBe(false);
	});
});
