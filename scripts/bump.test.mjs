import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendReleaseNote, getLockstepPackageVersion } from "./bump.mjs";

const originalCwd = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), "neo-bump-test-"));

function writePackage(dir, name, version) {
	const packageDir = join(tempDir, "packages", dir);
	mkdirSync(packageDir, { recursive: true });
	writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name, version }, null, "\t") + "\n");
}

before(() => {
	mkdirSync(join(tempDir, "packages"), { recursive: true });
	writePackage("ai", "@neosantara/ai", "0.74.9");
	writePackage("coding-agent", "@neosantara/code", "0.74.9");
	process.chdir(tempDir);
});

after(() => {
	process.chdir(originalCwd);
	rmSync(tempDir, { recursive: true, force: true });
});

describe("bump release notes", () => {
	it("uses lockstep workspace package version instead of root monorepo version", () => {
		writeFileSync(join(tempDir, "package.json"), JSON.stringify({ version: "0.0.3" }, null, "\t") + "\n");

		assert.equal(getLockstepPackageVersion(), "0.74.9");
	});

	it("appends release notes with the provided package version", () => {
		appendReleaseNote("0.74.9", "fix(update): test note", "patch");

		const notes = readFileSync(join(tempDir, "releases", "NOTES.md"), "utf8");
		assert.match(notes, /## v0\.74\.9/);
		assert.doesNotMatch(notes, /## v0\.0\.3/);
	});
});
