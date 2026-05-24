import { describe, expect, it } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.js";

describe("coding agent keybindings", () => {
	it("uses Shift+Tab for Claude-style mode cycling", () => {
		const keybindings = new KeybindingsManager();

		expect(keybindings.getKeys("app.mode.cycle")).toEqual(["shift+tab"]);
		expect(keybindings.matches("\x1b[Z", "app.mode.cycle")).toBe(true);
		expect(keybindings.matches("\x1b[Z", "app.thinking.cycle")).toBe(false);
	});

	it("keeps thinking level cycling configurable on a separate default shortcut", () => {
		const keybindings = new KeybindingsManager();

		expect(keybindings.getKeys("app.thinking.cycle")).toEqual(["alt+t"]);
		expect(keybindings.matches("\x1bt", "app.thinking.cycle")).toBe(true);
	});

	it("uses Ctrl+T for Codex-style transcript viewing while keeping Ctrl+O as expand alias", () => {
		const keybindings = new KeybindingsManager();

		expect(keybindings.getKeys("app.transcript.view")).toEqual(["ctrl+t"]);
		expect(keybindings.matches("\x14", "app.transcript.view")).toBe(true);
		expect(keybindings.getKeys("app.tools.expand")).toEqual(["ctrl+o"]);
		expect(keybindings.matches("\x0f", "app.tools.expand")).toBe(true);
		expect(keybindings.matches("\x14", "app.thinking.toggle")).toBe(false);
	});
});
