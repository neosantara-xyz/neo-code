import { describe, expect, it } from "vitest";
import { formatContextFooterSegment } from "../src/modes/interactive/components/footer.js";

describe("footer context status", () => {
	it("labels the current API context separately from cumulative session tokens", () => {
		expect(formatContextFooterSegment(13.4, 1_000_000, true)).toEqual({
			text: "ctx 13%/1.0M · auto",
			severity: "ok",
		});
	});

	it("can show active post-compact tokens before the context window", () => {
		expect(formatContextFooterSegment(13.4, 1_000_000, true, 134_000)).toEqual({
			text: "ctx 134k/1.0M (13%) · auto",
			severity: "ok",
		});
	});

	it("marks unknown post-compaction usage as an explicit context state", () => {
		expect(formatContextFooterSegment(null, 1_000_000, true)).toEqual({
			text: "ctx ?/1.0M · auto",
			severity: "warning",
		});
	});

	it("uses warning and error severity for high current context", () => {
		expect(formatContextFooterSegment(70, 1_000_000, false)).toEqual({
			text: "ctx 70%/1.0M · manual",
			severity: "warning",
		});
		expect(formatContextFooterSegment(90, 1_000_000, true)).toEqual({
			text: "ctx 90%/1.0M · auto",
			severity: "error",
		});
	});
});
