/**
 * Cross-platform file/URL opener.
 *
 * Resolves the right command for the host OS:
 *  - Termux on Android  → `termux-share` (when available)
 *  - macOS              → `open`
 *  - Windows            → `cmd /c start ""`
 *  - Linux / other      → `xdg-open`
 *
 * The resolver is split out from the spawn so callers can preview which
 * command will run (used by /share's status output) and so it stays
 * unit-testable without spawning anything.
 */

import { spawn, spawnSync } from "node:child_process";
import { getTermuxApiCapabilities, termuxShare } from "./termux-api.js";
import { isTermuxEnvironment } from "./termux-touch-keyboard.js";

export type OpenStrategy = "termux-share" | "open" | "xdg-open" | "windows-start" | "unsupported";

export interface OpenStrategyResolution {
	strategy: OpenStrategy;
	/** Argv including the leading executable name; empty for "unsupported". */
	argv: string[];
	/** Human-friendly label used in /share's confirmation line. */
	label: string;
}

export interface OpenStrategyOptions {
	platform?: NodeJS.Platform;
	env?: NodeJS.ProcessEnv;
	/**
	 * Override Termux:API availability for tests; production callers leave
	 * this `undefined` so detection is performed automatically.
	 */
	termuxShareAvailable?: boolean;
}

export function resolveOpenStrategy(filePath: string, options: OpenStrategyOptions = {}): OpenStrategyResolution {
	const platform = options.platform ?? process.platform;
	const env = options.env ?? process.env;

	const inTermux = isTermuxEnvironment(env);
	const shareAvailable = options.termuxShareAvailable ?? (inTermux && getTermuxApiCapabilities(env).share);
	if (inTermux && shareAvailable) {
		return {
			strategy: "termux-share",
			argv: ["termux-share", "-a", "view", filePath],
			label: "Android share sheet (termux-share)",
		};
	}

	switch (platform) {
		case "darwin":
			return { strategy: "open", argv: ["open", filePath], label: "macOS open" };
		case "win32":
			// `start` is a cmd builtin; the empty "" preserves an optional title arg.
			return { strategy: "windows-start", argv: ["cmd", "/c", "start", "", filePath], label: "Windows start" };
		case "linux":
		case "freebsd":
		case "openbsd":
		case "netbsd":
			return { strategy: "xdg-open", argv: ["xdg-open", filePath], label: "xdg-open" };
		default:
			return { strategy: "unsupported", argv: [], label: `unsupported platform: ${platform}` };
	}
}

export interface OpenLocalResult {
	ok: boolean;
	resolution: OpenStrategyResolution;
	error?: string;
}

/**
 * Spawn the resolved opener for `filePath`. Returns success/failure
 * without throwing, so /share can show a clean error message.
 */
export function openLocal(filePath: string, options: OpenStrategyOptions = {}): OpenLocalResult {
	const resolution = resolveOpenStrategy(filePath, options);
	if (resolution.strategy === "unsupported") {
		return { ok: false, resolution, error: resolution.label };
	}
	if (resolution.strategy === "termux-share") {
		const ok = termuxShare(filePath, { action: "view" });
		return ok ? { ok: true, resolution } : { ok: false, resolution, error: "termux-share failed" };
	}
	const [cmd, ...args] = resolution.argv;
	if (!cmd) return { ok: false, resolution, error: "no command resolved" };
	try {
		if (resolution.strategy === "xdg-open") {
			const commandProbe = spawnSync("sh", ["-c", 'command -v "$1"', "--", cmd], {
				stdio: "ignore",
				timeout: 1500,
			});
			if (commandProbe.error || commandProbe.status !== 0) {
				return { ok: false, resolution, error: `${cmd} not found` };
			}
			const child = spawn(cmd, args, {
				detached: true,
				stdio: "ignore",
			});
			// Listen for spawn-time errors (e.g. EACCES) that fire synchronously
			// on nextTick. If spawn itself succeeded the pid is set immediately.
			if (child.pid === undefined) {
				return { ok: false, resolution, error: `failed to launch ${cmd}` };
			}
			child.unref();
			return { ok: true, resolution };
		}
		const result = spawnSync(cmd, args, {
			stdio: "ignore",
			timeout: 5000,
		});
		if (result.error) {
			return { ok: false, resolution, error: result.error.message };
		}
		// xdg-open / open exit 0 immediately after handing off; status === 0
		// is the success contract on every supported platform.
		return { ok: result.status === 0, resolution, error: result.status === 0 ? undefined : `exit ${result.status}` };
	} catch (error) {
		return { ok: false, resolution, error: error instanceof Error ? error.message : String(error) };
	}
}
