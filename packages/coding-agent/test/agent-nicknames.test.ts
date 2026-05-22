import { describe, expect, it } from "vitest";
import {
	getNusantaraAgentNicknames,
	NUSANTARA_AGENT_NICKNAMES,
	pickAgentNickname,
} from "../src/core/tools/agent-nicknames.js";

describe("Nusantara agent nickname pool", () => {
	it("ships with a non-trivial number of unique entries", () => {
		expect(NUSANTARA_AGENT_NICKNAMES.length).toBeGreaterThan(20);
		expect(new Set(NUSANTARA_AGENT_NICKNAMES).size).toBe(NUSANTARA_AGENT_NICKNAMES.length);
	});

	it("rejects empty entries", () => {
		for (const entry of NUSANTARA_AGENT_NICKNAMES) {
			expect(typeof entry).toBe("string");
			expect(entry.trim().length).toBeGreaterThan(0);
		}
	});

	it("getNusantaraAgentNicknames returns the same list", () => {
		expect(getNusantaraAgentNicknames()).toEqual(NUSANTARA_AGENT_NICKNAMES);
	});
});

describe("pickAgentNickname", () => {
	it("returns a nickname from the pool when no seed is provided", () => {
		const nickname = pickAgentNickname();
		expect(NUSANTARA_AGENT_NICKNAMES).toContain(nickname);
	});

	it("is deterministic for the same seed", () => {
		const seed = "explore|map auth flow|src/auth";
		expect(pickAgentNickname(seed)).toBe(pickAgentNickname(seed));
		expect(pickAgentNickname(seed)).toBe(pickAgentNickname(seed));
	});

	it("varies across distinct seeds in most cases", () => {
		const seeds = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta"];
		const picks = new Set(seeds.map((s) => pickAgentNickname(s)));
		// With a finite pool collisions are possible; require at least 3 distinct
		// names across 7 seeds so we catch a hash that always collapses.
		expect(picks.size).toBeGreaterThanOrEqual(3);
	});

	it("treats empty seeds as random (not stable)", () => {
		const a = pickAgentNickname("");
		expect(NUSANTARA_AGENT_NICKNAMES).toContain(a);
	});

	it("never throws on degenerate seed inputs", () => {
		expect(() => pickAgentNickname("\u0000")).not.toThrow();
		expect(() => pickAgentNickname("a".repeat(10000))).not.toThrow();
		expect(() => pickAgentNickname("\u{1F4A1}")).not.toThrow();
	});
});
