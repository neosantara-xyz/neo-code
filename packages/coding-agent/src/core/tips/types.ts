import type { Settings } from "../settings-manager.js";

/**
 * Inputs available to {@link Tip.isRelevant} predicates.
 *
 * Predicates must be pure and synchronous: they run on every spinner tip
 * pick and should not perform IO or block. Anything dynamic that the
 * registry needs at decision time should be placed on this object.
 */
export interface TipContext {
	/** Merged user + project settings as resolved at session start. */
	settings: Settings;
	/** Node platform string (`"linux"`, `"darwin"`, `"win32"`, …). */
	platform: NodeJS.Platform;
	/** True when running inside Termux on Android. */
	isTermux: boolean;
	/**
	 * True when the Termux:API package is installed and at least one
	 * `termux-*` companion binary is on PATH. Always `false` outside Termux.
	 * Populated once at startup via {@link detectTermuxApi}.
	 */
	termuxApiAvailable: boolean;
	/** True when the active terminal is reached over SSH/Mosh. */
	isSshSession: boolean;
	/** Number of interactive sessions started so far (1-based). */
	numStartups: number;
	/**
	 * Current context window utilization as a percentage (0–100), or
	 * `undefined` when not yet known. Used by render-time overrides such as
	 * the high-context `/compact` reminder; built-in {@link Tip.isRelevant}
	 * predicates may also key off this when needed.
	 */
	contextPercent?: number;
}

/**
 * A single rotating spinner tip.
 *
 * Tips are picked once per agent turn (see `tip-scheduler.ts`). They are
 * filtered by {@link Tip.isRelevant} and a per-id session cooldown stored
 * in the tip-history file. The catalog of built-in tips lives in
 * `tip-registry.ts`.
 */
export interface Tip {
	/**
	 * Stable identifier. Used as the cooldown key in the tip-history store
	 * and must remain consistent across releases for cooldown to work.
	 */
	id: string;
	/**
	 * Plain text content. The interactive renderer wraps this with the
	 * `tip:` prefix and a tree branch character — do not prefix manually.
	 */
	content: string;
	/**
	 * Number of session starts to wait after a tip is shown before it
	 * becomes eligible again. `0` means it can show every session.
	 */
	cooldownSessions: number;
	/**
	 * Returns `true` when the tip should be considered for selection in
	 * the current context. Predicates must be pure and synchronous.
	 */
	isRelevant: (ctx: TipContext) => boolean;
}
