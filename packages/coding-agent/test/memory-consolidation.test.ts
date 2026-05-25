import { describe, expect, it } from "vitest";
import {
	buildConsolidationPrompt,
	parseConsolidationResponse,
	shouldConsolidate,
} from "../src/core/memories/consolidation.js";
import type { ConsolidationState, MemoryEntry } from "../src/core/memories/types.js";

function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
	return {
		id: "test-id",
		createdAt: "2024-01-01T00:00:00.000Z",
		workspace: "/tmp/project",
		title: "Test memory",
		content: "Test content",
		tags: ["test"],
		usageCount: 0,
		lastUsedAt: null,
		sourceSessionId: null,
		...overrides,
	};
}

describe("shouldConsolidate", () => {
	it("returns false when memory count equals state count", () => {
		const entries = [makeEntry(), makeEntry(), makeEntry()];
		const state: ConsolidationState = {
			lastConsolidatedAt: "2024-01-01T00:00:00.000Z",
			memoryCountAtLastConsolidation: 3,
			version: 1,
		};
		expect(shouldConsolidate(entries, state)).toBe(false);
	});

	it("returns false when difference is less than 3", () => {
		const entries = [makeEntry(), makeEntry(), makeEntry(), makeEntry()];
		const state: ConsolidationState = {
			lastConsolidatedAt: "2024-01-01T00:00:00.000Z",
			memoryCountAtLastConsolidation: 2,
			version: 1,
		};
		expect(shouldConsolidate(entries, state)).toBe(false);
	});

	it("returns true when 3+ new memories exist", () => {
		const entries = [makeEntry(), makeEntry(), makeEntry(), makeEntry(), makeEntry()];
		const state: ConsolidationState = {
			lastConsolidatedAt: "2024-01-01T00:00:00.000Z",
			memoryCountAtLastConsolidation: 2,
			version: 1,
		};
		expect(shouldConsolidate(entries, state)).toBe(true);
	});

	it("returns true when no prior consolidation and 3+ memories", () => {
		const entries = [makeEntry(), makeEntry(), makeEntry()];
		const state: ConsolidationState = {
			lastConsolidatedAt: null,
			memoryCountAtLastConsolidation: 0,
			version: 1,
		};
		expect(shouldConsolidate(entries, state)).toBe(true);
	});
});

describe("buildConsolidationPrompt", () => {
	it("includes all memory titles and content in the output", () => {
		const entries = [
			makeEntry({ title: "Architecture pattern", content: "Uses hexagonal architecture" }),
			makeEntry({ title: "Build command", content: "Run npm run build from root" }),
		];

		const prompt = buildConsolidationPrompt(entries);

		expect(prompt).toContain("Architecture pattern");
		expect(prompt).toContain("Uses hexagonal architecture");
		expect(prompt).toContain("Build command");
		expect(prompt).toContain("Run npm run build from root");
	});

	it("includes the total count of memories", () => {
		const entries = [makeEntry(), makeEntry(), makeEntry()];
		const prompt = buildConsolidationPrompt(entries);
		expect(prompt).toContain("3 total");
	});

	it("includes tags for each entry", () => {
		const entries = [makeEntry({ tags: ["architecture", "patterns"] })];
		const prompt = buildConsolidationPrompt(entries);
		expect(prompt).toContain("architecture, patterns");
	});
});

describe("parseConsolidationResponse", () => {
	it("correctly parses a valid JSON response in a code block", () => {
		const response = `\`\`\`json
{
  "entries": [
    {
      "title": "Merged architecture notes",
      "content": "The project uses hexagonal architecture with ports and adapters.",
      "tags": ["architecture"]
    },
    {
      "title": "Build workflow",
      "content": "Always run npm run build from the repo root.",
      "tags": ["build", "workflow"]
    }
  ],
  "summary": "# Project Memory\\n\\n## Architecture\\n- Uses hexagonal architecture"
}
\`\`\``;

		const result = parseConsolidationResponse(response);

		expect(result.skipped).toBe(false);
		expect(result.entries).toHaveLength(2);
		expect(result.entries[0]!.title).toBe("Merged architecture notes");
		expect(result.entries[0]!.content).toContain("hexagonal architecture");
		expect(result.entries[0]!.tags).toEqual(["architecture"]);
		expect(result.entries[1]!.title).toBe("Build workflow");
		expect(result.memorySummary).toContain("# Project Memory");
	});

	it("returns skipped=true for malformed input", () => {
		const result = parseConsolidationResponse("not valid json at all");
		expect(result.skipped).toBe(true);
		expect(result.entries).toHaveLength(0);
		expect(result.skipReason).toBeDefined();
	});

	it("returns skipped=true when entries is not an array", () => {
		const response = `\`\`\`json
{ "entries": "not an array", "summary": "test" }
\`\`\``;
		const result = parseConsolidationResponse(response);
		expect(result.skipped).toBe(true);
		expect(result.entries).toHaveLength(0);
	});

	it("filters out entries with missing title or content", () => {
		const response = `\`\`\`json
{
  "entries": [
    { "title": "Valid", "content": "Good content", "tags": [] },
    { "title": "", "content": "Empty title", "tags": [] },
    { "title": "No content", "content": "", "tags": [] }
  ],
  "summary": "summary"
}
\`\`\``;
		const result = parseConsolidationResponse(response);
		expect(result.skipped).toBe(false);
		expect(result.entries).toHaveLength(1);
		expect(result.entries[0]!.title).toBe("Valid");
	});
});
