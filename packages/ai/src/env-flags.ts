/**
 * Centralized accessors for `NEO_CODE_*` and `NEOSANTARA_*` runtime flags
 * read from `process.env`.
 *
 * Putting all env reads in one place makes them discoverable from a single
 * grep, lets us hide platform quirks (Bun `/proc/self/environ` fallback) in
 * one place, and gives docs a single source of truth.
 *
 * Add new flags here when you start reading them; do not sprinkle
 * `process.env.NEO_CODE_*` reads across the codebase.
 */

import type { CacheRetention } from "./types.js";

const TRUTHY = new Set(["1", "true", "yes", "on"]);

/**
 * Read a string env variable, returning `undefined` when absent or empty.
 * Trims whitespace.
 */
export function readEnvString(name: string): string | undefined {
	if (typeof process === "undefined") return undefined;
	const raw = process.env[name];
	if (typeof raw !== "string") return undefined;
	const trimmed = raw.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Read a boolean-ish env variable. Recognized truthy values: `1`, `true`,
 * `yes`, `on` (case-insensitive). Anything else, including absent, returns
 * `false`.
 */
export function readEnvBool(name: string): boolean {
	const value = readEnvString(name)?.toLowerCase();
	return value !== undefined && TRUTHY.has(value);
}

/**
 * Resolve cache retention preference for OpenAI-compatible transports.
 *
 * Order of precedence:
 * 1. Explicit `cacheRetention` argument from caller options.
 * 2. `NEO_CODE_CACHE_RETENTION=long` opt-in.
 * 3. Default `"short"`.
 */
export function resolveCacheRetention(cacheRetention?: CacheRetention): CacheRetention {
	if (cacheRetention) return cacheRetention;
	if (readEnvString("NEO_CODE_CACHE_RETENTION")?.toLowerCase() === "long") return "long";
	return "short";
}
