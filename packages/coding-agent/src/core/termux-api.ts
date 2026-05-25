/**
 * Termux:API capability layer.
 *
 * Wraps the `termux-*` companion CLIs from the `termux-api` package
 * (see {@link https://wiki.termux.com/wiki/Termux:API}). Each wrapper:
 *  - Times out quickly (2-3s) so the UI never hangs when the Android
 *    bridge stalls or the user denies the in-app permission prompt.
 *  - Uses `stdio: "pipe"` so nothing leaks into the TUI.
 *  - Never throws on absence of the tool. Callers can safely fire-and-
 *    forget — features must degrade gracefully when Termux:API is not
 *    installed.
 *
 * Detection is intentionally synchronous and cheap (one `command -v`
 * spawn per tool). Callers should cache the result for a session via
 * {@link detectTermuxApi}.
 */

import { spawnSync } from "node:child_process";
import { isTermuxEnvironment } from "./termux-touch-keyboard.js";

/**
 * Map of {@link TermuxApiTool} ids to the underlying executable name.
 * Kept verbose so a future reader can grep both directions.
 */
const TERMUX_API_COMMANDS = {
	notification: "termux-notification",
	vibrate: "termux-vibrate",
	toast: "termux-toast",
	share: "termux-share",
	clipboardGet: "termux-clipboard-get",
	clipboardSet: "termux-clipboard-set",
} as const;

export type TermuxApiTool = keyof typeof TERMUX_API_COMMANDS;

/**
 * Boolean flags for each Termux:API tool the agent can use.
 *
 * `available` is `true` when at least one tool is present, which is
 * the cheapest signal to gate UX features on (e.g. the install tip).
 */
export interface TermuxApiCapabilities {
	available: boolean;
	notification: boolean;
	vibrate: boolean;
	toast: boolean;
	share: boolean;
	clipboardGet: boolean;
	clipboardSet: boolean;
}

const NEVER: TermuxApiCapabilities = {
	available: false,
	notification: false,
	vibrate: false,
	toast: false,
	share: false,
	clipboardGet: false,
	clipboardSet: false,
};

function commandExists(command: string, timeoutMs = 1500): boolean {
	try {
		const result = spawnSync("sh", ["-c", `command -v ${command}`], {
			encoding: "utf8",
			stdio: "pipe",
			timeout: timeoutMs,
		});
		return result.status === 0;
	} catch {
		return false;
	}
}

/**
 * Probe each Termux:API tool. Returns all-false outside Termux without
 * spawning any child processes, so it is safe to call on every startup.
 *
 * @param env - Optional environment override (used by tests).
 */
export function detectTermuxApi(env: NodeJS.ProcessEnv = process.env): TermuxApiCapabilities {
	if (!isTermuxEnvironment(env)) return { ...NEVER };
	const caps: TermuxApiCapabilities = { ...NEVER };
	let any = false;
	for (const key of Object.keys(TERMUX_API_COMMANDS) as TermuxApiTool[]) {
		const ok = commandExists(TERMUX_API_COMMANDS[key]);
		caps[key] = ok;
		any = any || ok;
	}
	caps.available = any;
	return caps;
}

/**
 * Cache key for {@link getTermuxApiCapabilities}. The value is keyed on
 * a small subset of process.env so tests can reset by passing a fresh env.
 */
let cachedCaps: { key: string; caps: TermuxApiCapabilities } | undefined;

function envFingerprint(env: NodeJS.ProcessEnv): string {
	return [env.TERMUX_VERSION ?? "", env.PREFIX ?? "", env.HOME ?? "", env.PATH ?? ""].join("\0");
}

/**
 * Memoized variant of {@link detectTermuxApi}. Probes once per process
 * (per env fingerprint). Use this from the hot path; use detectTermuxApi
 * directly when you need a fresh probe.
 */
export function getTermuxApiCapabilities(env: NodeJS.ProcessEnv = process.env): TermuxApiCapabilities {
	const key = envFingerprint(env);
	if (cachedCaps && cachedCaps.key === key) return cachedCaps.caps;
	const caps = detectTermuxApi(env);
	cachedCaps = { key, caps };
	return caps;
}

/** Clear the {@link getTermuxApiCapabilities} cache. Test-only. */
export function resetTermuxApiCache(): void {
	cachedCaps = undefined;
}

interface RunOptions {
	/** Maximum total runtime for the command. Default: 3000ms. */
	timeoutMs?: number;
	/** Optional stdin payload (e.g. JSON for termux-notification --content -). */
	input?: string;
}

interface RunResult {
	ok: boolean;
	stdout: string;
	stderr: string;
	status: number | null;
	error?: string;
}

function runTermuxCommand(command: string, args: string[], options: RunOptions = {}): RunResult {
	try {
		const result = spawnSync(command, args, {
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
			timeout: options.timeoutMs ?? 3000,
			input: options.input,
		});
		if (result.error) {
			return {
				ok: false,
				stdout: result.stdout ?? "",
				stderr: result.stderr ?? "",
				status: result.status,
				error: result.error.message,
			};
		}
		const ok = result.status === 0;
		return {
			ok,
			stdout: result.stdout ?? "",
			stderr: result.stderr ?? "",
			status: result.status,
		};
	} catch (error) {
		return {
			ok: false,
			stdout: "",
			stderr: "",
			status: null,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export interface TermuxNotifyOptions {
	title: string;
	content: string;
	/** Stable id, used to update or dismiss the notification later. */
	id?: string;
	/** Notification priority: low|default|high|max. Default: default. */
	priority?: "low" | "default" | "high" | "max";
	/** Sound feedback. Default: false. */
	sound?: boolean;
	/** Group key to bundle notifications. */
	group?: string;
}

/**
 * Send an Android notification via `termux-notification`.
 *
 * Returns `false` and is a no-op if Termux:API is not installed.
 * Never throws — safe to call from event handlers.
 */
export function termuxNotify(opts: TermuxNotifyOptions): boolean {
	const caps = getTermuxApiCapabilities();
	if (!caps.notification) return false;
	const args = ["--title", opts.title, "--content", opts.content];
	if (opts.id) args.push("--id", opts.id);
	if (opts.priority) args.push("--priority", opts.priority);
	if (opts.sound) args.push("--sound");
	if (opts.group) args.push("--group", opts.group);
	return runTermuxCommand("termux-notification", args, { timeoutMs: 3000 }).ok;
}

/**
 * Trigger haptic feedback via `termux-vibrate`.
 *
 * @param durationMs - Vibration duration. Clamped to [10, 5000].
 */
export function termuxVibrate(durationMs = 200): boolean {
	const caps = getTermuxApiCapabilities();
	if (!caps.vibrate) return false;
	const clamped = Math.max(10, Math.min(5000, Math.round(durationMs)));
	return runTermuxCommand("termux-vibrate", ["-d", String(clamped)], { timeoutMs: 3000 }).ok;
}

export interface TermuxToastOptions {
	/** "short" (~2s) or "long" (~3.5s). Default: "short". */
	duration?: "short" | "long";
	/** "top" | "middle" | "bottom". Default: "middle". */
	position?: "top" | "middle" | "bottom";
	/** Background color (hex). */
	background?: string;
	/** Text color (hex). */
	color?: string;
}

/**
 * Show a transient Android toast via `termux-toast`.
 * Toast text is passed via stdin so it does not get truncated by argv parsing.
 */
export function termuxToast(message: string, opts: TermuxToastOptions = {}): boolean {
	const caps = getTermuxApiCapabilities();
	if (!caps.toast) return false;
	const args: string[] = [];
	if (opts.duration === "short") args.push("-s");
	if (opts.position) args.push("-g", opts.position);
	if (opts.background) args.push("-b", opts.background);
	if (opts.color) args.push("-c", opts.color);
	return runTermuxCommand("termux-toast", args, { timeoutMs: 3000, input: message }).ok;
}

export interface TermuxShareOptions {
	/** Default action: "edit" | "send" | "view". Default: "view". */
	action?: "edit" | "send" | "view";
	/** Title for the share dialog. */
	title?: string;
	/** MIME type override (e.g. "text/html", "text/plain"). */
	mime?: string;
}

/**
 * Open the Android share sheet for `filePath` via `termux-share`.
 */
export function termuxShare(filePath: string, opts: TermuxShareOptions = {}): boolean {
	const caps = getTermuxApiCapabilities();
	if (!caps.share) return false;
	const args: string[] = [];
	if (opts.action) args.push("-a", opts.action);
	if (opts.title) args.push("-t", opts.title);
	if (opts.mime) args.push("-c", opts.mime);
	args.push(filePath);
	return runTermuxCommand("termux-share", args, { timeoutMs: 5000 }).ok;
}

/**
 * Read text from the Android system clipboard via `termux-clipboard-get`.
 *
 * Returns `undefined` when Termux:API is missing or the call fails.
 * Note: image clipboard is not supported by termux-clipboard-get (text only);
 * see clipboard-image.ts for the corresponding hard-coded skip.
 */
export function termuxClipboardGet(): string | undefined {
	const caps = getTermuxApiCapabilities();
	if (!caps.clipboardGet) return undefined;
	const result = runTermuxCommand("termux-clipboard-get", [], { timeoutMs: 2000 });
	if (!result.ok) return undefined;
	return result.stdout;
}

/**
 * Write text to the Android system clipboard via `termux-clipboard-set`.
 */
export function termuxClipboardSet(text: string): boolean {
	const caps = getTermuxApiCapabilities();
	if (!caps.clipboardSet) return false;
	return runTermuxCommand("termux-clipboard-set", [], { timeoutMs: 2000, input: text }).ok;
}

/**
 * Sorted list of [tool id, command name] pairs. Useful for /doctor and
 * /termux-status renderers that show a status line per tool.
 */
export function listTermuxApiTools(): ReadonlyArray<readonly [TermuxApiTool, string]> {
	return Object.entries(TERMUX_API_COMMANDS).sort(([a], [b]) => a.localeCompare(b)) as ReadonlyArray<
		readonly [TermuxApiTool, string]
	>;
}

/**
 * Aggregate Termux runtime state for the /termux-status command. Pure data
 * only — formatting lives in the interactive renderer so the snapshot
 * stays unit-testable.
 */
export interface TermuxStatusSnapshot {
	isTermux: boolean;
	termuxVersion: string | undefined;
	prefix: string | undefined;
	home: string | undefined;
	capabilities: TermuxApiCapabilities;
	/** How many of the catalog tools are present. */
	availableCount: number;
	/** Total number of tools in the catalog. */
	totalCount: number;
}

/**
 * Snapshot the Termux:API runtime. Cheap; safe to call on demand.
 */
export function getTermuxStatusSnapshot(env: NodeJS.ProcessEnv = process.env): TermuxStatusSnapshot {
	const capabilities = detectTermuxApi(env);
	const tools = listTermuxApiTools();
	const availableCount = tools.reduce((acc, [id]) => acc + (capabilities[id] ? 1 : 0), 0);
	return {
		isTermux: isTermuxEnvironment(env),
		termuxVersion: env.TERMUX_VERSION,
		prefix: env.PREFIX,
		home: env.HOME,
		capabilities,
		availableCount,
		totalCount: tools.length,
	};
}

/**
 * Compact summary string used by /doctor: `"4/6 tools (notification, vibrate, …)"`
 * or `"not installed"` when the package is absent.
 */
export function summarizeTermuxApiCapabilities(caps: TermuxApiCapabilities, totalCount?: number): string {
	const total = totalCount ?? listTermuxApiTools().length;
	if (!caps.available) return "not installed; pkg install termux-api";
	const present: string[] = [];
	for (const [id] of listTermuxApiTools()) {
		if (caps[id]) present.push(id);
	}
	return `${present.length}/${total} tools (${present.join(", ")})`;
}
