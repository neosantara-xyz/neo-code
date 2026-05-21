import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExtensionContext } from "../src/core/extensions/types.js";
import { createLspToolDefinition } from "../src/core/tools/lsp.js";

let rootDir: string;

async function executeLsp(params: Parameters<ReturnType<typeof createLspToolDefinition>["execute"]>[1]) {
	const tool = createLspToolDefinition(rootDir);
	return await tool.execute("lsp-1", params, undefined, undefined, {} as ExtensionContext);
}

describe("lsp tool", () => {
	beforeEach(() => {
		rootDir = mkdtempSync(join(tmpdir(), "neo-lsp-"));
		mkdirSync(join(rootDir, "src"), { recursive: true });
		writeFileSync(
			join(rootDir, "src", "sample.ts"),
			["export function target() {", "  return 1;", "}", "target();", "export const other = target();"].join("\n"),
		);
	});

	afterEach(() => {
		rmSync(rootDir, { recursive: true, force: true });
	});

	it("does not classify ordinary call sites as definitions", async () => {
		const result = await executeLsp({ action: "definition", query: "target", path: "src" });

		expect(result.content[0]?.type).toBe("text");
		expect(result.content[0]?.text).toContain("src/sample.ts:1");
		expect(result.content[0]?.text).not.toContain("src/sample.ts:4");
	});

	it("rejects paths outside the workspace", async () => {
		await expect(executeLsp({ action: "references", query: "target", path: ".." })).rejects.toThrow(
			"lsp path must stay within the current workspace",
		);
	});
});
