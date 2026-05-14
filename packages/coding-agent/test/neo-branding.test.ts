import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { printHelp } from "../src/cli/args.js";
import { APP_NAME, APP_TITLE, CONFIG_DIR_NAME, ENV_AGENT_DIR, ENV_SESSION_DIR } from "../src/config.js";

describe("Neo Code branding", () => {
	it("uses Neo Code public names without a NAI legacy alias", () => {
		expect(APP_NAME).toBe("neo");
		expect(APP_TITLE).toBe("Neo Code");
		expect(CONFIG_DIR_NAME).toBe(".neo-code");
		expect(ENV_AGENT_DIR).toBe("NEO_CODE_CODING_AGENT_DIR");
		expect(ENV_SESSION_DIR).toBe("NEO_CODE_CODING_AGENT_SESSION_DIR");
	});

	it("ships only the neo CLI command in package metadata", () => {
		const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
		const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { bin?: Record<string, string> };
		expect(pkg.bin).toEqual({ neo: "dist/cli.js" });
		expect(pkg.bin).not.toHaveProperty("nai");
	});

	it("prints Neo Code help with non-duplicated Neosantara env vars", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		try {
			printHelp();
			const help = spy.mock.calls.map((call) => String(call[0])).join("\n");
			const plain = help.replace(/\u001b\[[\d;]*m/g, "");
			expect(plain).toMatch(/Neo - AI Coding Assistant/i);
			expect(plain).toContain("NEOSANTARA_API_BASE_URL");
			expect(plain).toContain("NEO_CODE_NEOSANTARA_API_BASE_URL");
			expect(plain.match(/NEOSANTARA_API_KEY/g)?.length).toBe(1);
			expect(plain).not.toContain("NAI Code");
		} finally {
			spy.mockRestore();
		}
	});

	it("does not expose backend TODO placeholders in interactive usage copy", () => {
		const sourcePath = fileURLToPath(new URL("../src/modes/interactive/interactive-mode.ts", import.meta.url));
		const source = readFileSync(sourcePath, "utf8");

		expect(source).toContain("Account Billing");
		expect(source).toContain("login required");
		expect(source).toContain("/v1/cli/usage");
		expect(source).not.toContain("TODO backend");
		expect(source).not.toContain("TODO: Implement backend");
		expect(source).not.toContain("Budget / credit limit");
	});
});
