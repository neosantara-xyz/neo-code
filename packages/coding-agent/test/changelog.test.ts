import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getAllChangelogEntries } from "../src/utils/changelog.js";

const originalPackageDir = process.env.NEO_CODE_PACKAGE_DIR;

afterEach(() => {
	if (originalPackageDir === undefined) {
		delete process.env.NEO_CODE_PACKAGE_DIR;
	} else {
		process.env.NEO_CODE_PACKAGE_DIR = originalPackageDir;
	}
});

describe("changelog release notes", () => {
	it("loads release notes shipped inside dist assets", () => {
		const packageDir = mkdtempSync(join(tmpdir(), "neo-code-package-"));
		try {
			mkdirSync(join(packageDir, "dist", "releases"), { recursive: true });
			writeFileSync(join(packageDir, "package.json"), JSON.stringify({ version: "0.74.8" }), "utf8");
			writeFileSync(join(packageDir, "CHANGELOG.md"), "# Neo Code\n", "utf8");
			writeFileSync(
				join(packageDir, "dist", "releases", "NOTES.md"),
				[
					"# Neo Code Release Notes",
					"",
					"## v0.74.8 (2026-05-15)",
					"- mode: patch",
					"- notes: feat(agents): add Codex-style init command for AGENTS.md",
					"",
				].join("\n"),
				"utf8",
			);
			process.env.NEO_CODE_PACKAGE_DIR = packageDir;

			expect(getAllChangelogEntries().map((entry) => entry.content)).toContain(
				[
					"## v0.74.8 (2026-05-15)",
					"- mode: patch",
					"- notes: feat(agents): add Codex-style init command for AGENTS.md",
				].join("\n"),
			);
		} finally {
			rmSync(packageDir, { recursive: true, force: true });
		}
	});
});
