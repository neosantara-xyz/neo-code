import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	applyNeoTermuxTouchKeyboard,
	getTermuxPropertiesPath,
	getTermuxTouchKeyboardStatus,
	NEO_TERMUX_EXTRA_KEYS,
	replaceTermuxExtraKeysProperty,
	restoreLatestTermuxTouchKeyboardBackup,
} from "../src/core/termux-touch-keyboard.js";

describe("Termux touch keyboard", () => {
	it("replaces an existing extra-keys property without duplicating it", () => {
		const updated = replaceTermuxExtraKeysProperty(
			"bell-character=ignore\nextra-keys = [['ESC']]\nuse-black-ui=true\n",
		);
		expect(updated).toContain(`extra-keys = ${NEO_TERMUX_EXTRA_KEYS}`);
		expect(updated.match(/^extra-keys\s*=/gm)).toHaveLength(1);
		expect(updated).toContain("bell-character=ignore");
		expect(updated).toContain("use-black-ui=true");
	});

	it("replaces a multiline extra-keys property", () => {
		const updated = replaceTermuxExtraKeysProperty(
			"extra-keys = [ \\\n  ['ESC'], \\\n  ['TAB'] \\\n]\nfont-size=12\n",
		);
		expect(updated).toContain(`extra-keys = ${NEO_TERMUX_EXTRA_KEYS}`);
		expect(updated).toContain("font-size=12");
		expect(updated).not.toContain("['TAB']");
	});

	it("applies and restores the keyboard config with a backup", () => {
		const home = mkdtempSync(join(tmpdir(), "neo-termux-keys-"));
		const propertiesPath = getTermuxPropertiesPath(home);
		mkdirSync(join(home, ".termux"));
		writeFileSync(propertiesPath, "extra-keys = [['ESC']]\n", { flag: "wx" });
		const result = applyNeoTermuxTouchKeyboard({ home, env: { TERMUX_VERSION: "0.118" } });
		expect(result.isTermux).toBe(true);
		expect(result.usesNeoLayout).toBe(true);
		expect(result.backupPath).toBeTruthy();
		expect(readFileSync(propertiesPath, "utf8")).toContain(NEO_TERMUX_EXTRA_KEYS);
		const restored = restoreLatestTermuxTouchKeyboardBackup(home);
		expect(restored).toBe(result.backupPath);
		expect(readFileSync(propertiesPath, "utf8")).toBe("extra-keys = [['ESC']]\n");
	});

	it("reports status from a custom home", () => {
		const home = mkdtempSync(join(tmpdir(), "neo-termux-status-"));
		const status = getTermuxTouchKeyboardStatus({ home, env: { PREFIX: "/data/data/com.termux/files/usr" } });
		expect(status.isTermux).toBe(true);
		expect(status.exists).toBe(false);
		expect(status.propertiesPath).toBe(getTermuxPropertiesPath(home));
	});
});
