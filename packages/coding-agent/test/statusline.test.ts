import { describe, expect, it } from "vitest";
import {
	DEFAULT_STATUSLINE_ITEMS,
	getEnabledStatuslineItems,
	getStatuslineItemMetadata,
	normalizeStatuslineItems,
	STATUSLINE_ITEM_METADATA,
} from "../src/core/statusline.js";

describe("statusline metadata", () => {
	it("declares metadata for every default item", () => {
		const metaIds = new Set(STATUSLINE_ITEM_METADATA.map((meta) => meta.id));
		for (const item of DEFAULT_STATUSLINE_ITEMS) {
			expect(metaIds.has(item.id)).toBe(true);
		}
	});

	it("getStatuslineItemMetadata returns matching entry", () => {
		const meta = getStatuslineItemMetadata("modePill");
		expect(meta.id).toBe("modePill");
		expect(meta.label.length).toBeGreaterThan(0);
	});

	it("throws on unknown ids", () => {
		// @ts-expect-error - intentional invalid id
		expect(() => getStatuslineItemMetadata("not-real")).toThrow();
	});
});

describe("normalizeStatuslineItems", () => {
	it("returns defaults when input is empty or missing", () => {
		expect(normalizeStatuslineItems(undefined)).toEqual(DEFAULT_STATUSLINE_ITEMS);
		expect(normalizeStatuslineItems(null)).toEqual(DEFAULT_STATUSLINE_ITEMS);
		expect(normalizeStatuslineItems([])).toEqual(DEFAULT_STATUSLINE_ITEMS);
	});

	it("preserves user order for known ids", () => {
		const result = normalizeStatuslineItems([
			{ id: "context", enabled: true },
			{ id: "billing", enabled: false },
			{ id: "hint", enabled: true },
		]);
		expect(result.slice(0, 3).map((item) => item.id)).toEqual(["context", "billing", "hint"]);
	});

	it("appends missing default ids as disabled at the end", () => {
		const result = normalizeStatuslineItems([
			{ id: "context", enabled: true },
			{ id: "billing", enabled: false },
		]);
		const tail = result.slice(2);
		const tailIds = tail.map((item) => item.id);
		expect(tail.every((item) => item.enabled === false)).toBe(true);
		expect(tailIds).toContain("modelName");
		expect(tailIds).toContain("modePill");
	});

	it("drops unknown ids and dedupes by id (first wins)", () => {
		const result = normalizeStatuslineItems([
			{ id: "context", enabled: true },
			// @ts-expect-error - testing unknown id rejection
			{ id: "fakeItem", enabled: true },
			{ id: "context", enabled: false },
		]);
		const contextEntries = result.filter((item) => item.id === "context");
		expect(contextEntries).toHaveLength(1);
		expect(contextEntries[0]!.enabled).toBe(true);
	});

	it("treats missing 'enabled' as true (sane default for partial config)", () => {
		const result = normalizeStatuslineItems([{ id: "context" } as never]);
		expect(result[0]!.enabled).toBe(true);
	});

	it("treats 'enabled: false' as disabled", () => {
		const result = normalizeStatuslineItems([{ id: "billing", enabled: false }]);
		expect(result[0]!.enabled).toBe(false);
	});

	it("ignores non-object entries", () => {
		const result = normalizeStatuslineItems([
			null as never,
			undefined as never,
			"not-an-object" as never,
			{ id: "context", enabled: true },
		]);
		const contextIndex = result.findIndex((item) => item.id === "context");
		expect(contextIndex).toBeGreaterThanOrEqual(0);
	});
});

describe("getEnabledStatuslineItems", () => {
	it("returns ids in order, filtering out disabled", () => {
		const items = [
			{ id: "modePill" as const, enabled: true },
			{ id: "context" as const, enabled: false },
			{ id: "billing" as const, enabled: true },
		];
		expect(getEnabledStatuslineItems(items)).toEqual(["modePill", "billing"]);
	});

	it("returns empty array when all items are disabled", () => {
		const items = DEFAULT_STATUSLINE_ITEMS.map((item) => ({ ...item, enabled: false }));
		expect(getEnabledStatuslineItems(items)).toEqual([]);
	});
});
