import { setKeybindings } from "@neosantara/tui";
import { beforeAll, describe, expect, it } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.js";
import {
	COMPACT_FOOTER_WIDTH,
	formatContextFooterSegment,
	formatFooterHint,
	renderShortcutOverlay,
} from "../src/modes/interactive/components/footer.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";

describe("compact footer formatters", () => {
	beforeAll(() => {
		initTheme("dark");
		setKeybindings(new KeybindingsManager());
	});

	it("exports a sensible narrow-terminal threshold", () => {
		expect(COMPACT_FOOTER_WIDTH).toBeGreaterThan(40);
		expect(COMPACT_FOOTER_WIDTH).toBeLessThan(120);
	});

	it("collapses the context segment in compact mode", () => {
		const wide = formatContextFooterSegment(45, 200_000, true, 90_000, false);
		const narrow = formatContextFooterSegment(45, 200_000, true, 90_000, true);
		// Wide form includes both the absolute token count and the "auto" / "manual" suffix.
		expect(wide.text).toContain("90k");
		expect(wide.text).toContain("auto");
		// Compact form drops both: just `pct/window` is left.
		expect(narrow.text).not.toContain("auto");
		expect(narrow.text).not.toContain("90k");
		expect(narrow.text).toMatch(/^ctx \d+%\/200k$/);
		expect(narrow.severity).toBe(wide.severity);
	});

	it("collapses missing-percent context to a short ?/window form", () => {
		const narrow = formatContextFooterSegment(null, 128_000, false, null, true);
		expect(narrow.text).toBe("ctx ?/128k");
		expect(narrow.severity).toBe("warning");
	});

	it("preserves the existing wide format when compact=false", () => {
		const wide = formatContextFooterSegment(12, 200_000, false, 24_000);
		expect(wide.text).toContain("manual");
		expect(wide.text).toContain("12%");
	});

	it("uses a single-character hint when compact=true", () => {
		const narrow = formatFooterHint(false, false, true);
		expect(narrow).toBe("?");
	});

	it("keeps the verbose hint when compact=false", () => {
		const wide = formatFooterHint(false, true);
		expect(wide).toContain("shortcuts");
		expect(wide).toContain("/tasks");
	});

	it("uses a stop hint while streaming in compact mode", () => {
		const narrow = formatFooterHint(true, false, true);
		expect(narrow).toContain("stop");
	});

	it("promotes the Codex-style transcript shortcut in the shortcut overlay", () => {
		const rendered = renderShortcutOverlay(100).join("\n");
		expect(rendered).toContain("Ctrl+T");
		expect(rendered).toContain("view transcript");
	});
});
