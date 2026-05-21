import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReadToolDefinition } from "../src/core/tools/index.js";
import { stripSourceMappingUrlLines } from "../src/core/tools/render-utils.js";

let cwd: string;

describe("sourceMappingURL filtering", () => {
	beforeEach(() => {
		cwd = mkdtempSync(join(tmpdir(), "neo-sourcemap-cwd-"));
	});

	afterEach(() => {
		rmSync(cwd, { recursive: true, force: true });
	});

	it("strips inline source map comment lines without removing normal code", () => {
		const sourceMap = `//# sourceMappingURL=data:application/json;base64,${"a".repeat(128)}`;
		const filtered = stripSourceMappingUrlLines(`const ok = true;\n${sourceMap}\nconsole.log(ok);`);

		expect(filtered.removedLines).toBe(1);
		expect(filtered.text).toBe("const ok = true;\nconsole.log(ok);");
	});

	it("filters source map data lines before read truncation", async () => {
		writeFileSync(
			join(cwd, "bundle.js"),
			`export const value = 1;\n//# sourceMappingURL=data:application/json;base64,${"x".repeat(80_000)}\n`,
			"utf8",
		);

		const tool = createReadToolDefinition(cwd);
		const result = await tool.execute("read-source-map", { path: "bundle.js" }, undefined, undefined, undefined);
		const text = result.content.find((item) => item.type === "text")?.text ?? "";

		expect(text).toContain("export const value = 1;");
		expect(text).not.toContain("sourceMappingURL=data:application/json");
		expect(text).toContain("[Filtered 1 sourceMappingURL line.]");
		expect(result.details?.filteredSourceMappingURLLines).toBe(1);
		expect(result.details?.truncation?.firstLineExceedsLimit).not.toBe(true);
	});
});
