#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function run(cmd) {
	execSync(cmd, {
		stdio: "inherit",
		env: {
			...process.env,
			npm_config_cache: process.env.npm_config_cache || ".npm-cache",
		},
	});
}

function refreshLockfile() {
	run("npm install --package-lock-only --ignore-scripts");
}

function parseArgs(argv) {
	let level = "patch";
	let notes = "";
	let version = "";

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--notes") {
			notes = argv[i + 1] ?? "";
			i++;
			continue;
		}
		if (arg === "--set") {
			version = argv[i + 1] ?? "";
			i++;
			continue;
		}
		if (arg === "patch" || arg === "minor" || arg === "major") {
			level = arg;
		}
	}

	return { level, notes: notes.trim(), version: version.trim() };
}

function getPackageVersions() {
	const packagesDir = join(process.cwd(), "packages");
	return readdirSync(packagesDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => {
			const pkg = JSON.parse(readFileSync(join(packagesDir, entry.name, "package.json"), "utf8"));
			return pkg.version;
		});
}

export function getLockstepPackageVersion() {
	const versions = new Set(getPackageVersions());
	if (versions.size !== 1) {
		throw new Error(`Package versions are not lockstep: ${Array.from(versions).sort().join(", ")}`);
	}
	const [version] = versions;
	if (typeof version !== "string" || !version.trim()) {
		throw new Error("Unable to determine lockstep package version");
	}
	return version;
}

export function appendReleaseNote(version, notes, mode) {
	if (!notes) return;
	const dir = join(process.cwd(), "releases");
	const path = join(dir, "NOTES.md");
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	const date = new Date().toLocaleDateString("en-CA");
	const header = `## v${version} (${date})\n`;
	const body = `- mode: ${mode}\n- notes: ${notes}\n\n`;
	const existing = existsSync(path) ? readFileSync(path, "utf8") : "# Neo Code Release Notes\n\n";
	writeFileSync(path, `${existing}${header}${body}`);
	console.log(`Saved release notes to ${path}`);
}

function main() {
	const { level, notes, version } = parseArgs(process.argv.slice(2));
	const before = getLockstepPackageVersion();

	if (version) {
		run(`npm version ${version} -ws --no-git-tag-version`);
		run("node scripts/sync-versions.js");
		refreshLockfile();
	} else {
		run(`npm run version:${level}`);
	}

	const after = getLockstepPackageVersion();
	appendReleaseNote(after, notes, version ? `set:${version}` : level);
	console.log(`Version bumped: ${before} -> ${after}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main();
}
