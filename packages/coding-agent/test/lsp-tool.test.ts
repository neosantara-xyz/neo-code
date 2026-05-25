import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shutdownLspManager } from "../src/core/lsp/manager.js";
import { createLspToolDefinition } from "../src/core/tools/lsp.js";

describe("lsp tool", () => {
	it("returns an install hint when no LSP binary is available for the file", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "neo-lsp-tool-"));
		const file = join(cwd, "thing.unknown-ext");
		writeFileSync(file, "hello");
		const tool = createLspToolDefinition(cwd);
		const result = await tool.execute("call-1", { action: "definition", query: "thing", path: "thing.unknown-ext" });
		expect(result.details.matchCount).toBe(0);
		expect(result.details.fallback).toBe("no-server");
		const text = result.content?.[0];
		expect(text && "text" in text ? text.text : "").toMatch(/No language server/);
		await shutdownLspManager();
	});

	it("requires a path for definition lookups", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "neo-lsp-tool-"));
		const tool = createLspToolDefinition(cwd);
		await expect(tool.execute("call-2", { action: "definition", query: "Foo" })).rejects.toThrow(/requires a "path"/);
		await shutdownLspManager();
	});

	it("rejects paths that escape the workspace", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "neo-lsp-tool-"));
		const tool = createLspToolDefinition(cwd);
		await expect(
			tool.execute("call-3", { action: "definition", query: "Foo", path: "../escape.ts" }),
		).rejects.toThrow(/within the current workspace/);
		await shutdownLspManager();
	});
});
