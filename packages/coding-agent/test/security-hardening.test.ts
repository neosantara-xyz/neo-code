import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReadToolDefinition, createWriteToolDefinition } from "../src/core/tools/index.js";
import { assertPathInsideCwd, resolveWorkspacePath } from "../src/core/tools/path-utils.js";

let cwd: string;
let outside: string;

describe("security hardening", () => {
	beforeEach(() => {
		cwd = mkdtempSync(join(tmpdir(), "neo-sec-cwd-"));
		outside = mkdtempSync(join(tmpdir(), "neo-sec-outside-"));
	});

	afterEach(() => {
		rmSync(cwd, { recursive: true, force: true });
		rmSync(outside, { recursive: true, force: true });
	});

	it("rejects path traversal outside the workspace", () => {
		expect(() => resolveWorkspacePath("../escape.txt", cwd, "Write path")).toThrow("escapes workspace");
	});

	it("rejects symlinks that resolve outside the workspace", () => {
		const outsideFile = join(outside, "secret.txt");
		writeFileSync(outsideFile, "secret", "utf8");
		symlinkSync(outsideFile, join(cwd, "secret-link.txt"));

		expect(() => assertPathInsideCwd(join(cwd, "secret-link.txt"), cwd, "Read path")).toThrow("escapes workspace");
	});

	it("guards write tool paths before filesystem mutation", async () => {
		const tool = createWriteToolDefinition(cwd);
		await expect(
			tool.execute("write-1", { path: "../escape.txt", content: "blocked" }, undefined, undefined, undefined),
		).rejects.toThrow("escapes workspace");
	});

	it("guards read tool paths before following outside symlinks", async () => {
		const outsideFile = join(outside, "secret.txt");
		writeFileSync(outsideFile, "secret", "utf8");
		symlinkSync(outsideFile, join(cwd, "secret-link.txt"));

		const tool = createReadToolDefinition(cwd);
		await expect(
			tool.execute("read-1", { path: "secret-link.txt" }, undefined, undefined, undefined),
		).rejects.toThrow("escapes workspace");
	});
});
