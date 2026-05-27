import { beforeAll, describe, expect, it } from "vitest";
import { TranscriptPagerComponent } from "../src/modes/interactive/components/transcript-pager.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";
import { stripAnsi } from "../src/utils/ansi.js";

function renderPlain(component: TranscriptPagerComponent, width = 64): string[] {
	return component.render(width).map((line) => stripAnsi(line).trimEnd());
}

describe("TranscriptPagerComponent", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	it("renders Codex-style transcript pager chrome", () => {
		const component = new TranscriptPagerComponent(
			"T R A N S C R I P T",
			() => ["one", "two"],
			() => 8,
			() => {},
		);

		const lines = renderPlain(component);

		expect(lines[0]).toContain("/ T R A N S C R I P T");
		expect(lines).toContain("one");
		expect(lines.some((line) => line.startsWith("~"))).toBe(true);
		expect(lines.some((line) => line.includes("100%"))).toBe(true);
		expect(lines.join("\n")).toContain("up/down to scroll");
		expect(lines.join("\n")).toContain("q/Ctrl+T to quit");
	});

	it("supports Codex-style scroll keys and Ctrl+T close", () => {
		let closed = false;
		const component = new TranscriptPagerComponent(
			"T R A N S C R I P T",
			() => Array.from({ length: 12 }, (_, index) => `line-${index + 1}`),
			() => 8,
			() => {
				closed = true;
			},
		);

		expect(renderPlain(component).join("\n")).toContain("line-12");

		component.handleInput("k");
		expect(renderPlain(component).join("\n")).toContain("line-9");

		component.handleInput("j");
		expect(renderPlain(component).join("\n")).toContain("line-12");

		component.handleInput("\x14");
		expect(closed).toBe(true);
	});
});
