import { afterEach, describe, expect, it } from "vitest";
import { buildInstallTelemetryPayload } from "../src/core/telemetry.js";

const originalTermuxVersion = process.env.TERMUX_VERSION;

describe("install telemetry payload", () => {
	afterEach(() => {
		if (originalTermuxVersion === undefined) {
			delete process.env.TERMUX_VERSION;
			return;
		}
		process.env.TERMUX_VERSION = originalTermuxVersion;
	});

	it("builds payload with platform, arch, and install method", () => {
		delete process.env.TERMUX_VERSION;
		const payload = buildInstallTelemetryPayload("0.74.0", "update", "npm");
		expect(payload).toEqual({
			event: "update",
			version: "0.74.0",
			platform: process.platform,
			arch: process.arch,
			installMethod: "npm",
			termux: false,
		});
	});

	it("marks termux when TERMUX_VERSION is set", () => {
		process.env.TERMUX_VERSION = "0.118.0";
		const payload = buildInstallTelemetryPayload("0.74.0", "fresh_install", "unknown");
		expect(payload.termux).toBe(true);
		expect(payload.event).toBe("fresh_install");
	});

	it("supports update command telemetry events", () => {
		const payload = buildInstallTelemetryPayload("0.74.0", "update_command_success", "npm");
		expect(payload.event).toBe("update_command_success");
	});
});
