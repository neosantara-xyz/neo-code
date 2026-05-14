import { basename } from "node:path";

export type ToolActivityKind = "search" | "read" | "list" | "write" | "edit" | "command" | "other";

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

type TextBlock = {
	type: string;
	text?: string;
	data?: string;
	mimeType?: string;
};

type ToolResultLike = {
	content?: TextBlock[];
	details?: any;
};

const SEARCH_COMMAND_RE = /(?:^|[\s|;&({])(?:grep|egrep|fgrep|rg|ag|ack)\b/;
const FIND_COMMAND_RE = /(?:^|[\s|;&({])(?:find|fd|git\s+ls-files)\b/;
const LIST_COMMAND_RE = /(?:^|[\s|;&({])(?:ls|tree)\b/;
const READ_COMMAND_RE = /(?:^|[\s|;&({])(?:cat|head|tail|sed)\b/;
const INSTALL_COMMAND_RE = /(?:^|[\s|;&({])(?:npm|pnpm|yarn|bun)\s+(?:i|install|add|remove|uninstall)\b/;
const TEST_COMMAND_RE =
	/(?:^|[\s|;&({])(?:npm|pnpm|yarn|bun)\s+(?:test|run\s+test)|(?:^|[\s|;&({])(?:vitest|jest|mocha|node\s+--test|pytest)\b/;

function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

export function compactText(value: string | undefined, maxLength = 72): string {
	const normalized = normalizeWhitespace(value ?? "");
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
	const normalized = value || fallback;
	return compactText(normalized.replace(/\\/g, "/"), 48) || fallback;
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

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
	return `${count} ${count === 1 ? singular : pluralForm}`;
}

function summarizeLines(output: string, noun: string, emptyLabel: string): ToolActivityResultSummary {
	const lines = outputDataLines(output);
	if (lines.length === 0) {
		return { label: emptyLabel, status: "neutral", count: 0 };
	}
	return {
		label: plural(lines.length, noun),
		status: "success",
		count: lines.length,
	};
}

export function classifyBashCommand(command: string | undefined): ToolActivityClassification {
	const compact = compactText(command, 86) || "...";
	const normalized = normalizeWhitespace(command ?? "");
	if (SEARCH_COMMAND_RE.test(normalized)) {
		return {
			kind: "search",
			verb: "searched",
			title: "Searching files",
			compact: compactSearchCommand(normalized) || compact,
			isSearchOrRead: true,
		};
	}
	if (FIND_COMMAND_RE.test(normalized)) {
		return {
			kind: "search",
			verb: "found",
			title: "Finding files",
			compact: compactFindCommand(normalized) || compact,
			isSearchOrRead: true,
		};
	}
	if (LIST_COMMAND_RE.test(normalized)) {
		return {
			kind: "list",
			verb: "listed",
			title: "Listing files",
			compact: compactListCommand(normalized) || compact,
			isSearchOrRead: true,
		};
	}
	if (READ_COMMAND_RE.test(normalized)) {
		return {
			kind: "read",
			verb: "read",
			title: "Reading files",
			compact: compactReadCommand(normalized) || compact,
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
			return classifyBashCommand(typeof args?.command === "string" ? args.command : undefined);
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

export function summarizeToolResult(
	toolName: string,
	args: any,
	result: ToolResultLike | undefined,
	options: { isError?: boolean; isPartial?: boolean } = {},
): ToolActivityResultSummary {
	if (options.isPartial) return { label: "running…", status: "running" };
	const output = getTextOutput(result).trim();
	if (options.isError) {
		return { label: compactText(output || "failed", 90), status: "error" };
	}

	switch (toolName) {
		case "bash": {
			const classification = classifyBashCommand(typeof args?.command === "string" ? args.command : undefined);
			if (classification.kind === "search") return summarizeLines(output, "match", "no matches");
			if (classification.kind === "list") return summarizeLines(output, "entry", "no entries");
			if (classification.kind === "read") return summarizeLines(output, "line", "no output");
			const exitCode = typeof result?.details?.exitCode === "number" ? `exit ${result.details.exitCode}` : "done";
			return { label: exitCode, status: "success" };
		}
		case "grep":
			return summarizeLines(output, "match", "no matches");
		case "find":
			return summarizeLines(output, "file", "no files");
		case "ls":
			return summarizeLines(output, "entry", "empty directory");
		case "read": {
			const lines = outputDataLines(output).length;
			const file = typeof args?.path === "string" ? basename(args.path) : "file";
			if (lines === 0 && /image file/i.test(output)) return { label: `read image ${file}`, status: "success" };
			return {
				label: lines > 0 ? plural(lines, "line") : "read",
				status: "success",
				count: lines,
			};
		}
		case "write":
			return { label: "written", status: "success" };
		case "edit": {
			const edits = Array.isArray(args?.edits) ? args.edits.length : 1;
			return {
				label: `${edits} ${edits === 1 ? "edit" : "edits"} applied`,
				status: "success",
				count: edits,
			};
		}
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

function neoToolLoadingLabel(activity: ToolActivityClassification): string {
	switch (activity.kind) {
		case "search":
			return "nggoleki file";
		case "read":
			return "mbukak file";
		case "list":
			return "nyawang folder";
		case "write":
			return "nulis file";
		case "edit":
			return "mbeneri file";
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
	if (title === "Updating files") return "nganyari file";
	if (title === "Running tests") return "mriksa test";
	if (title === "Running commands") return "mlakuake command";
	return "ngulik";
}

export function formatToolInputLoadingMessage(_toolName: string, _args: any): string {
	return "nyiapke alat…";
}

export function formatToolLoadingMessage(toolName: string, args: any): string {
	const activity = summarizeToolCall(toolName, args);
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

function toolGroupTitle(items: ToolActivityGroupItem[]): string {
	if (items.length === 0) return "Working";
	const activities = items.map((item) => summarizeToolCall(item.toolName, item.args));
	const allSearchRead = activities.every((activity) => activity.isSearchOrRead);
	if (allSearchRead) return "Inspecting project";
	if (activities.some((activity) => activity.kind === "write" || activity.kind === "edit")) return "Updating files";
	if (activities.some((activity) => activity.title === "Running tests")) return "Running tests";
	if (activities.every((activity) => activity.kind === "command")) return "Running commands";
	return "Working";
}

function hasIncompleteItems(items: ToolActivityGroupItem[]): boolean {
	return items.some((item) => item.isPartial || !item.result);
}

function formatGroupItemLine(item: ToolActivityGroupItem, isLast: boolean): string {
	const activity = summarizeToolCall(item.toolName, item.args);
	const branch = isLast ? "└─" : "├─";
	if (!item.result || item.isPartial) {
		const stage = item.executionStarted ? neoToolLoadingLabel(activity) : "nyiapke";
		return `  ${branch} ${stage}: ${activity.compact}`;
	}
	const result = summarizeToolResult(item.toolName, item.args, item.result, {
		isError: item.isError,
		isPartial: item.isPartial,
	});
	return `  ${branch} ${activity.compact} → ${result.label}`;
}

export function formatToolActivityGroup(items: ToolActivityGroupItem[]): string {
	const visibleItems = items.length > 0 ? items : [];
	const title = toolGroupTitle(visibleItems);
	const pending = hasIncompleteItems(visibleItems);
	const header = `✦ ${title}${pending ? ` · ${neoGroupLoadingLabel(visibleItems)}…` : ""}`;
	if (visibleItems.length === 0) return header;
	return [
		header,
		...visibleItems.map((item, index) => formatGroupItemLine(item, index === visibleItems.length - 1)),
	].join("\n");
}

export function formatToolActivityGroupLoading(items: ToolActivityGroupItem[]): string {
	return `✦ ${neoGroupLoadingLabel(items)}…`;
}
