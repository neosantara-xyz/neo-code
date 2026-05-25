import { homedir } from "node:os";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { formatSize } from "./truncate.js";

export type ToolActivityKind = "search" | "read" | "list" | "write" | "edit" | "command" | "agent" | "other";

export interface ToolActivityClassification {
	kind: ToolActivityKind;
	verb: string;
	title: string;
	compact: string;
	detail?: string;
	isSearchOrRead: boolean;
}

export interface ToolActivityResultSummary {
	label: string;
	status: "running" | "success" | "neutral" | "error";
	count?: number;
}

export type ToolActivityGroupIntent = "inspect" | "command" | "mutation" | "other";

export type ToolActivityKindCounts = Partial<Record<ToolActivityKind, number>>;

export interface ToolActivityGroupFormatOptions {
	minimumCounts?: ToolActivityKindCounts;
	/**
	 * Layout density. `full` shows kind branches with target detail rows.
	 * `compact` drops target detail rows (one line per kind).
	 * `tight` collapses everything to a single short summary line.
	 */
	layout?: "full" | "compact" | "tight";
	/**
	 * Optional theme-driven kind icons. Falls back to plain branch connector
	 * (`├─`/`└─`) when omitted, which keeps the existing ASCII-friendly look.
	 */
	icons?: Partial<Record<ToolActivityKind, string>>;
	/**
	 * When true, single-tool runs combine the action and short result onto the
	 * same line instead of two rows. Defaults to false to keep stable layout.
	 */
	inlineSingleTool?: boolean;
}

type TextBlock = {
	type: string;
	text?: string;
	data?: string;
	mimeType?: string;
};

type ToolActivityKnownDetails = {
	truncation?: { outputLines?: number; totalLines?: number; truncated?: boolean };
	fullOutputPath?: string;
	exitCode?: number | null;
	noMatches?: boolean;
	progress?: BashProgressLike;
	backgroundTaskId?: string;
	backgroundOutputPath?: string;
	backgrounded?: boolean;
	lineCount?: number;
	totalLineCount?: number;
	entryCount?: number;
	fileCount?: number;
	directoryCount?: number;
	matchCount?: number;
	matchedFileCount?: number;
	resultCount?: number;
	editCount?: number;
};

type ToolResultLike = {
	content?: TextBlock[];
	details?: unknown;
};

function knownDetails(result: ToolResultLike | undefined): ToolActivityKnownDetails | undefined {
	return result?.details && typeof result.details === "object"
		? (result.details as ToolActivityKnownDetails)
		: undefined;
}

const SEARCH_COMMAND_RE = /(?:^|[\s|;&({])(?:grep|egrep|fgrep|rg|ag|ack)\b/;
const FIND_COMMAND_RE = /(?:^|[\s|;&({])(?:find|fd|git\s+ls-files)\b/;
const LIST_COMMAND_RE = /(?:^|[\s|;&({])(?:ls|tree)\b/;
const READ_COMMAND_RE = /(?:^|[\s|;&({])(?:cat|head|tail|sed)\b/;
const INSTALL_COMMAND_RE = /(?:^|[\s|;&({])(?:npm|pnpm|yarn|bun)\s+(?:i|install|add|remove|uninstall)\b/;
const TEST_COMMAND_RE =
	/(?:^|[\s|;&({])(?:npm|pnpm|yarn|bun)\s+(?:test|run\s+test)|(?:^|[\s|;&({])(?:vitest|jest|mocha|node\s+--test|pytest)\b/;
const PATH_BOUNDARY_RE_SOURCE = String.raw`[\s'"\)\]};:,.]`;

function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function toDisplaySeparators(value: string): string {
	return value.replace(/\\/g, "/");
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function displayPath(filePath: string, fallback = "."): string {
	const raw = filePath.trim();
	if (!raw) return fallback;

	const cwd = resolve(process.cwd());
	const expandedHome = homedir();
	const absolutePath = isAbsolute(raw) ? resolve(raw) : undefined;
	if (absolutePath) {
		const relativePath = relative(cwd, absolutePath);
		const isInsideCwd =
			relativePath === "" ||
			(relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath));
		if (isInsideCwd) return toDisplaySeparators(relativePath || ".");

		if (absolutePath === expandedHome) return "~";
		if (absolutePath.startsWith(`${expandedHome}${sep}`)) {
			return `~/${toDisplaySeparators(absolutePath.slice(expandedHome.length + 1))}`;
		}
	}

	return toDisplaySeparators(raw);
}

function normalizeKnownPaths(value: string): string {
	const cwd = toDisplaySeparators(resolve(process.cwd()));
	const home = toDisplaySeparators(homedir());
	let normalized = toDisplaySeparators(value);

	if (cwd !== "/") {
		normalized = normalized.replace(new RegExp(`${escapeRegExp(cwd)}(?=$|${PATH_BOUNDARY_RE_SOURCE})`, "g"), ".");
		normalized = normalized.replace(new RegExp(`${escapeRegExp(cwd)}/`, "g"), "");
	}
	if (home !== "/") {
		normalized = normalized.replace(new RegExp(`${escapeRegExp(home)}(?=$|${PATH_BOUNDARY_RE_SOURCE})`, "g"), "~");
		normalized = normalized.replace(new RegExp(`${escapeRegExp(home)}/`, "g"), "~/");
	}

	return normalized;
}

export function compactText(value: string | undefined, maxLength = 72): string {
	const normalized = normalizeWhitespace(normalizeKnownPaths(value ?? ""));
	if (normalized.length <= maxLength) return normalized;
	return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function quotePattern(value: unknown): string {
	if (typeof value !== "string") return "...";
	const compact = compactText(value, 44);
	return compact ? `/${compact}/` : "/.../";
}

function pathLabel(value: unknown, fallback = "."): string {
	if (typeof value !== "string") return fallback;
	const normalized = displayPath(value || fallback, fallback);
	return compactText(normalized, 48) || fallback;
}

function getTextOutput(result: ToolResultLike | undefined): string {
	return (result?.content ?? [])
		.filter((block) => block.type === "text")
		.map((block) => block.text ?? "")
		.join("\n")
		.replace(/\r/g, "");
}

function outputDataLines(output: string): string[] {
	return output
		.split("\n")
		.map((line) => line.trimEnd())
		.filter((line) => {
			const trimmed = line.trim();
			if (!trimmed) return false;
			if (/^\[[^\]]+\]$/.test(trimmed)) return false;
			if (/^No (?:files |matches )?found/i.test(trimmed)) return false;
			if (/^\(no output\)$/i.test(trimmed)) return false;
			if (/^\(empty directory\)$/i.test(trimmed)) return false;
			return true;
		});
}

function outputDisplayLines(output: string): string[] {
	const normalized = output.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	const lines = normalized.endsWith("\n") ? normalized.slice(0, -1).split("\n") : normalized.split("\n");
	return lines.filter((line) => {
		const trimmed = line.trim();
		if (/^\[[^\]]+\]$/.test(trimmed)) return false;
		if (/^No (?:files |matches )?found/i.test(trimmed)) return false;
		if (/^\(no output\)$/i.test(trimmed)) return false;
		if (/^\(empty directory\)$/i.test(trimmed)) return false;
		return true;
	});
}

function countOutputDisplayLines(output: string): number {
	if (!output) return 0;
	return outputDisplayLines(output).length;
}

function formatListCount(fileCount: number, directoryCount: number, totalCount: number): string {
	if (totalCount === 0) return "empty directory";
	if (directoryCount === 0) return `${plural(fileCount, "file")} found`;
	if (fileCount === 0) return `${plural(directoryCount, "directory", "directories")} found`;
	return `${plural(fileCount, "file")} + ${plural(directoryCount, "directory", "directories")} found`;
}

function countListedEntriesFromOutput(output: string): { total: number; files: number; directories: number } {
	const lines = outputDataLines(output);
	let directories = 0;
	for (const line of lines) {
		if (line.endsWith("/")) directories += 1;
	}
	return { total: lines.length, files: lines.length - directories, directories };
}

function countMatchedFilesFromOutput(output: string): number | undefined {
	const files = new Set<string>();
	for (const line of outputDataLines(output)) {
		const match = line.match(/^([^:\n]+):\d+:/);
		if (match?.[1]) files.add(match[1]);
	}
	return files.size > 0 ? files.size : undefined;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
	return `${count} ${count === 1 ? singular : pluralForm}`;
}

type BashProgressLike = {
	elapsedMs?: number;
	totalLines?: number;
	totalBytes?: number;
	timeout?: number;
};

function formatDuration(ms: number): string {
	return `${(ms / 1000).toFixed(1)}s`;
}

function getBashProgress(details: unknown): BashProgressLike | undefined {
	if (!details || typeof details !== "object") return undefined;
	const progress = (details as { progress?: BashProgressLike }).progress;
	if (!progress || typeof progress !== "object") return undefined;
	return progress;
}

function formatBashProgress(details: unknown): string | undefined {
	const progress = getBashProgress(details);
	if (!progress || typeof progress.elapsedMs !== "number") return undefined;
	const parts = [formatDuration(progress.elapsedMs)];
	if (typeof progress.totalLines === "number" && progress.totalLines > 1) {
		parts.push(`${progress.totalLines.toLocaleString()} lines`);
	}
	if (typeof progress.totalBytes === "number" && progress.totalBytes > 0) {
		parts.push(formatSize(progress.totalBytes));
	}
	if (typeof progress.timeout === "number" && progress.timeout > 0) {
		parts.push(`timeout ${progress.timeout}s`);
	}
	return parts.join(" · ");
}

export function classifyBashCommand(command: string | undefined, description?: string): ToolActivityClassification {
	const aiSummary = compactText(description, 86);
	const compact = aiSummary || compactText(command, 86) || "...";
	const normalized = normalizeWhitespace(command ?? "");
	if (SEARCH_COMMAND_RE.test(normalized)) {
		return {
			kind: "search",
			verb: "searched",
			title: "Searching files",
			compact: aiSummary || compactSearchCommand(normalized) || compact,
			isSearchOrRead: true,
		};
	}
	if (FIND_COMMAND_RE.test(normalized)) {
		return {
			kind: "search",
			verb: "found",
			title: "Finding files",
			compact: aiSummary || compactFindCommand(normalized) || compact,
			isSearchOrRead: true,
		};
	}
	if (LIST_COMMAND_RE.test(normalized)) {
		return {
			kind: "list",
			verb: "listed",
			title: "Listing files",
			compact: aiSummary || compactListCommand(normalized) || compact,
			isSearchOrRead: true,
		};
	}
	if (READ_COMMAND_RE.test(normalized)) {
		return {
			kind: "read",
			verb: "read",
			title: "Reading files",
			compact: aiSummary || compactReadCommand(normalized) || compact,
			isSearchOrRead: true,
		};
	}
	if (TEST_COMMAND_RE.test(normalized)) {
		return {
			kind: "command",
			verb: "ran",
			title: "Running tests",
			compact,
			isSearchOrRead: false,
		};
	}
	if (INSTALL_COMMAND_RE.test(normalized)) {
		return {
			kind: "command",
			verb: "ran",
			title: "Installing packages",
			compact,
			isSearchOrRead: false,
		};
	}
	return {
		kind: "command",
		verb: "ran",
		title: "Running command",
		compact,
		isSearchOrRead: false,
	};
}

function compactSearchCommand(command: string): string | undefined {
	const quoted = command.match(/(?:grep|egrep|fgrep|rg|ag|ack)\s+(?:-[^\s]+\s+)*(?:--\s+)?(["'])(.*?)\1/);
	if (quoted?.[2]) return `search ${compactText(quoted[2], 42)}`;
	const regex = command.match(/-E\s+(["'])(.*?)\1/);
	if (regex?.[2]) return `search ${compactText(regex[2], 42)}`;
	return "search files";
}

function compactFindCommand(command: string): string | undefined {
	if (/\.tsx?\b|\.jsx?\b|\.py\b|\.md\b/.test(command)) return "find source files";
	return "find files";
}

function compactListCommand(command: string): string | undefined {
	const match = command.match(/(?:ls|tree)\s+(?:-[^\s]+\s+)*([^|;&]+)?/);
	return `list ${compactText(match?.[1]?.trim() || ".", 42)}`;
}

function compactReadCommand(command: string): string | undefined {
	const match = command.match(/(?:cat|head|tail|sed)\b(?:\s+[^|;&]*)?/);
	return compactText(match?.[0] || "read file", 56);
}

export function isSearchOrReadBashCommand(command: string | undefined): boolean {
	return classifyBashCommand(command).isSearchOrRead;
}

export function isNoMatchBashExit(command: string | undefined, exitCode: number | null, output: string): boolean {
	if (exitCode !== 1) return false;
	const normalized = normalizeWhitespace(command ?? "");
	if (!SEARCH_COMMAND_RE.test(normalized)) return false;
	return outputDataLines(output).length === 0;
}

export function isBenignBashExit(command: string | undefined, exitCode: number | null, output: string): boolean {
	if (exitCode === 0 || exitCode === null) return true;
	if (isNoMatchBashExit(command, exitCode, output)) return true;
	const normalized = normalizeWhitespace(command ?? "");
	// `diff` returns 1 when files differ; it is a useful result, not a shell failure.
	if (exitCode === 1 && /(?:^|[\s|;&({])diff\b/.test(normalized)) return true;
	return false;
}

export function summarizeToolCall(toolName: string, args: any): ToolActivityClassification {
	switch (toolName) {
		case "bash":
			return classifyBashCommand(
				typeof args?.command === "string" ? args.command : undefined,
				typeof args?.description === "string" ? args.description : undefined,
			);
		case "grep": {
			const pattern = quotePattern(args?.pattern);
			const location = pathLabel(args?.path);
			const glob = typeof args?.glob === "string" && args.glob ? ` ${args.glob}` : "";
			return {
				kind: "search",
				verb: "searched",
				title: "Searching files",
				compact: `grep ${pattern}${glob} in ${location}`,
				isSearchOrRead: true,
			};
		}
		case "find":
			return {
				kind: "search",
				verb: "found",
				title: "Finding files",
				compact: `find ${compactText(args?.pattern, 44) || "files"} in ${pathLabel(args?.path)}`,
				isSearchOrRead: true,
			};
		case "read":
			return {
				kind: "read",
				verb: "read",
				title: "Reading file",
				compact: `read ${pathLabel(args?.file_path ?? args?.path, "file")}`,
				isSearchOrRead: true,
			};
		case "ls":
			return {
				kind: "list",
				verb: "listed",
				title: "Listing files",
				compact: `list ${pathLabel(args?.path)}`,
				isSearchOrRead: true,
			};
		case "write":
			return {
				kind: "write",
				verb: "wrote",
				title: "Writing file",
				compact: `write ${pathLabel(args?.file_path ?? args?.path, "file")}`,
				isSearchOrRead: false,
			};
		case "edit":
			return {
				kind: "edit",
				verb: "edited",
				title: "Editing file",
				compact: `edit ${pathLabel(args?.file_path ?? args?.path, "file")}`,
				isSearchOrRead: false,
			};
		case "ExitPlanMode":
			return {
				kind: "other",
				verb: "submitted",
				title: "Submitting plan",
				compact: compactText(args?.plan, 86) || "final plan",
				isSearchOrRead: false,
			};
		case "agent":
			return {
				kind: "agent",
				verb: "dispatched",
				title: "Sub-agent",
				compact: `@${compactText(args?.name || args?.agent_name || "agent", 30)}: ${compactText(args?.prompt || args?.task || "working", 50)}`,
				isSearchOrRead: false,
			};
		default:
			return {
				kind: "other",
				verb: "used",
				title: `Using ${toolName}`,
				compact: toolName,
				isSearchOrRead: false,
			};
	}
}

export function parseDiffStats(diff: string | undefined): { added: number; removed: number } | undefined {
	if (!diff) return undefined;
	let added = 0;
	let removed = 0;
	for (const line of diff.split("\n")) {
		if (line.startsWith("+") && !line.startsWith("+++")) added++;
		else if (line.startsWith("-") && !line.startsWith("---")) removed++;
	}
	if (added === 0 && removed === 0) return undefined;
	return { added, removed };
}

export function summarizeToolResult(
	toolName: string,
	args: any,
	result: ToolResultLike | undefined,
	options: { isError?: boolean; isPartial?: boolean } = {},
): ToolActivityResultSummary {
	if (options.isPartial) {
		if (toolName === "bash") {
			const progress = formatBashProgress(result?.details);
			return { label: progress ? `running ${progress}` : "running…", status: "running" };
		}
		if (toolName === "agent") {
			const name = args?.name || args?.agent_name || "agent";
			return { label: `@${name} running…`, status: "running" };
		}
		return { label: "running…", status: "running" };
	}
	const output = getTextOutput(result).trim();
	const details = knownDetails(result);
	if (toolName === "bash" && details?.backgrounded && details.backgroundTaskId) {
		return { label: `running in background · ${details.backgroundTaskId}`, status: "running" };
	}
	if (options.isError) {
		return { label: compactText(output || "failed", 90), status: "error" };
	}

	switch (toolName) {
		case "bash": {
			const classification = classifyBashCommand(
				typeof args?.command === "string" ? args.command : undefined,
				typeof args?.description === "string" ? args.description : undefined,
			);
			if (classification.kind === "search") {
				if (details?.noMatches) return { label: "no matches", status: "neutral", count: 0 };
				const matches = details?.matchCount ?? outputDataLines(output).length;
				if (matches === 0) return { label: "no matches", status: "neutral", count: 0 };
				return {
					label: plural(matches, "match", "matches"),
					status: "success",
					count: matches,
				};
			}
			if (classification.kind === "list") {
				const counts = countListedEntriesFromOutput(output);
				return {
					label: formatListCount(counts.files, counts.directories, counts.total),
					status: counts.total > 0 ? "success" : "neutral",
					count: counts.total,
				};
			}
			if (classification.kind === "read") {
				const lines = details?.lineCount ?? countOutputDisplayLines(output);
				return {
					label: lines > 0 ? plural(lines, "line") : "no output",
					status: lines > 0 ? "success" : "neutral",
					count: lines,
				};
			}
			const exitCode = typeof details?.exitCode === "number" ? details.exitCode : undefined;
			const lineCount = details?.progress?.totalLines ?? countOutputDisplayLines(output);
			const elapsedMs = details?.progress?.elapsedMs;
			const elapsedPart = typeof elapsedMs === "number" ? ` · ${formatDuration(elapsedMs)}` : "";
			const linePart = lineCount > 0 ? ` · ${plural(lineCount, "line")}` : "";
			return {
				label:
					exitCode === undefined ? `done${elapsedPart}${linePart}` : `exit ${exitCode}${elapsedPart}${linePart}`,
				status: exitCode === 0 || exitCode === undefined ? "success" : "error",
			};
		}
		case "grep": {
			const matches = details?.matchCount ?? outputDataLines(output).length;
			if (matches === 0) return { label: "no matches", status: "neutral", count: 0 };
			const files = details?.matchedFileCount ?? countMatchedFilesFromOutput(output);
			const suffix = files && files > 0 ? ` in ${plural(files, "file")}` : "";
			return { label: `${plural(matches, "match", "matches")}${suffix}`, status: "success", count: matches };
		}
		case "find": {
			const files = details?.resultCount ?? outputDataLines(output).length;
			return {
				label: files > 0 ? plural(files, "file") : "no files",
				status: files > 0 ? "success" : "neutral",
				count: files,
			};
		}
		case "ls": {
			const counts = {
				total: details?.entryCount,
				files: details?.fileCount,
				directories: details?.directoryCount,
			};
			const fallback = countListedEntriesFromOutput(output);
			const total = counts.total ?? fallback.total;
			const files = counts.files ?? fallback.files;
			const directories = counts.directories ?? fallback.directories;
			return {
				label: formatListCount(files, directories, total),
				status: total > 0 ? "success" : "neutral",
				count: total,
			};
		}
		case "read": {
			const lines = details?.lineCount ?? countOutputDisplayLines(output);
			const file = typeof args?.path === "string" ? basename(args.path) : "file";
			if (lines === 0 && /image file/i.test(output)) return { label: `read image ${file}`, status: "success" };
			return {
				label: lines > 0 ? plural(lines, "line") : "read",
				status: "success",
				count: lines,
			};
		}
		case "write": {
			const lineCount = typeof args?.content === "string" ? countOutputDisplayLines(args.content) : undefined;
			return {
				label: lineCount !== undefined ? `wrote ${plural(lineCount, "line")}` : "written",
				status: "success",
				count: lineCount,
			};
		}
		case "edit": {
			const edits = details?.editCount ?? (Array.isArray(args?.edits) ? args.edits.length : 1);
			const diff = (result?.details as any)?.diff;
			const stats = parseDiffStats(typeof diff === "string" ? diff : undefined);
			const statsLabel = stats ? ` (+${stats.added} -${stats.removed})` : "";
			return {
				label: `${edits} ${edits === 1 ? "edit" : "edits"} applied${statsLabel}`,
				status: "success",
				count: edits,
			};
		}
		case "ExitPlanMode":
			return { label: "approved", status: "success" };
		default:
			return {
				label: output ? compactText(output, 90) : "done",
				status: "success",
			};
	}
}

export function formatToolActivityLine(toolName: string, args: any): string {
	const activity = summarizeToolCall(toolName, args);
	return `✦ ${activity.title}\n  ├─ ${activity.compact}`;
}

export function formatToolActivityResultLine(
	toolName: string,
	args: any,
	result: ToolResultLike | undefined,
	options: { isError?: boolean; isPartial?: boolean; duration?: string } = {},
): string {
	const summary = summarizeToolResult(toolName, args, result, options);
	const suffix = options.duration ? ` · ${options.duration}` : "";
	return `  └─ ${summary.label}${suffix}`;
}

function compactLoadingTarget(activity: ToolActivityClassification): string | undefined {
	const compact = activity.compact.trim();
	if (!compact || compact === "...") return undefined;
	switch (activity.kind) {
		case "write":
		case "edit":
			return compactText(compact.replace(/^(?:write|edit)\s+/i, ""), 32);
		case "read":
			return compactText(compact.replace(/^read\s+/i, ""), 32);
		case "list":
			return compactText(compact.replace(/^list\s+/i, ""), 32);
		case "search":
			return compactText(compact, 36);
		default:
			return undefined;
	}
}

function withLoadingTarget(label: string, activity: ToolActivityClassification): string {
	const target = compactLoadingTarget(activity);
	return target ? `${label}: ${target}` : label;
}

function neoToolLoadingLabel(activity: ToolActivityClassification): string {
	switch (activity.kind) {
		case "search":
			return withLoadingTarget("nggoleki file", activity);
		case "read":
			return withLoadingTarget("mbukak file", activity);
		case "list":
			return withLoadingTarget("nyawang folder", activity);
		case "write":
			return withLoadingTarget("nulis file", activity);
		case "edit":
			return withLoadingTarget("mbeneri file", activity);
		case "command": {
			if (activity.title === "Running tests") return "mriksa test";
			if (activity.title === "Installing packages") return "masang paket";
			return "mlakuake command";
		}
		default:
			return "ngolah tool";
	}
}

function neoGroupLoadingLabel(items: ToolActivityGroupItem[]): string {
	const title = toolGroupTitle(items);
	if (title === "Inspecting project") return "nyawang project";
	if (title === "Searching files") return "nggoleki file";
	if (title === "Reading files") return "mbukak file";
	if (title === "Listing files") return "nyawang folder";
	if (title === "Updating files") return "nganyari file";
	if (title === "Running tests") return "mriksa test";
	if (title === "Running command" || title === "Running commands") return "mlakuake command";
	return "ngulik";
}

export function formatToolInputLoadingMessage(_toolName: string, _args: any): string {
	return "nyiapke alat…";
}

export function formatToolLoadingMessage(toolName: string, args: any): string {
	const activity = summarizeToolCall(toolName, args);
	const description = typeof args?.description === "string" ? compactText(args.description, 44) : "";
	if (toolName === "bash" && description) {
		return `${description}…`;
	}
	return `${neoToolLoadingLabel(activity)}…`;
}

export interface ToolActivityGroupItem {
	id: string;
	toolName: string;
	args: any;
	result?: ToolResultLike;
	isError?: boolean;
	isPartial?: boolean;
	executionStarted?: boolean;
}

export function toolActivityGroupIntentForItem(toolName: string, args: any): ToolActivityGroupIntent {
	const activity = summarizeToolCall(toolName, args);
	if (activity.isSearchOrRead) return "inspect";
	if (activity.kind === "command") return "command";
	if (activity.kind === "edit" || activity.kind === "write") return "mutation";
	return "other";
}

export function toolActivityGroupIntent(items: ToolActivityGroupItem[]): ToolActivityGroupIntent | undefined {
	if (items.length === 0) return undefined;
	const intents = new Set(items.map((item) => toolActivityGroupIntentForItem(item.toolName, item.args)));
	if (intents.size === 1) return intents.values().next().value;
	if (intents.has("mutation")) return "mutation";
	if (intents.has("command")) return "command";
	if (intents.has("inspect")) return "inspect";
	return "other";
}

export function canMergeToolIntoActivityGroup(items: ToolActivityGroupItem[], toolName: string, args: any): boolean {
	if (items.length === 0) return true;
	const currentIntent = toolActivityGroupIntent(items);
	const nextIntent = toolActivityGroupIntentForItem(toolName, args);

	// Claude Code keeps mutating commands as their own approval/result rows.
	// Only independent read-only inspection calls are stacked into one activity tree.
	return currentIntent === "inspect" && nextIntent === "inspect";
}

function toolGroupTitle(items: ToolActivityGroupItem[]): string {
	if (items.length === 0) return "Working";
	const activities = items.map((item) => summarizeToolCall(item.toolName, item.args));
	const allSearchRead = activities.every((activity) => activity.isSearchOrRead);
	if (allSearchRead) {
		const kinds = new Set(activities.map((activity) => activity.kind));
		if (kinds.size === 1) {
			if (kinds.has("search")) return "Searching files";
			if (kinds.has("read")) return "Reading files";
			if (kinds.has("list")) return "Listing files";
		}
		return "Inspecting project";
	}
	if (activities.some((activity) => activity.kind === "write" || activity.kind === "edit")) return "Updating files";
	if (activities.some((activity) => activity.title === "Running tests")) return "Running tests";
	if (activities.every((activity) => activity.kind === "command"))
		return items.length === 1 ? "Running command" : "Running commands";
	return "Working";
}

function compactTargetForActivity(item: ToolActivityGroupItem): string {
	const activity = summarizeToolCall(item.toolName, item.args);
	const compact = activity.compact;
	switch (activity.kind) {
		case "list":
			return compactText(compact.replace(/^list\s+/i, ""), 28) || ".";
		case "read": {
			const rawPath = typeof item.args?.file_path === "string" ? item.args.file_path : item.args?.path;
			const label = typeof rawPath === "string" ? displayPath(rawPath, "file") : compact.replace(/^read\s+/i, "");
			return compactText(label.includes("/") ? basename(label) : label, 28) || "file";
		}
		case "search":
			return compactText(compact.replace(/^grep\s+/i, "").replace(/^find\s+/i, ""), 34) || "files";
		case "command":
			return compactText(compact, 44) || "command";
		case "edit":
			return compactText(compact.replace(/^edit\s+/i, ""), 32) || "file";
		case "write":
			return compactText(compact.replace(/^write\s+/i, ""), 32) || "file";
		default:
			return compactText(compact, 34) || item.toolName;
	}
}

function uniqueCompactTargets(items: ToolActivityGroupItem[], maxItems = 3): string {
	const uniqueLabels: string[] = [];
	const seen = new Set<string>();
	for (const item of items) {
		const label = compactTargetForActivity(item);
		if (seen.has(label)) continue;
		seen.add(label);
		uniqueLabels.push(label);
	}
	const labels = uniqueLabels.slice(0, maxItems);
	const remaining = uniqueLabels.length - labels.length;
	if (remaining > 0) labels.push(`+${remaining} more`);
	return labels.join(" · ");
}

function hasIncompleteItems(items: ToolActivityGroupItem[]): boolean {
	return items.some((item) => item.isPartial || !item.result);
}

function kindCountLabel(kind: ToolActivityKind, count: number): string {
	switch (kind) {
		case "search":
			return plural(count, "pattern");
		case "read":
			return plural(count, "file");
		case "list":
			return plural(count, "directory", "directories");
		case "command":
			return plural(count, "command");
		case "edit":
			return plural(count, "file");
		case "write":
			return plural(count, "file");
		default:
			return plural(count, "tool");
	}
}

function kindVerb(kind: ToolActivityKind, pending: boolean): string {
	switch (kind) {
		case "search":
			return pending ? "searching" : "searched";
		case "read":
			return pending ? "reading" : "read";
		case "list":
			return pending ? "listing" : "listed";
		case "command":
			return pending ? "running" : "ran";
		case "edit":
			return pending ? "editing" : "edited";
		case "write":
			return pending ? "writing" : "wrote";
		default:
			return pending ? "using" : "used";
	}
}

function formatKindCount(kind: ToolActivityKind, count: number, pending: boolean): string | undefined {
	if (count <= 0) return undefined;
	return `${kindVerb(kind, pending)} ${kindCountLabel(kind, count)}`;
}

function formatSingleItemHint(item: ToolActivityGroupItem): string {
	const activity = summarizeToolCall(item.toolName, item.args);
	const pending = !item.result || item.isPartial;
	const action = activity.compact;
	if (pending && !item.result) return `${action}…`;
	const result = summarizeToolResult(item.toolName, item.args, item.result, {
		isError: item.isError,
		isPartial: item.isPartial,
	});
	return `${action} · ${result.label}`;
}

function formatSameKindHint(
	items: ToolActivityGroupItem[],
	kind: ToolActivityKind,
	pending: boolean,
	minimumCounts: ToolActivityKindCounts = {},
): string {
	const count = Math.max(items.length, minimumCounts[kind] ?? 0);
	if (count <= 1 && items.length === 1) return formatSingleItemHint(items[0]!);
	const summary = formatKindCount(kind, count, pending) ?? `${kindVerb(kind, pending)} ${count}`;
	const targets = uniqueCompactTargets(items);
	return targets ? `${summary} · ${targets}${pending ? "…" : ""}` : `${summary}${pending ? "…" : ""}`;
}

function groupItemsByKind(items: ToolActivityGroupItem[]): Map<ToolActivityKind, ToolActivityGroupItem[]> {
	const grouped = new Map<ToolActivityKind, ToolActivityGroupItem[]>();
	for (const item of items) {
		const kind = summarizeToolCall(item.toolName, item.args).kind;
		const existing = grouped.get(kind);
		if (existing) {
			existing.push(item);
		} else {
			grouped.set(kind, [item]);
		}
	}
	return grouped;
}

function orderedKindGroups(items: ToolActivityGroupItem[]): Array<[ToolActivityKind, ToolActivityGroupItem[]]> {
	const grouped = groupItemsByKind(items);
	const order: ToolActivityKind[] = ["list", "search", "read", "command", "write", "edit", "other"];
	return order.flatMap((kind) => {
		const kindItems = grouped.get(kind);
		return kindItems ? ([[kind, kindItems]] as Array<[ToolActivityKind, ToolActivityGroupItem[]]>) : [];
	});
}

function formatKindTreeLabel(
	kind: ToolActivityKind,
	items: ToolActivityGroupItem[],
	options: ToolActivityGroupFormatOptions,
	showTargets: boolean,
): string {
	const pending = hasIncompleteItems(items);
	if (!showTargets) {
		const count = Math.max(items.length, options.minimumCounts?.[kind] ?? 0);
		return formatKindCount(kind, count, pending) ?? `${kindVerb(kind, pending)} ${count}`;
	}
	return formatSameKindHint(items, kind, pending, options.minimumCounts);
}

function targetPathForAction(item: ToolActivityGroupItem, fallback = "."): string {
	const rawPath = item.args?.file_path ?? item.args?.path;
	if (typeof rawPath === "string" && rawPath.trim())
		return compactText(displayPath(rawPath, fallback), 56) || fallback;
	return compactTargetForActivity(item);
}

function sentenceCase(value: string): string {
	return value ? `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}` : value;
}

function singleToolActionLabel(item: ToolActivityGroupItem): string {
	const activity = summarizeToolCall(item.toolName, item.args);
	switch (activity.kind) {
		case "list":
			return `List directory ${targetPathForAction(item)}`;
		case "read":
			return `Read ${targetPathForAction(item, "file")}`;
		case "search":
			return sentenceCase(activity.compact.replace(/^grep\s+/i, "search ").replace(/^find\s+/i, "find "));
		case "command":
			return `${activity.compact} (shell)`;
		case "write":
			return `Write ${targetPathForAction(item, "file")}`;
		case "edit":
			return `Edit ${targetPathForAction(item, "file")}`;
		default:
			return sentenceCase(activity.compact || activity.title);
	}
}

function formatCompletedSingleToolResult(item: ToolActivityGroupItem): string {
	const activity = summarizeToolCall(item.toolName, item.args);
	if (item.isError) {
		const result = summarizeToolResult(item.toolName, item.args, item.result, { isError: true });
		return result.label;
	}
	const output = getTextOutput(item.result).trim();
	const details = knownDetails(item.result);
	switch (activity.kind) {
		case "list": {
			const fallback = countListedEntriesFromOutput(output);
			const total = details?.entryCount ?? fallback.total;
			const files = details?.fileCount ?? fallback.files;
			const directories = details?.directoryCount ?? fallback.directories;
			return formatListCount(files, directories, total);
		}
		case "search": {
			const summary = summarizeToolResult(item.toolName, item.args, item.result, { isError: item.isError });
			return activity.verb === "found" && summary.count !== undefined
				? `${plural(summary.count, "file")} found`
				: `${summary.label} found`;
		}
		case "read": {
			const lines = details?.lineCount ?? countOutputDisplayLines(output);
			if (lines === 0 && /image file/i.test(output))
				return summarizeToolResult(item.toolName, item.args, item.result).label;
			return `${plural(lines, "line")} read`;
		}
		case "command": {
			if (details?.backgrounded && details.backgroundTaskId) {
				return `running in background · ${details.backgroundTaskId}`;
			}
			const progress = formatBashProgress(details);
			if (progress && item.isPartial) return `running ${progress}`;
			const exitCode = typeof details?.exitCode === "number" ? details.exitCode : undefined;
			const elapsedMs = details?.progress?.elapsedMs;
			const lines = details?.progress?.totalLines ?? countOutputDisplayLines(output);
			const bytes = details?.progress?.totalBytes;
			const parts = [exitCode === undefined ? "done" : `exit ${exitCode}`];
			if (typeof elapsedMs === "number") parts.push(formatDuration(elapsedMs));
			if (lines > 0) parts.push(plural(lines, "line"));
			if (bytes && bytes > 0) parts.push(formatSize(bytes));
			return parts.join(" · ");
		}
		case "write":
			return summarizeToolResult(item.toolName, item.args, item.result, { isError: item.isError }).label;
		case "edit": {
			const edits = summarizeToolResult(item.toolName, item.args, item.result, { isError: item.isError });
			return edits.label;
		}
		default:
			return summarizeToolResult(item.toolName, item.args, item.result, { isError: item.isError }).label;
	}
}

function formatPendingSingleToolResult(item: ToolActivityGroupItem): string {
	if (item.result) {
		const result = summarizeToolResult(item.toolName, item.args, item.result, {
			isError: item.isError,
			isPartial: true,
		});
		return result.label;
	}
	const activity = summarizeToolCall(item.toolName, item.args);
	switch (activity.kind) {
		case "list":
			return "listing…";
		case "read":
			return "reading…";
		case "search":
			return "searching…";
		case "command":
			return "waiting for approval or running…";
		case "write":
			return "waiting for approval…";
		case "edit":
			return "waiting for approval…";
		default:
			return "working…";
	}
}

function singleToolDetailLine(item: ToolActivityGroupItem): string | undefined {
	const activity = summarizeToolCall(item.toolName, item.args);
	if (activity.kind !== "command") return undefined;
	const command = typeof item.args?.command === "string" ? compactText(item.args.command, 96) : undefined;
	return command ? `  │ ${command}` : undefined;
}

function shouldShowTargetDetails(
	kind: ToolActivityKind,
	items: ToolActivityGroupItem[],
	usePhaseLayout: boolean,
): boolean {
	if (!usePhaseLayout || items.length === 0) return false;
	// Only show file targets after all items in this kind are complete
	if (items.some((item) => item.isPartial || !item.result)) return false;
	return kind === "read" || kind === "write" || kind === "edit";
}

function targetDetailSuffix(item: ToolActivityGroupItem): string | undefined {
	if (item.isPartial || !item.result || item.isError) return undefined;
	const activity = summarizeToolCall(item.toolName, item.args);
	const details = knownDetails(item.result);
	const output = getTextOutput(item.result).trim();
	switch (activity.kind) {
		case "read": {
			const lines = details?.lineCount ?? countOutputDisplayLines(output);
			return lines > 0 ? `(${plural(lines, "line")})` : undefined;
		}
		case "edit": {
			const diff = (item.result?.details as any)?.diff;
			const stats = parseDiffStats(typeof diff === "string" ? diff : undefined);
			return stats ? `(+${stats.added} -${stats.removed})` : undefined;
		}
		case "write": {
			const lineCount =
				typeof item.args?.content === "string" ? countOutputDisplayLines(item.args.content) : undefined;
			return lineCount !== undefined && lineCount > 0 ? `(${plural(lineCount, "line")})` : undefined;
		}
		default:
			return undefined;
	}
}

function targetDetailLabels(items: ToolActivityGroupItem[], maxItems = 3): string[] {
	const labels: string[] = [];
	const seen = new Set<string>();
	for (const item of items) {
		const label = compactTargetForActivity(item);
		if (!label || seen.has(label)) continue;
		seen.add(label);
		const suffix = targetDetailSuffix(item);
		labels.push(suffix ? `${label} ${suffix}` : label);
	}
	const visible = labels.slice(0, maxItems);
	const remaining = labels.length - visible.length;
	if (remaining > 0) visible.push(`+${remaining} more files`);
	return visible;
}

function getUniqueLabelsCount(items: ToolActivityGroupItem[]): number {
	const seen = new Set<string>();
	for (const item of items) {
		const label = compactTargetForActivity(item);
		if (label) seen.add(label);
	}
	return seen.size;
}

function completedToolGroupTitle(items: ToolActivityGroupItem[]): string {
	const base = toolGroupTitle(items);
	switch (base) {
		case "Inspecting project":
			return "Inspected project";
		case "Searching files":
			return "Searched files";
		case "Reading files":
			return "Read files";
		case "Listing files":
			return "Listed files";
		case "Updating files":
			return "Updated files";
		case "Running tests":
			return "Ran tests";
		case "Running command":
			return "Ran command";
		case "Running commands":
			return "Ran commands";
		default:
			return base;
	}
}

// ============================================================================
// Tree UI v2: structured rows
//
// The renderer used to emit a single string and the UI component re-derived
// row state by parsing prefix characters. That made coloring fragile every
// time the formatter changed (a new connector or glyph would silently fall
// through to the muted branch). Structured rows expose a typed shape so the
// component can color/animate decisively without string sniffing.
// ============================================================================

/**
 * Default icon set keyed by tool-activity kind. Single-cell unicode glyphs
 * chosen for visual scan-ability without breaking column alignment in narrow
 * terminals. Opt-in: callers must pass these explicitly (or a subset) via
 * `ToolActivityGroupFormatOptions.icons` to enable them — the default tree
 * still renders without icons to keep stable layout for legacy consumers.
 */
export const DEFAULT_TOOL_ACTIVITY_ICONS: Required<NonNullable<ToolActivityGroupFormatOptions["icons"]>> = {
	search: "?",
	read: "≣",
	list: "▤",
	command: "❯",
	write: "↗",
	edit: "↻",
	agent: "@",
	other: "·",
};

/**
 * Visual classification of a row in the tool-activity tree. Each kind maps to
 * a deterministic theming/animation rule in the UI component.
 */
export type ToolActivityRowKind =
	| "header" // glyph + title (group only)
	| "branch" // tree row with kind summary, e.g. "├─ read 4 files"
	| "detail" // child row under a branch (file target)
	| "single-action" // first row of a single-tool render, e.g. "● Read foo.ts"
	| "single-detail" // command row for single-tool bash, e.g. "  │ npm test"
	| "single-result" // result row for single-tool, e.g. "  └ 412 lines"
	| "current" // ⠋ active target hint inside a tree
	| "hint"; // bottom hint row, e.g. "view live tool output"

export type ToolActivityRowState = "running" | "done" | "error" | "neutral";

export interface ToolActivityRow {
	kind: ToolActivityRowKind;
	state: ToolActivityRowState;
	/** Final, indented text for the row. Already includes any tree connectors. */
	text: string;
}

export interface ToolActivityGroupHeader {
	/**
	 * Three-state glyph: `◐` running/mixed, `●` done, `✗` error.
	 * Used by the UI to decide between shimmer (running) and solid coloring (done).
	 */
	glyph: "◐" | "●" | "✗";
	state: ToolActivityRowState;
	title: string;
	/** Composed header line, e.g. "◐ Exploring". */
	text: string;
}

export interface ToolActivityGroupRender {
	/** Null when rendering a single-tool variant (the action row carries the title instead). */
	header: ToolActivityGroupHeader | null;
	rows: ToolActivityRow[];
	hasRunningItems: boolean;
	hasError: boolean;
	isSingleTool: boolean;
	intent: ToolActivityGroupIntent | undefined;
	/** Stable signature for caching across shimmer ticks (snapshot identity + layout). */
	signature: string;
}

function deriveGroupState(
	hasRunning: boolean,
	hasError: boolean,
	allErrored: boolean,
): { glyph: "◐" | "●" | "✗"; state: ToolActivityRowState } {
	if (hasRunning) return { glyph: "◐", state: "running" };
	if (allErrored) return { glyph: "✗", state: "error" };
	if (hasError) return { glyph: "●", state: "done" };
	return { glyph: "●", state: "done" };
}

function classifyBranchState(kindItems: ToolActivityGroupItem[]): ToolActivityRowState {
	if (kindItems.some((item) => item.isPartial || !item.result)) return "running";
	if (kindItems.every((item) => item.isError)) return "error";
	if (kindItems.some((item) => item.isError)) return "done";
	return "done";
}

function singleToolRowState(item: ToolActivityGroupItem): ToolActivityRowState {
	if (item.isError) return "error";
	if (item.isPartial || !item.result) return "running";
	return "done";
}

function buildSignature(items: ToolActivityGroupItem[], options: ToolActivityGroupFormatOptions): string {
	const parts = items.map((item) => {
		const state = singleToolRowState(item);
		const argHash = item.toolName === "bash" ? (typeof item.args?.command === "string" ? item.args.command : "") : "";
		return `${item.id}|${item.toolName}|${state}|${argHash.length}`;
	});
	const counts = options.minimumCounts
		? Object.entries(options.minimumCounts)
				.map(([k, v]) => `${k}=${v ?? 0}`)
				.sort()
				.join(",")
		: "";
	return `${parts.join(";")}#${counts}#${options.layout ?? "full"}#${options.inlineSingleTool ? "1" : "0"}`;
}

function appendStructuredPhaseRows(
	rows: ToolActivityRow[],
	kind: ToolActivityKind,
	kindItems: ToolActivityGroupItem[],
	options: ToolActivityGroupFormatOptions,
	showTargets: boolean,
	connector: "├─" | "└─",
	branchState: ToolActivityRowState,
): void {
	const tightLayout = options.layout === "tight";
	const compactLayout = options.layout === "compact" || tightLayout;
	const includeTargets = !compactLayout && shouldShowTargetDetails(kind, kindItems, true);
	const targets = includeTargets ? targetDetailLabels(kindItems) : [];
	const uniqueCount = getUniqueLabelsCount(kindItems);
	const count = targets.length > 0 ? uniqueCount : kindItems.length;
	const summary =
		targets.length > 0
			? (formatKindCount(kind, Math.max(count, options.minimumCounts?.[kind] ?? 0), hasIncompleteItems(kindItems)) ??
				`${kindVerb(kind, hasIncompleteItems(kindItems))} ${count}`)
			: formatKindTreeLabel(kind, kindItems, options, showTargets && !compactLayout);
	const icon = options.icons?.[kind];
	const decoratedSummary = icon ? `${icon} ${summary}` : summary;
	rows.push({ kind: "branch", state: branchState, text: `  ${connector} ${decoratedSummary}` });
	if (targets.length > 0) {
		const childPrefix = connector === "└─" ? "     " : "  │  ";
		for (let index = 0; index < targets.length; index++) {
			const childConnector = index === targets.length - 1 ? "└─" : "├─";
			rows.push({
				kind: "detail",
				state: branchState,
				text: `${childPrefix}${childConnector} ${targets[index]}`,
			});
		}
	}
}

function buildStructuredTree(
	items: ToolActivityGroupItem[],
	options: ToolActivityGroupFormatOptions,
	forcePhaseLayout: boolean,
): ToolActivityRow[] {
	const groups = orderedKindGroups(items);
	if (groups.length === 0) return [];
	const showTargets = groups.length === 1;
	const hasIncomplete = hasIncompleteItems(items);
	const usePhaseLayout = forcePhaseLayout || hasIncomplete || groups.length > 1;
	const rows: ToolActivityRow[] = [];
	for (let index = 0; index < groups.length; index++) {
		const [kind, kindItems] = groups[index]!;
		const connector = index < groups.length - 1 ? "├─" : "└─";
		const branchState = classifyBranchState(kindItems);
		if (usePhaseLayout) {
			appendStructuredPhaseRows(rows, kind, kindItems, options, showTargets, connector, branchState);
		} else {
			const summary = formatKindTreeLabel(kind, kindItems, options, showTargets && options.layout !== "compact");
			const icon = options.icons?.[kind];
			rows.push({
				kind: "branch",
				state: branchState,
				text: `  ${connector} ${icon ? `${icon} ` : ""}${summary}`,
			});
			if (options.layout !== "compact" && options.layout !== "tight") {
				const targets = shouldShowTargetDetails(kind, kindItems, false) ? targetDetailLabels(kindItems) : [];
				for (let i = 0; i < targets.length; i++) {
					const childConnector = i === targets.length - 1 ? "└─" : "├─";
					rows.push({ kind: "detail", state: branchState, text: `  │  ${childConnector} ${targets[i]}` });
				}
			}
		}
	}
	return rows;
}

function buildSingleToolStructuredRows(
	item: ToolActivityGroupItem,
	options: ToolActivityGroupFormatOptions,
): ToolActivityRow[] {
	const activity = summarizeToolCall(item.toolName, item.args);
	const state = singleToolRowState(item);
	const pending = state === "running";

	if (activity.kind === "agent") {
		const details = item.result?.details as { toolCalls?: number; subagentType?: string } | undefined;
		const toolCalls = details?.toolCalls ?? 0;
		const statsText = toolCalls > 0 ? ` · ${toolCalls} tool ${toolCalls === 1 ? "use" : "uses"}` : "";
		if (pending) {
			const desc = details
				? `${details.subagentType || "agent"} using ${item.result?.content?.[0]?.text || "tools"}`
				: "working…";
			return [{ kind: "single-result", state, text: `  └─ ${activity.compact} · ${desc}${statsText}` }];
		}
		const resultSummary = formatCompletedSingleToolResult(item);
		return [{ kind: "single-result", state, text: `  └─ ${activity.compact} · ${resultSummary}${statsText}` }];
	}

	const glyph = state === "running" ? "◐" : state === "error" ? "✗" : "●";
	const action = singleToolActionLabel(item);
	const result = pending ? formatPendingSingleToolResult(item) : formatCompletedSingleToolResult(item);
	const commandRow = singleToolDetailLine(item);
	const tightLayout = options.layout === "tight";
	const inlineSingle = options.inlineSingleTool ?? false;
	const inlineEligible =
		inlineSingle && !commandRow && state === "done" && result.length > 0 && result.length + action.length <= 72;
	if (inlineEligible || tightLayout) {
		return [{ kind: "single-action", state, text: `${glyph} ${action} · ${result}` }];
	}

	const rows: ToolActivityRow[] = [{ kind: "single-action", state, text: `${glyph} ${action}` }];
	if (commandRow) rows.push({ kind: "single-detail", state, text: commandRow });
	rows.push({ kind: "single-result", state, text: `  └ ${result}` });
	return rows;
}

function tightGroupSummary(items: ToolActivityGroupItem[]): string {
	const grouped = orderedKindGroups(items);
	const parts: string[] = [];
	for (const [kind, kindItems] of grouped) {
		const verb = kindVerb(kind, hasIncompleteItems(kindItems));
		parts.push(`${verb} ${kindItems.length}`);
	}
	return parts.join(" · ");
}

export function buildToolActivityGroupRender(
	items: ToolActivityGroupItem[],
	options: ToolActivityGroupFormatOptions = {},
): ToolActivityGroupRender {
	const visibleItems = items.length > 0 ? items : [];
	const intent = toolActivityGroupIntent(visibleItems);
	if (visibleItems.length === 0) {
		const header: ToolActivityGroupHeader = {
			glyph: "◐",
			state: "running",
			title: "Working",
			text: "◐ Working",
		};
		return {
			header,
			rows: [],
			hasRunningItems: true,
			hasError: false,
			isSingleTool: false,
			intent,
			signature: buildSignature(visibleItems, options),
		};
	}

	if (visibleItems.length === 1) {
		const rows = buildSingleToolStructuredRows(visibleItems[0]!, options);
		const item = visibleItems[0]!;
		const state = singleToolRowState(item);
		return {
			header: null,
			rows,
			hasRunningItems: state === "running",
			hasError: state === "error",
			isSingleTool: true,
			intent,
			signature: buildSignature(visibleItems, options),
		};
	}

	const completed = !hasIncompleteItems(visibleItems);
	const hasError = visibleItems.some((item) => item.isError === true);
	const allErrored = visibleItems.every((item) => item.isError === true);
	const { glyph, state } = deriveGroupState(!completed, hasError, allErrored);

	const title =
		intent === "inspect"
			? completed
				? "Explored"
				: "Exploring"
			: completed
				? completedToolGroupTitle(visibleItems)
				: toolGroupTitle(visibleItems);
	const header: ToolActivityGroupHeader = {
		glyph,
		state,
		title,
		text: `${glyph} ${title}`,
	};

	if (options.layout === "tight") {
		return {
			header,
			rows: [
				{
					kind: "branch",
					state,
					text: `  └─ ${tightGroupSummary(visibleItems)}`,
				},
			],
			hasRunningItems: !completed,
			hasError,
			isSingleTool: false,
			intent,
			signature: buildSignature(visibleItems, options),
		};
	}

	const rows = buildStructuredTree(visibleItems, options, completed);
	return {
		header,
		rows,
		hasRunningItems: !completed,
		hasError,
		isSingleTool: false,
		intent,
		signature: buildSignature(visibleItems, options),
	};
}

export function formatToolActivityGroup(
	items: ToolActivityGroupItem[],
	options: ToolActivityGroupFormatOptions = {},
): string {
	const rendered = buildToolActivityGroupRender(items, options);
	const lines: string[] = [];
	if (rendered.header) lines.push(rendered.header.text);
	for (const row of rendered.rows) lines.push(row.text);
	return lines.join("\n");
}

export function formatToolActivityGroupLoading(items: ToolActivityGroupItem[]): string {
	return `${neoGroupLoadingLabel(items)}…`;
}
