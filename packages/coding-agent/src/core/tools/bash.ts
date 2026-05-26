import { existsSync } from "node:fs";
import type { AgentTool } from "@neosantara-xyz/agent-core";
import { Container, Text, truncateToWidth } from "@neosantara-xyz/tui";
import { spawn } from "child_process";
import { type Static, Type } from "typebox";
import { keyHint } from "../../modes/interactive/components/keybinding-hints.js";
import { truncateToVisualLines } from "../../modes/interactive/components/visual-truncate.js";
import { theme } from "../../modes/interactive/theme/theme.js";
import { waitForChildProcess } from "../../utils/child-process.js";
import {
	getShellConfig,
	getShellEnv,
	killProcessTree,
	trackDetachedChildPid,
	untrackDetachedChildPid,
} from "../../utils/shell.js";
import type { BackgroundTaskManager } from "../background-tasks.js";
import type { ToolDefinition, ToolRenderResultOptions } from "../extensions/types.js";
import { OutputAccumulator } from "./output-accumulator.js";
import { getTextOutput, invalidArgText, str } from "./render-utils.js";
import {
	formatToolActivityLine,
	formatToolActivityResultLine,
	isBenignBashExit,
	isNoMatchBashExit,
	summarizeToolCall,
	summarizeToolResult,
} from "./tool-activity.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, type TruncationResult } from "./truncate.js";

const bashSchema = Type.Object({
	command: Type.String({ description: "Bash command to execute" }),
	description: Type.Optional(
		Type.String({
			description:
				'Clear, concise description of what this command does in active voice. Keep simple commands brief (5-10 words), for example "Run tests" or "List source files". For harder-to-read commands, add enough context to clarify the intent.',
		}),
	),
	timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (optional, no default timeout)" })),
});

export type BashToolInput = Static<typeof bashSchema>;

export interface BashProgressDetails {
	startedAt: number;
	elapsedMs: number;
	totalLines: number;
	totalBytes: number;
	timeout?: number;
}

export interface BashToolDetails {
	truncation?: TruncationResult;
	fullOutputPath?: string;
	exitCode?: number | null;
	noMatches?: boolean;
	progress?: BashProgressDetails;
	backgroundTaskId?: string;
	backgroundOutputPath?: string;
	backgrounded?: boolean;
}

/**
 * Pluggable operations for the bash tool.
 * Override these to delegate command execution to remote systems (for example SSH).
 */
export interface BashOperations {
	/**
	 * Execute a command and stream output.
	 * @param command The command to execute
	 * @param cwd Working directory
	 * @param options Execution options
	 * @returns Promise resolving to exit code (null if killed)
	 */
	exec: (
		command: string,
		cwd: string,
		options: {
			onData: (data: Buffer) => void;
			signal?: AbortSignal;
			timeout?: number;
			env?: NodeJS.ProcessEnv;
		},
	) => Promise<{ exitCode: number | null }>;
}

/**
 * Create bash operations using Neo Code's built-in local shell execution backend.
 *
 * This is useful for extensions that intercept user_bash and still want Neo Code's
 * standard local shell behavior while wrapping or rewriting commands.
 */
export function createLocalBashOperations(options?: { shellPath?: string }): BashOperations {
	return {
		exec: (command, cwd, { onData, signal, timeout, env }) => {
			return new Promise((resolve, reject) => {
				const { shell, args } = getShellConfig(options?.shellPath);
				if (!existsSync(cwd)) {
					reject(new Error(`Working directory does not exist: ${cwd}\nCannot execute bash commands.`));
					return;
				}
				const child = spawn(shell, [...args, command], {
					cwd,
					detached: process.platform !== "win32",
					env: env ?? getShellEnv(),
					stdio: ["ignore", "pipe", "pipe"],
				});
				if (child.pid) trackDetachedChildPid(child.pid);
				let timedOut = false;
				let timeoutHandle: NodeJS.Timeout | undefined;
				// Set timeout if provided.
				if (timeout !== undefined && timeout > 0) {
					timeoutHandle = setTimeout(() => {
						timedOut = true;
						if (child.pid) killProcessTree(child.pid);
					}, timeout * 1000);
				}
				// Stream stdout and stderr.
				child.stdout?.on("data", onData);
				child.stderr?.on("data", onData);
				// Handle abort signal by killing the entire process tree.
				const onAbort = () => {
					if (child.pid) killProcessTree(child.pid);
				};
				if (signal) {
					if (signal.aborted) onAbort();
					else signal.addEventListener("abort", onAbort, { once: true });
				}
				// Handle shell spawn errors and wait for the process to terminate without hanging
				// on inherited stdio handles held by detached descendants.
				waitForChildProcess(child)
					.then((code) => {
						if (child.pid) untrackDetachedChildPid(child.pid);
						if (timeoutHandle) clearTimeout(timeoutHandle);
						if (signal) signal.removeEventListener("abort", onAbort);
						if (signal?.aborted) {
							reject(new Error("aborted"));
							return;
						}
						if (timedOut) {
							reject(new Error(`timeout:${timeout}`));
							return;
						}
						resolve({ exitCode: code });
					})
					.catch((err) => {
						if (child.pid) untrackDetachedChildPid(child.pid);
						if (timeoutHandle) clearTimeout(timeoutHandle);
						if (signal) signal.removeEventListener("abort", onAbort);
						reject(err);
					});
			});
		},
	};
}

export interface BashSpawnContext {
	command: string;
	cwd: string;
	env: NodeJS.ProcessEnv;
}

export type BashSpawnHook = (context: BashSpawnContext) => BashSpawnContext;

function resolveSpawnContext(command: string, cwd: string, spawnHook?: BashSpawnHook): BashSpawnContext {
	const baseContext: BashSpawnContext = { command, cwd, env: { ...getShellEnv() } };
	return spawnHook ? spawnHook(baseContext) : baseContext;
}

export interface BashToolOptions {
	/** Custom operations for command execution. Default: local shell */
	operations?: BashOperations;
	/** Manages Ctrl+B backgrounding for local bash tasks. Disabled for custom operations. */
	backgroundTaskManager?: BackgroundTaskManager;
	/** Command prefix prepended to every command (for example shell setup commands) */
	commandPrefix?: string;
	/** Optional explicit shell path from settings */
	shellPath?: string;
	/** Hook to adjust command, cwd, or env before execution */
	spawnHook?: BashSpawnHook;
}

const BASH_PREVIEW_LINES = 5;
const BASH_UPDATE_THROTTLE_MS = 100;

type BashRenderState = {
	startedAt: number | undefined;
	endedAt: number | undefined;
	interval: NodeJS.Timeout | undefined;
};

type BashResultRenderState = {
	cachedWidth: number | undefined;
	cachedLines: string[] | undefined;
	cachedSkipped: number | undefined;
};

class BashResultRenderComponent extends Container {
	state: BashResultRenderState = {
		cachedWidth: undefined,
		cachedLines: undefined,
		cachedSkipped: undefined,
	};
}

function formatDuration(ms: number): string {
	return `${(ms / 1000).toFixed(1)}s`;
}

function createBashProgressDetails(
	output: OutputAccumulator,
	startedAt: number,
	timeout: number | undefined,
): BashProgressDetails {
	const metrics = output.getMetrics();
	return {
		startedAt,
		elapsedMs: Date.now() - startedAt,
		totalLines: metrics.totalLines,
		totalBytes: metrics.totalBytes,
		timeout,
	};
}

type LocalBashExecutionResult =
	| { kind: "completed"; exitCode: number | null }
	| { kind: "backgrounded"; taskId: string; outputPath: string };

interface LocalBashExecutionOptions {
	command: string;
	cwd: string;
	env: NodeJS.ProcessEnv;
	shellPath?: string;
	onData: (data: Buffer) => void;
	signal?: AbortSignal;
	timeout?: number;
	backgroundTaskManager?: BackgroundTaskManager;
	toolCallId: string;
	description?: string;
}

function executeLocalBashWithOptionalBackground(options: LocalBashExecutionOptions): Promise<LocalBashExecutionResult> {
	return new Promise((resolve, reject) => {
		const { shell, args } = getShellConfig(options.shellPath);
		if (!existsSync(options.cwd)) {
			reject(new Error(`Working directory does not exist: ${options.cwd}\nCannot execute bash commands.`));
			return;
		}

		const child = spawn(shell, [...args, options.command], {
			cwd: options.cwd,
			detached: process.platform !== "win32",
			env: options.env,
			stdio: ["ignore", "pipe", "pipe"],
		});

		if (child.pid) trackDetachedChildPid(child.pid);
		let timedOut = false;
		let backgrounded = false;
		let settled = false;
		let timeoutHandle: NodeJS.Timeout | undefined;

		const killChild = () => {
			if (child.pid) killProcessTree(child.pid);
		};

		const task = options.backgroundTaskManager?.createForegroundShellTask({
			command: options.command,
			description: options.description,
			cwd: options.cwd,
			timeout: options.timeout,
			toolCallId: options.toolCallId,
			kill: killChild,
		});

		if (options.timeout !== undefined && options.timeout > 0) {
			timeoutHandle = setTimeout(() => {
				timedOut = true;
				killChild();
			}, options.timeout * 1000);
		}

		const onData = (data: Buffer) => {
			task?.appendOutput(data);
			options.onData(data);
		};
		child.stdout?.on("data", onData);
		child.stderr?.on("data", onData);

		const cleanup = () => {
			if (child.pid) untrackDetachedChildPid(child.pid);
			if (timeoutHandle) clearTimeout(timeoutHandle);
			if (options.signal) options.signal.removeEventListener("abort", onAbort);
		};

		const onAbort = () => {
			if (!backgrounded) killChild();
		};
		if (options.signal) {
			if (options.signal.aborted) onAbort();
			else options.signal.addEventListener("abort", onAbort, { once: true });
		}

		if (task) {
			void task.backgroundRequested.then(() => {
				if (settled) return;
				backgrounded = true;
				settled = true;
				if (timeoutHandle) {
					clearTimeout(timeoutHandle);
					timeoutHandle = undefined;
				}
				if (options.signal) options.signal.removeEventListener("abort", onAbort);
				resolve({ kind: "backgrounded", taskId: task.id, outputPath: task.outputPath });
			});
		}

		waitForChildProcess(child)
			.then((code) => {
				cleanup();
				task?.complete(code);
				if (settled) return;
				settled = true;
				if (options.signal?.aborted && !backgrounded) {
					reject(new Error("aborted"));
					return;
				}
				if (timedOut) {
					reject(new Error(`timeout:${options.timeout}`));
					return;
				}
				resolve({ kind: "completed", exitCode: code });
			})
			.catch((err) => {
				cleanup();
				task?.complete(null, "failed");
				if (settled) return;
				settled = true;
				reject(err);
			});
	});
}

function formatBashProgress(progress: BashProgressDetails | undefined): string | undefined {
	if (!progress) return undefined;
	const parts = [formatDuration(progress.elapsedMs)];
	if (progress.totalLines > 1) parts.push(`${progress.totalLines.toLocaleString()} lines`);
	if (progress.totalBytes > 0) parts.push(formatSize(progress.totalBytes));
	if (progress.timeout && progress.timeout > 0) parts.push(`timeout ${progress.timeout}s`);
	return parts.join(" · ");
}

function formatBashCall(
	args: { command?: string; description?: string; timeout?: number } | undefined,
	expanded: boolean,
): string {
	const command = str(args?.command);
	const timeout = args?.timeout as number | undefined;
	const timeoutSuffix = timeout ? theme.fg("muted", ` (timeout ${timeout}s)`) : "";
	if (!expanded && command !== null) {
		const activity = formatToolActivityLine("bash", { command: command ?? "", description: args?.description });
		return theme.fg("toolTitle", theme.bold(activity)) + timeoutSuffix;
	}
	const commandDisplay = command === null ? invalidArgText(theme) : command ? command : theme.fg("toolOutput", "...");
	return theme.fg("toolTitle", theme.bold(`$ ${commandDisplay}`)) + timeoutSuffix;
}

function rebuildBashResultRenderComponent(
	component: BashResultRenderComponent,
	result: {
		content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
		details?: BashToolDetails;
	},
	options: ToolRenderResultOptions,
	showImages: boolean,
	startedAt: number | undefined,
	endedAt: number | undefined,
	args?: { command?: string; description?: string },
): void {
	const state = component.state;
	component.clear();

	const output = getTextOutput(result as any, showImages).trim();
	const renderArgs = args;

	if (!options.expanded) {
		const duration = options.isPartial
			? formatBashProgress(result.details?.progress)
			: startedAt !== undefined
				? formatDuration((endedAt ?? Date.now()) - startedAt)
				: undefined;
		component.addChild(
			new Text(
				`\n${theme.fg("muted", formatToolActivityResultLine("bash", renderArgs, result, { isPartial: options.isPartial, duration }))}`,
				0,
				0,
			),
		);
	}

	if (output && options.expanded) {
		const styledOutput = output
			.split("\n")
			.map((line) => theme.fg("toolOutput", line))
			.join("\n");

		if (options.expanded) {
			component.addChild(new Text(`\n${styledOutput}`, 0, 0));
		} else {
			component.addChild({
				render: (width: number) => {
					if (state.cachedLines === undefined || state.cachedWidth !== width) {
						const preview = truncateToVisualLines(styledOutput, BASH_PREVIEW_LINES, width);
						state.cachedLines = preview.visualLines;
						state.cachedSkipped = preview.skippedCount;
						state.cachedWidth = width;
					}
					if (state.cachedSkipped && state.cachedSkipped > 0) {
						const hint =
							theme.fg("muted", `... (${state.cachedSkipped} earlier lines,`) +
							` ${keyHint("app.tools.expand", "to expand")})`;
						return ["", truncateToWidth(hint, width, "..."), ...(state.cachedLines ?? [])];
					}
					return ["", ...(state.cachedLines ?? [])];
				},
				invalidate: () => {
					state.cachedWidth = undefined;
					state.cachedLines = undefined;
					state.cachedSkipped = undefined;
				},
			});
		}
	}

	const truncation = result.details?.truncation;
	const fullOutputPath = result.details?.fullOutputPath;
	if (truncation?.truncated || fullOutputPath) {
		const warnings: string[] = [];
		if (fullOutputPath) {
			warnings.push(`Full output: ${fullOutputPath}`);
		}
		if (truncation?.truncated) {
			if (truncation.truncatedBy === "lines") {
				warnings.push(`Truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines`);
			} else {
				warnings.push(
					`Truncated: ${truncation.outputLines} lines shown (${formatSize(truncation.maxBytes ?? DEFAULT_MAX_BYTES)} limit)`,
				);
			}
		}
		component.addChild(new Text(`\n${theme.fg("warning", `[${warnings.join(". ")}]`)}`, 0, 0));
	}

	if (options.expanded && startedAt !== undefined) {
		const label = options.isPartial ? "Elapsed" : "Took";
		const endTime = endedAt ?? Date.now();
		component.addChild(new Text(`\n${theme.fg("muted", `${label} ${formatDuration(endTime - startedAt)}`)}`, 0, 0));
	}
}

export function createBashToolDefinition(
	cwd: string,
	options?: BashToolOptions,
): ToolDefinition<typeof bashSchema, BashToolDetails | undefined, BashRenderState> {
	const hasCustomOperations = Boolean(options?.operations);
	const ops = options?.operations ?? createLocalBashOperations({ shellPath: options?.shellPath });
	const commandPrefix = options?.commandPrefix;
	const spawnHook = options?.spawnHook;
	const backgroundTaskManager = options?.backgroundTaskManager;
	return {
		name: "bash",
		label: "bash",
		description: `Execute a bash command in the current working directory. Returns stdout and stderr. Output is truncated to last ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). If truncated, full output is saved to a temp file. Optionally provide a timeout in seconds. Prefer the dedicated read/grep/find/ls tools for project inspection because they do not require approval inside the workspace. Use bash for tests, builds, package scripts, git commands, and terminal operations that cannot be represented by read-only tools. Do not use destructive commands, --force, --no-verify, or dependency downgrades without explicit user approval. Always include a concise description when the command is not instantly obvious; Neo uses it as the human-facing tool summary.`,
		promptSnippet:
			"Execute shell commands for tests, builds, package scripts, and git; prefer read/grep/find/ls for inspection",
		parameters: bashSchema,
		executionMode: "sequential",
		isSearchOrReadCommand(args) {
			const activity = summarizeToolCall("bash", args);
			return {
				isSearch: activity.kind === "search",
				isRead: activity.kind === "read",
				isList: activity.kind === "list",
			};
		},
		getToolUseSummary(args) {
			return summarizeToolCall("bash", args).compact;
		},
		getActivityDescription(args) {
			const summary = summarizeToolCall("bash", args);
			return args.description?.trim() ? `Running ${summary.compact}` : summary.title;
		},
		renderToolResultSummary(result, args, context) {
			return summarizeToolResult("bash", args, result as any, context).label;
		},
		async execute(
			toolCallId,
			{ command, description, timeout }: { command: string; description?: string; timeout?: number },
			signal?: AbortSignal,
			onUpdate?,
			_ctx?,
		) {
			const resolvedCommand = commandPrefix ? `${commandPrefix}\n${command}` : command;
			const spawnContext = resolveSpawnContext(resolvedCommand, cwd, spawnHook);
			const output = new OutputAccumulator({ tempFilePrefix: "neo-bash" });
			const startedAt = Date.now();
			let updateTimer: NodeJS.Timeout | undefined;
			let updateDirty = false;
			let lastUpdateAt = 0;

			const emitOutputUpdate = () => {
				if (!onUpdate || !updateDirty) return;
				updateDirty = false;
				lastUpdateAt = Date.now();
				const snapshot = output.snapshot({ persistIfTruncated: true });
				onUpdate({
					content: [{ type: "text", text: snapshot.content || "" }],
					details: {
						truncation: snapshot.truncation.truncated ? snapshot.truncation : undefined,
						fullOutputPath: snapshot.fullOutputPath,
						progress: createBashProgressDetails(output, startedAt, timeout),
					},
				});
			};

			const clearUpdateTimer = () => {
				if (updateTimer) {
					clearTimeout(updateTimer);
					updateTimer = undefined;
				}
			};

			const scheduleOutputUpdate = () => {
				if (!onUpdate) return;
				updateDirty = true;
				const delay = BASH_UPDATE_THROTTLE_MS - (Date.now() - lastUpdateAt);
				if (delay <= 0) {
					clearUpdateTimer();
					emitOutputUpdate();
					return;
				}
				updateTimer ??= setTimeout(() => {
					updateTimer = undefined;
					emitOutputUpdate();
				}, delay);
			};

			if (onUpdate) {
				onUpdate({
					content: [],
					details: { progress: createBashProgressDetails(output, startedAt, timeout) },
				});
			}

			const handleData = (data: Buffer) => {
				output.append(data);
				scheduleOutputUpdate();
			};

			const finishOutput = async () => {
				output.finish();
				clearUpdateTimer();
				emitOutputUpdate();
				const snapshot = output.snapshot({ persistIfTruncated: true });
				await output.closeTempFile();
				return snapshot;
			};

			const formatOutput = (snapshot: Awaited<ReturnType<typeof finishOutput>>, emptyText = "(no output)") => {
				const truncation = snapshot.truncation;
				let text = snapshot.content || emptyText;
				let details: BashToolDetails | undefined;
				if (truncation.truncated) {
					details = { truncation, fullOutputPath: snapshot.fullOutputPath };
					const startLine = truncation.totalLines - truncation.outputLines + 1;
					const endLine = truncation.totalLines;
					if (truncation.lastLinePartial) {
						const lastLineSize = formatSize(output.getLastLineBytes());
						text += `\n\n[Showing last ${formatSize(truncation.outputBytes)} of line ${endLine} (line is ${lastLineSize}). Full output: ${snapshot.fullOutputPath}]`;
					} else if (truncation.truncatedBy === "lines") {
						text += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines}. Full output: ${snapshot.fullOutputPath}]`;
					} else {
						text += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Full output: ${snapshot.fullOutputPath}]`;
					}
				}
				return { text, details };
			};

			const appendStatus = (text: string, status: string) => `${text ? `${text}\n\n` : ""}${status}`;

			try {
				let exitCode: number | null;
				try {
					const result = hasCustomOperations
						? await ops.exec(spawnContext.command, spawnContext.cwd, {
								onData: handleData,
								signal,
								timeout,
								env: spawnContext.env,
							})
						: await executeLocalBashWithOptionalBackground({
								command: spawnContext.command,
								cwd: spawnContext.cwd,
								env: spawnContext.env,
								shellPath: options?.shellPath,
								onData: handleData,
								signal,
								timeout,
								backgroundTaskManager,
								toolCallId,
								description,
							});
					if ("kind" in result && result.kind === "backgrounded") {
						clearUpdateTimer();
						const details: BashToolDetails = {
							backgrounded: true,
							backgroundTaskId: result.taskId,
							backgroundOutputPath: result.outputPath,
							progress: createBashProgressDetails(output, startedAt, timeout),
						};
						return {
							content: [
								{
									type: "text",
									text: `Command is running in background as ${result.taskId}. Output log: ${result.outputPath}`,
								},
							],
							details,
						};
					}
					if ("exitCode" in result) {
						exitCode = result.exitCode;
					} else {
						throw new Error("Bash command did not return an exit code");
					}
				} catch (err) {
					const snapshot = await finishOutput();
					const { text } = formatOutput(snapshot, "");
					if (err instanceof Error && err.message === "aborted") {
						throw new Error(appendStatus(text, "Command aborted"));
					}
					if (err instanceof Error && err.message.startsWith("timeout:")) {
						const timeoutSecs = err.message.split(":")[1];
						throw new Error(appendStatus(text, `Command timed out after ${timeoutSecs} seconds`));
					}
					throw err;
				}

				const snapshot = await finishOutput();
				const rawSnapshotText = snapshot.content || "";
				const noMatches = isNoMatchBashExit(spawnContext.command, exitCode, rawSnapshotText);
				const { text: outputText, details: outputDetails } = formatOutput(
					snapshot,
					noMatches ? "No matches found" : "(no output)",
				);
				const details: BashToolDetails | undefined = {
					...(outputDetails ?? {}),
					exitCode,
					noMatches: noMatches || undefined,
					progress: createBashProgressDetails(output, startedAt, timeout),
				};
				if (!isBenignBashExit(spawnContext.command, exitCode, rawSnapshotText)) {
					throw new Error(appendStatus(outputText, `Command exited with code ${exitCode}`));
				}
				return { content: [{ type: "text", text: outputText }], details };
			} finally {
				clearUpdateTimer();
			}
		},
		renderCall(args, _theme, context) {
			const state = context.state;
			if (context.executionStarted && state.startedAt === undefined) {
				state.startedAt = Date.now();
				state.endedAt = undefined;
			}
			const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			text.setText(formatBashCall(args, context.expanded));
			return text;
		},
		renderResult(result, options, _theme, context) {
			const state = context.state;
			if (state.startedAt !== undefined && options.isPartial && !state.interval) {
				state.interval = setInterval(() => context.invalidate(), 1000);
			}
			if (!options.isPartial || context.isError) {
				state.endedAt ??= Date.now();
				if (state.interval) {
					clearInterval(state.interval);
					state.interval = undefined;
				}
			}
			const component =
				(context.lastComponent as BashResultRenderComponent | undefined) ?? new BashResultRenderComponent();
			rebuildBashResultRenderComponent(
				component,
				result as any,
				options,
				context.showImages,
				state.startedAt,
				state.endedAt,
				context.args,
			);
			component.invalidate();
			return component;
		},
	};
}

export function createBashTool(cwd: string, options?: BashToolOptions): AgentTool<typeof bashSchema> {
	return wrapToolDefinition(createBashToolDefinition(cwd, options));
}
