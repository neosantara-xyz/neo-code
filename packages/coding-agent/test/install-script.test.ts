import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const installScriptPath = resolve(__dirname, "../../../install.sh");
const tempDirs: string[] = [];

function createTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "neo-install-script-test-"));
	tempDirs.push(dir);
	return dir;
}

function runInstall(args: string[], env: NodeJS.ProcessEnv, cwd: string): string {
	return execFileSync("sh", [installScriptPath, ...args], {
		cwd,
		env: { ...process.env, ...env },
		encoding: "utf8",
	});
}

describe("install.sh", () => {
	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("downloads a platform release asset in release mode on standard Linux", () => {
		const cwd = createTempDir();
		const home = createTempDir();

		const output = runInstall(
			["--release", "--version", "v0.74.0", "--dry-run"],
			{
				HOME: home,
				TERMUX_VERSION: "",
			},
			cwd,
		);

		expect(output).toContain(
			"https://github.com/neosantara-xyz/neo-code/releases/download/v0.74.0/neo-linux-x64.tar.gz",
		);
		expect(output).toContain("Neo Code");
		expect(output).toContain("[fetch] Downloading neo-linux-x64.tar.gz");
		expect(output).toContain(`ln -s ${home}/.local/neo/neo ${home}/.local/bin/neo`);
	});

	it("falls back to a source archive on Termux in release mode", () => {
		const cwd = createTempDir();
		const home = createTempDir();

		const output = runInstall(
			["--release", "--version", "v0.74.0", "--dry-run"],
			{
				HOME: home,
				TERMUX_VERSION: "0.118.0",
				PREFIX: "/data/data/com.termux/files/usr",
			},
			cwd,
		);

		expect(output).toContain("Termux detected; using prebuilt npm bundle");
		expect(output).toContain(
			"https://github.com/neosantara-xyz/neo-code/releases/download/v0.74.0/neo-termux-npm-bundle.tar.gz",
		);
		expect(output).toContain("[fetch] Downloading Termux bundle");
		expect(output).toContain("[extract] Extracting installer bundle");
		expect(output).toContain(
			"npm install -g --no-fund --no-audit ./neosantara-ai.tgz ./neosantara-agent-core.tgz ./neosantara-tui.tgz ./neosantara-code.tgz",
		);
	});

	it("can fall back to GitHub release downloads when the custom base URL is disabled", () => {
		const cwd = createTempDir();
		const home = createTempDir();

		const output = runInstall(
			["--release", "--version", "v0.74.0", "--dry-run"],
			{
				HOME: home,
				NEO_CODE_DOWNLOAD_BASE_URL: "",
			},
			cwd,
		);

		expect(output).toContain(
			"https://github.com/neosantara-xyz/neo-code/releases/download/v0.74.0/neo-linux-x64.tar.gz",
		);
	});
});
