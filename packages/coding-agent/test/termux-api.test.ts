import { describe, expect, it } from "vitest";
import {
	detectTermuxApi,
	getTermuxApiCapabilities,
	getTermuxStatusSnapshot,
	listTermuxApiTools,
	resetTermuxApiCache,
	summarizeTermuxApiCapabilities,
} from "../src/core/termux-api.js";

describe("termux-api capability detection", () => {
	it("returns all-false when env is not Termux", () => {
		resetTermuxApiCache();
		const caps = detectTermuxApi({ HOME: "/home/user", PATH: "/usr/bin" });
		expect(caps.available).toBe(false);
		expect(caps.notification).toBe(false);
		expect(caps.vibrate).toBe(false);
		expect(caps.toast).toBe(false);
		expect(caps.share).toBe(false);
		expect(caps.clipboardGet).toBe(false);
		expect(caps.clipboardSet).toBe(false);
	});

	it("memoizes via getTermuxApiCapabilities for the same env fingerprint", () => {
		resetTermuxApiCache();
		const env: NodeJS.ProcessEnv = { HOME: "/home/user", PATH: "/usr/bin" };
		const a = getTermuxApiCapabilities(env);
		const b = getTermuxApiCapabilities(env);
		// Identity check confirms cache hit (same object instance).
		expect(a).toBe(b);
	});

	it("re-probes when the env fingerprint changes", () => {
		resetTermuxApiCache();
		const a = getTermuxApiCapabilities({ HOME: "/home/user", PATH: "/usr/bin" });
		const b = getTermuxApiCapabilities({
			TERMUX_VERSION: "0.118.0",
			PREFIX: "/data/data/com.termux/files/usr",
			HOME: "/data/data/com.termux/files/home",
			PATH: "/nonexistent",
		});
		expect(a).not.toBe(b);
		// Both still safe (no Termux:API tools on the host); only `available` may
		// flip if the host happens to have those binaries on PATH.
		expect(typeof a.available).toBe("boolean");
		expect(typeof b.available).toBe("boolean");
	});
});

describe("termux-api tool catalog", () => {
	it("lists all tools in stable, alphabetical order", () => {
		const ids = listTermuxApiTools().map(([id]) => id);
		expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
		expect(ids).toContain("notification");
		expect(ids).toContain("vibrate");
		expect(ids).toContain("toast");
		expect(ids).toContain("share");
		expect(ids).toContain("clipboardGet");
		expect(ids).toContain("clipboardSet");
	});

	it("maps every tool id to a `termux-*` command", () => {
		for (const [, cmd] of listTermuxApiTools()) {
			expect(cmd).toMatch(/^termux-/);
		}
	});
});

describe("getTermuxStatusSnapshot", () => {
	it("reports non-Termux env clearly", () => {
		resetTermuxApiCache();
		const snap = getTermuxStatusSnapshot({ HOME: "/home/user", PATH: "/usr/bin" });
		expect(snap.isTermux).toBe(false);
		expect(snap.capabilities.available).toBe(false);
		expect(snap.availableCount).toBe(0);
		expect(snap.totalCount).toBeGreaterThan(0);
		expect(snap.totalCount).toBe(listTermuxApiTools().length);
	});

	it("reflects TERMUX_VERSION when present", () => {
		resetTermuxApiCache();
		const snap = getTermuxStatusSnapshot({
			TERMUX_VERSION: "0.118.0",
			PREFIX: "/data/data/com.termux/files/usr",
			HOME: "/data/data/com.termux/files/home",
			PATH: "/nonexistent",
		});
		expect(snap.isTermux).toBe(true);
		expect(snap.termuxVersion).toBe("0.118.0");
		expect(snap.prefix).toBe("/data/data/com.termux/files/usr");
	});
});

describe("summarizeTermuxApiCapabilities", () => {
	it("returns an install hint when nothing is available", () => {
		const summary = summarizeTermuxApiCapabilities({
			available: false,
			notification: false,
			vibrate: false,
			toast: false,
			share: false,
			clipboardGet: false,
			clipboardSet: false,
		});
		expect(summary).toContain("not installed");
		expect(summary).toContain("pkg install termux-api");
	});

	it("formats `<n>/<total> tools (...)` when at least one is present", () => {
		const summary = summarizeTermuxApiCapabilities({
			available: true,
			notification: true,
			vibrate: false,
			toast: true,
			share: false,
			clipboardGet: true,
			clipboardSet: false,
		});
		expect(summary).toMatch(/^3\/\d+ tools \(/);
		expect(summary).toContain("notification");
		expect(summary).toContain("toast");
		expect(summary).toContain("clipboardGet");
		expect(summary).not.toContain("vibrate");
		expect(summary).not.toContain("share");
	});
});
