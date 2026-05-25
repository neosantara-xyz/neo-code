import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const NEO_TERMUX_EXTRA_KEYS =
	"[['ESC','/','-','|',{key:'UP',popup:'PGUP'},'~','BKSP']," +
	"['TAB','CTRL','ALT',{key:'LEFT',popup:'HOME'},{key:'DOWN',popup:'PGDN'},{key:'RIGHT',popup:'END'},'DEL']]";

export interface TermuxTouchKeyboardStatus {
	isTermux: boolean;
	propertiesPath: string;
	exists: boolean;
	hasExtraKeys: boolean;
	usesNeoLayout: boolean;
	reloadCommandAvailable: boolean;
}

export interface ApplyTermuxTouchKeyboardResult extends TermuxTouchKeyboardStatus {
	backupPath?: string;
	reloadAttempted: boolean;
	reloadOk: boolean;
	reloadMessage?: string;
}

export function isTermuxEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
	return Boolean(env.TERMUX_VERSION || env.PREFIX?.includes("/com.termux/") || env.HOME?.includes("/com.termux/"));
}

export function getTermuxPropertiesPath(home = homedir()): string {
	return join(home, ".termux", "termux.properties");
}

function normalizeExtraKeys(text: string): string {
	return text.replace(/\s+/g, "").replace(/"/g, "'");
}

export function hasNeoTermuxExtraKeys(text: string): boolean {
	return normalizeExtraKeys(text).includes(normalizeExtraKeys(`extra-keys = ${NEO_TERMUX_EXTRA_KEYS}`));
}

export function replaceTermuxExtraKeysProperty(existing: string, extraKeys = NEO_TERMUX_EXTRA_KEYS): string {
	const lines = existing.replace(/\r\n/g, "\n").split("\n");
	const next: string[] = [];
	let replaced = false;
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index] ?? "";
		if (/^\s*extra-keys\s*=/.test(line)) {
			if (!replaced) {
				next.push(`extra-keys = ${extraKeys}`);
				replaced = true;
			}
			while (/\\\s*$/.test(lines[index] ?? "") && index + 1 < lines.length) {
				index++;
			}
			continue;
		}
		next.push(line);
	}
	if (!replaced) {
		if (next.length > 0 && next[next.length - 1] !== "") next.push("");
		next.push("# Neo Code touch keyboard layout for Termux");
		next.push(`extra-keys = ${extraKeys}`);
	}
	return next.join("\n").replace(/\n*$/, "\n");
}

function commandExists(command: string): boolean {
	const result = spawnSync("sh", ["-c", `command -v ${command}`], {
		encoding: "utf8",
		stdio: "pipe",
		timeout: 2000,
	});
	return result.status === 0;
}

export function getTermuxTouchKeyboardStatus(
	options: { home?: string; env?: NodeJS.ProcessEnv } = {},
): TermuxTouchKeyboardStatus {
	const home = options.home ?? homedir();
	const propertiesPath = getTermuxPropertiesPath(home);
	const exists = existsSync(propertiesPath);
	const content = exists ? readFileSync(propertiesPath, "utf8") : "";
	return {
		isTermux: isTermuxEnvironment(options.env),
		propertiesPath,
		exists,
		hasExtraKeys: /^\s*extra-keys\s*=/m.test(content),
		usesNeoLayout: hasNeoTermuxExtraKeys(content),
		reloadCommandAvailable: commandExists("termux-reload-settings"),
	};
}

function createBackup(propertiesPath: string): string | undefined {
	if (!existsSync(propertiesPath)) return undefined;
	const backupPath = `${propertiesPath}.neo-backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
	writeFileSync(backupPath, readFileSync(propertiesPath));
	return backupPath;
}

export function applyNeoTermuxTouchKeyboard(
	options: { home?: string; env?: NodeJS.ProcessEnv } = {},
): ApplyTermuxTouchKeyboardResult {
	const home = options.home ?? homedir();
	const propertiesPath = getTermuxPropertiesPath(home);
	mkdirSync(dirname(propertiesPath), { recursive: true });
	const existing = existsSync(propertiesPath) ? readFileSync(propertiesPath, "utf8") : "";
	const backupPath = createBackup(propertiesPath);
	writeFileSync(propertiesPath, replaceTermuxExtraKeysProperty(existing), "utf8");

	let reloadAttempted = false;
	let reloadOk = false;
	let reloadMessage: string | undefined;
	if (commandExists("termux-reload-settings")) {
		reloadAttempted = true;
		const reload = spawnSync("termux-reload-settings", [], {
			encoding: "utf8",
			stdio: "pipe",
			timeout: 5000,
		});
		reloadOk = reload.status === 0;
		reloadMessage = `${reload.stdout ?? ""}${reload.stderr ?? ""}`.trim() || `exit ${reload.status ?? "unknown"}`;
	}
	return {
		...getTermuxTouchKeyboardStatus({ home, env: options.env }),
		backupPath,
		reloadAttempted,
		reloadOk,
		reloadMessage,
	};
}

export function findLatestTermuxPropertiesBackup(home = homedir()): string | undefined {
	const propertiesPath = getTermuxPropertiesPath(home);
	const dir = dirname(propertiesPath);
	if (!existsSync(dir)) return undefined;
	const prefix = "termux.properties.neo-backup-";
	const backups = readdirSync(dir)
		.filter((name) => name.startsWith(prefix))
		.sort();
	const latest = backups.at(-1);
	return latest ? join(dir, latest) : undefined;
}

export function restoreLatestTermuxTouchKeyboardBackup(home = homedir()): string | undefined {
	const latest = findLatestTermuxPropertiesBackup(home);
	if (!latest) return undefined;
	const propertiesPath = getTermuxPropertiesPath(home);
	writeFileSync(propertiesPath, readFileSync(latest));
	if (commandExists("termux-reload-settings")) {
		spawnSync("termux-reload-settings", [], { encoding: "utf8", stdio: "pipe", timeout: 5000 });
	}
	return latest;
}
