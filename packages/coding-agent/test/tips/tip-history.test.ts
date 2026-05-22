import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileTipHistoryStore, InMemoryTipHistoryStore } from "../../src/core/tips/tip-history.js";

describe("InMemoryTipHistoryStore", () => {
	it("starts at zero startups with infinite gap for unknown tips", () => {
		const store = new InMemoryTipHistoryStore();
		expect(store.getNumStartups()).toBe(0);
		expect(store.getSessionsSinceLastShown("unknown-tip")).toBe(Number.POSITIVE_INFINITY);
	});

	it("bumps numStartups monotonically and reports it back", () => {
		const store = new InMemoryTipHistoryStore({ numStartups: 4 });
		expect(store.bumpNumStartups()).toBe(5);
		expect(store.bumpNumStartups()).toBe(6);
		expect(store.getNumStartups()).toBe(6);
	});

	it("records last-shown by id and reports zero-gap immediately after", () => {
		const store = new InMemoryTipHistoryStore({ numStartups: 7 });
		store.recordShown("compact");
		expect(store.getSessionsSinceLastShown("compact")).toBe(0);
		expect(store.getSessionsSinceLastShown("at-file")).toBe(Number.POSITIVE_INFINITY);
	});

	it("computes gap based on numStartups - lastShown", () => {
		const store = new InMemoryTipHistoryStore({ numStartups: 3 });
		store.recordShown("compact");
		store.bumpNumStartups();
		store.bumpNumStartups();
		expect(store.getSessionsSinceLastShown("compact")).toBe(2);
	});

	it("clamps to zero when lastShown was somehow ahead of numStartups", () => {
		const store = new InMemoryTipHistoryStore({ numStartups: 1, history: { weird: 9 } });
		expect(store.getSessionsSinceLastShown("weird")).toBe(0);
	});

	it("ignores invalid entries provided in the constructor seed", () => {
		const store = new InMemoryTipHistoryStore({
			numStartups: 5,
			history: {
				good: 2,
				negative: -3,
				infinite: Number.POSITIVE_INFINITY,
			},
		});
		expect(store.getSessionsSinceLastShown("good")).toBe(3);
		expect(store.getSessionsSinceLastShown("negative")).toBe(Number.POSITIVE_INFINITY);
		expect(store.getSessionsSinceLastShown("infinite")).toBe(Number.POSITIVE_INFINITY);
	});
});

describe("FileTipHistoryStore", () => {
	let tempDir: string;
	let path: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "neo-tip-history-"));
		path = join(tempDir, "tip-history.json");
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("treats a missing file as zero startups + empty history", () => {
		const store = new FileTipHistoryStore(path);
		expect(store.getNumStartups()).toBe(0);
		expect(store.getSessionsSinceLastShown("anything")).toBe(Number.POSITIVE_INFINITY);
	});

	it("creates the file on first write through bumpNumStartups", () => {
		const store = new FileTipHistoryStore(path);
		store.bumpNumStartups();
		expect(existsSync(path)).toBe(true);
		const parsed = JSON.parse(readFileSync(path, "utf-8")) as { numStartups: number };
		expect(parsed.numStartups).toBe(1);
	});

	it("persists recorded tips across a fresh store instance", () => {
		const a = new FileTipHistoryStore(path);
		a.bumpNumStartups();
		a.bumpNumStartups();
		a.recordShown("compact");

		const b = new FileTipHistoryStore(path);
		expect(b.getNumStartups()).toBe(2);
		expect(b.getSessionsSinceLastShown("compact")).toBe(0);
		expect(b.getSessionsSinceLastShown("never-shown")).toBe(Number.POSITIVE_INFINITY);
	});

	it("recordShown is idempotent within a single session", () => {
		const store = new FileTipHistoryStore(path);
		store.bumpNumStartups();
		store.recordShown("compact");
		const firstWrite = readFileSync(path, "utf-8");
		store.recordShown("compact");
		const secondWrite = readFileSync(path, "utf-8");
		expect(firstWrite).toBe(secondWrite);
	});

	it("recovers gracefully from a corrupted history file", () => {
		writeFileSync(path, "{ this is not valid JSON", "utf-8");
		const store = new FileTipHistoryStore(path);
		expect(store.getNumStartups()).toBe(0);
		expect(store.getSessionsSinceLastShown("compact")).toBe(Number.POSITIVE_INFINITY);
	});

	it("ignores malformed history entries while keeping valid ones", () => {
		writeFileSync(
			path,
			JSON.stringify({
				numStartups: 4,
				history: {
					compact: 2,
					broken: "not-a-number",
					negative: -1,
				},
			}),
			"utf-8",
		);
		const store = new FileTipHistoryStore(path);
		expect(store.getNumStartups()).toBe(4);
		expect(store.getSessionsSinceLastShown("compact")).toBe(2);
		expect(store.getSessionsSinceLastShown("broken")).toBe(Number.POSITIVE_INFINITY);
		expect(store.getSessionsSinceLastShown("negative")).toBe(Number.POSITIVE_INFINITY);
	});
});
