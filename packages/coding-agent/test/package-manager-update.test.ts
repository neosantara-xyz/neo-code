import { afterEach, describe, expect, it } from "vitest";
import { getInstallerSelfUpdateCommand, selectSelfUpdateCommand } from "../src/package-manager-cli.js";

const originalOffline = process.env.NEO_CODE_OFFLINE;
const originalInstallerUrl = process.env.NEO_CODE_INSTALLER_URL;

describe("package manager self update fallback", () => {
	afterEach(() => {
		if (originalOffline === undefined) delete process.env.NEO_CODE_OFFLINE;
		else process.env.NEO_CODE_OFFLINE = originalOffline;

		if (originalInstallerUrl === undefined) delete process.env.NEO_CODE_INSTALLER_URL;
		else process.env.NEO_CODE_INSTALLER_URL = originalInstallerUrl;
	});

	it("builds installer-based self update command by default", () => {
		delete process.env.NEO_CODE_OFFLINE;
		delete process.env.NEO_CODE_INSTALLER_URL;

		const command = getInstallerSelfUpdateCommand();
		if (process.platform === "win32") {
			expect(command).toBeUndefined();
			return;
		}

		expect(command).toBeDefined();
		expect(command?.command).toBe("sh");
		expect(command?.display).toContain("https://code.neosantara.xyz/install.sh");
		expect(command?.args.join(" ")).toContain("--release --force");
	});

	it("uses NEO_CODE_INSTALLER_URL override when provided", () => {
		if (process.platform === "win32") {
			expect(getInstallerSelfUpdateCommand()).toBeUndefined();
			return;
		}

		process.env.NEO_CODE_INSTALLER_URL = "https://example.internal/install.sh";
		const command = getInstallerSelfUpdateCommand();
		expect(command?.display).toContain("https://example.internal/install.sh");
		expect(command?.args[1]).toContain("https://example.internal/install.sh");
	});

	it("disables installer fallback in offline mode", () => {
		process.env.NEO_CODE_OFFLINE = "1";
		expect(getInstallerSelfUpdateCommand()).toBeUndefined();
	});

	it("prefers installer-based self update over package manager commands", () => {
		if (process.platform === "win32") {
			return;
		}

		const command = selectSelfUpdateCommand({
			command: "npm",
			args: ["install", "-g", "@neosantara/code"],
			display: "npm install -g @neosantara/code",
		});

		expect(command?.command).toBe("sh");
		expect(command?.display).toContain("https://code.neosantara.xyz/install.sh");
	});
});
