import type { InstallMethod } from "../config.js";
import type { SettingsManager } from "./settings-manager.js";

function isTruthyEnvFlag(value: string | undefined): boolean {
	if (!value) return false;
	return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

export function isInstallTelemetryEnabled(
	settingsManager: SettingsManager,
	telemetryEnv: string | undefined = process.env.NEO_CODE_TELEMETRY,
): boolean {
	return telemetryEnv !== undefined ? isTruthyEnvFlag(telemetryEnv) : settingsManager.getEnableInstallTelemetry();
}

export type InstallTelemetryEvent = "fresh_install" | "update" | "update_command_success" | "update_command_failure";

export interface InstallTelemetryPayload {
	event: InstallTelemetryEvent;
	version: string;
	platform: string;
	arch: string;
	installMethod: InstallMethod;
	termux: boolean;
}

export function buildInstallTelemetryPayload(
	version: string,
	event: InstallTelemetryEvent,
	installMethod: InstallMethod,
): InstallTelemetryPayload {
	return {
		event,
		version,
		platform: process.platform,
		arch: process.arch,
		installMethod,
		termux: Boolean(process.env.TERMUX_VERSION),
	};
}
