import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "../../config.js";

/**
 * On-disk schema for `~/.neo-code/agent/tip-history.json`.
 * Persisted between sessions so cooldowns survive restarts.
 */
interface TipHistoryFile {
	/** Number of interactive sessions started so far. */
	numStartups: number;
	/** Map of tip id to the `numStartups` value at which the tip was last shown. */
	history: Record<string, number>;
}

const EMPTY: TipHistoryFile = {
	numStartups: 0,
	history: {},
};

/**
 * Storage abstraction so the scheduler can be exercised in tests without
 * hitting the filesystem. The default implementation is {@link FileTipHistoryStore}.
 */
export interface TipHistoryStore {
	getNumStartups(): number;
	bumpNumStartups(): number;
	getSessionsSinceLastShown(tipId: string): number;
	recordShown(tipId: string): void;
}

/**
 * Resolve the default tip-history file path. Honors `NEO_CODE_CODING_AGENT_DIR`
 * via {@link getAgentDir}, so test/CI environments can isolate writes.
 */
export function getDefaultTipHistoryPath(): string {
	return join(getAgentDir(), "tip-history.json");
}

function readFile(path: string): TipHistoryFile {
	if (!existsSync(path)) return { numStartups: 0, history: {} };
	let raw: string;
	try {
		raw = readFileSync(path, "utf-8");
	} catch {
		return { numStartups: 0, history: {} };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { numStartups: 0, history: {} };
	}
	if (typeof parsed !== "object" || parsed === null) {
		return { numStartups: 0, history: {} };
	}
	const obj = parsed as Partial<TipHistoryFile>;
	const numStartups =
		typeof obj.numStartups === "number" && Number.isFinite(obj.numStartups) && obj.numStartups >= 0
			? Math.floor(obj.numStartups)
			: 0;
	const history: Record<string, number> = {};
	if (obj.history && typeof obj.history === "object") {
		for (const [key, value] of Object.entries(obj.history)) {
			if (typeof key !== "string" || key.length === 0) continue;
			if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
			history[key] = Math.floor(value);
		}
	}
	return { numStartups, history };
}

function writeFile(path: string, data: TipHistoryFile): void {
	const dir = dirname(path);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
	writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
	try {
		renameSync(tmp, path);
	} catch (error) {
		try {
			unlinkSync(tmp);
		} catch {
			// best effort: leave temp behind if we cannot remove it
		}
		throw error;
	}
}

/**
 * Filesystem-backed history store. Cached in memory after construction;
 * writes are debounced through {@link FileTipHistoryStore.persist}, which
 * uses an atomic rename so concurrent agents cannot read partial JSON.
 */
export class FileTipHistoryStore implements TipHistoryStore {
	private cache: TipHistoryFile;

	constructor(private readonly path: string = getDefaultTipHistoryPath()) {
		this.cache = readFile(path);
	}

	getNumStartups(): number {
		return this.cache.numStartups;
	}

	bumpNumStartups(): number {
		this.cache = {
			numStartups: this.cache.numStartups + 1,
			history: this.cache.history,
		};
		this.persist();
		return this.cache.numStartups;
	}

	getSessionsSinceLastShown(tipId: string): number {
		const lastShown = this.cache.history[tipId];
		if (typeof lastShown !== "number") return Number.POSITIVE_INFINITY;
		return Math.max(0, this.cache.numStartups - lastShown);
	}

	recordShown(tipId: string): void {
		if (this.cache.history[tipId] === this.cache.numStartups) return;
		this.cache = {
			numStartups: this.cache.numStartups,
			history: { ...this.cache.history, [tipId]: this.cache.numStartups },
		};
		this.persist();
	}

	private persist(): void {
		try {
			writeFile(this.path, this.cache);
		} catch {
			// Tip history is non-critical: failing to persist must not break the app.
		}
	}
}

/**
 * In-memory store for tests and ephemeral environments. State is lost on
 * process exit and never touches disk.
 */
export class InMemoryTipHistoryStore implements TipHistoryStore {
	private numStartups: number;
	private readonly history: Map<string, number>;

	constructor(initial?: { numStartups?: number; history?: Record<string, number> }) {
		this.numStartups = initial?.numStartups ?? 0;
		this.history = new Map();
		if (initial?.history) {
			for (const [key, value] of Object.entries(initial.history)) {
				if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
					this.history.set(key, Math.floor(value));
				}
			}
		}
	}

	getNumStartups(): number {
		return this.numStartups;
	}

	bumpNumStartups(): number {
		this.numStartups += 1;
		return this.numStartups;
	}

	getSessionsSinceLastShown(tipId: string): number {
		const lastShown = this.history.get(tipId);
		if (lastShown === undefined) return Number.POSITIVE_INFINITY;
		return Math.max(0, this.numStartups - lastShown);
	}

	recordShown(tipId: string): void {
		this.history.set(tipId, this.numStartups);
	}
}

export const __test__ = {
	EMPTY_FILE: EMPTY,
};
