import { randomBytes } from "node:crypto";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatSize } from "./tools/truncate.js";

export type BackgroundTaskStatus = "foreground" | "running" | "completed" | "failed" | "killed";

export interface BackgroundShellTaskSnapshot {
	id: string;
	type: "local_bash";
	status: BackgroundTaskStatus;
	command: string;
	description?: string;
	cwd: string;
	startedAt: number;
	endedAt?: number;
	exitCode?: number | null;
	timeout?: number;
	outputPath: string;
	totalLines: number;
	totalBytes: number;
	toolCallId?: string;
	backgroundedAt?: number;
}

export type BackgroundTaskEventKind =
	| "foreground_started"
	| "backgrounded"
	| "completed"
	| "failed"
	| "killed"
	| "output";

export interface BackgroundTaskEvent {
	type: BackgroundTaskEventKind;
	task: BackgroundShellTaskSnapshot;
}

export interface CreateForegroundShellTaskOptions {
	command: string;
	description?: string;
	cwd: string;
	timeout?: number;
	toolCallId?: string;
	kill: () => void;
}

export interface ForegroundShellTaskHandle {
	id: string;
	outputPath: string;
	backgroundRequested: Promise<void>;
	appendOutput(data: Buffer): void;
	markBackgrounded(): void;
	complete(exitCode: number | null, status?: Exclude<BackgroundTaskStatus, "foreground" | "running">): void;
	snapshot(): BackgroundShellTaskSnapshot;
	isBackgrounded(): boolean;
}

function createTaskId(): string {
	return `bg_${randomBytes(3).toString("hex")}`;
}

function createOutputPath(id: string): string {
	const dir = join(tmpdir(), "neo-code-background");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	return join(dir, `${id}.log`);
}

function countNewlines(data: Buffer): number {
	let count = 0;
	for (const byte of data) {
		if (byte === 10) count += 1;
	}
	return count;
}

function cloneTask(task: MutableBackgroundShellTask): BackgroundShellTaskSnapshot {
	return {
		id: task.id,
		type: "local_bash",
		status: task.status,
		command: task.command,
		description: task.description,
		cwd: task.cwd,
		startedAt: task.startedAt,
		endedAt: task.endedAt,
		exitCode: task.exitCode,
		timeout: task.timeout,
		outputPath: task.outputPath,
		totalLines: task.totalLines,
		totalBytes: task.totalBytes,
		toolCallId: task.toolCallId,
		backgroundedAt: task.backgroundedAt,
	};
}

type MutableBackgroundShellTask = {
	id: string;
	type: "local_bash";
	status: BackgroundTaskStatus;
	command: string;
	description?: string;
	cwd: string;
	startedAt: number;
	endedAt?: number;
	exitCode?: number | null;
	timeout?: number;
	outputPath: string;
	totalLines: number;
	totalBytes: number;
	toolCallId?: string;
	backgroundedAt?: number;
	kill: () => void;
	fd: number;
	backgroundResolve: () => void;
	backgroundRequested: Promise<void>;
};

export class BackgroundTaskManager {
	private readonly tasks = new Map<string, MutableBackgroundShellTask>();
	private currentForegroundTaskId: string | undefined;
	private readonly listeners = new Set<(event: BackgroundTaskEvent) => void>();

	onUpdate(listener: (event: BackgroundTaskEvent) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	createForegroundShellTask(options: CreateForegroundShellTaskOptions): ForegroundShellTaskHandle {
		const id = createTaskId();
		const outputPath = createOutputPath(id);
		let backgroundResolve: () => void = () => {};
		const backgroundRequested = new Promise<void>((resolve) => {
			backgroundResolve = resolve;
		});
		const task: MutableBackgroundShellTask = {
			id,
			type: "local_bash",
			status: "foreground",
			command: options.command,
			description: options.description,
			cwd: options.cwd,
			startedAt: Date.now(),
			timeout: options.timeout,
			outputPath,
			totalLines: 0,
			totalBytes: 0,
			toolCallId: options.toolCallId,
			kill: options.kill,
			fd: openSync(outputPath, "a"),
			backgroundResolve,
			backgroundRequested,
		};
		this.tasks.set(id, task);
		this.currentForegroundTaskId = id;
		this.emit("foreground_started", task);

		return {
			id,
			outputPath,
			backgroundRequested,
			appendOutput: (data) => this.appendOutput(id, data),
			markBackgrounded: () => this.markBackgrounded(id),
			complete: (exitCode, status) => this.completeTask(id, exitCode, status),
			snapshot: () => cloneTask(task),
			isBackgrounded: () => task.status !== "foreground",
		};
	}

	requestBackgroundCurrentShellTask(): BackgroundShellTaskSnapshot | undefined {
		const task = this.currentForegroundTaskId ? this.tasks.get(this.currentForegroundTaskId) : undefined;
		if (!task || task.status !== "foreground") return undefined;
		this.markBackgrounded(task.id);
		task.backgroundResolve();
		return cloneTask(task);
	}

	listTasks(options: { includeForeground?: boolean } = {}): BackgroundShellTaskSnapshot[] {
		return Array.from(this.tasks.values())
			.filter((task) => options.includeForeground || task.status !== "foreground")
			.sort((a, b) => b.startedAt - a.startedAt)
			.map(cloneTask);
	}

	getTask(id: string): BackgroundShellTaskSnapshot | undefined {
		const task = this.tasks.get(id);
		return task ? cloneTask(task) : undefined;
	}

	getRunningBackgroundTaskCount(): number {
		return this.listTasks().filter((task) => task.status === "running").length;
	}

	stopTask(id: string): BackgroundShellTaskSnapshot | undefined {
		const task = this.tasks.get(id);
		if (!task) return undefined;
		if (task.status === "completed" || task.status === "failed" || task.status === "killed") return cloneTask(task);
		task.status = "killed";
		task.endedAt = Date.now();
		task.kill();
		this.closeTaskStream(task);
		this.emit("killed", task);
		return cloneTask(task);
	}

	readTaskOutputTail(id: string, maxLines = 80, maxBytes = 64 * 1024): string | undefined {
		const task = this.tasks.get(id);
		if (!task) return undefined;
		try {
			const stat = statSync(task.outputPath);
			const start = Math.max(0, stat.size - maxBytes);
			const data = readFileSync(task.outputPath).subarray(start).toString("utf8");
			const lines = data.split(/\r?\n/);
			return lines.slice(-maxLines).join("\n").trimEnd();
		} catch {
			return undefined;
		}
	}

	formatTaskSummary(task: BackgroundShellTaskSnapshot): string {
		const title = task.description?.trim() || task.command;
		const elapsedMs = (task.endedAt ?? Date.now()) - task.startedAt;
		const parts = [task.status, `${(elapsedMs / 1000).toFixed(1)}s`];
		if (typeof task.exitCode === "number") parts.push(`exit ${task.exitCode}`);
		if (task.totalLines > 0) parts.push(`${task.totalLines.toLocaleString()} lines`);
		if (task.totalBytes > 0) parts.push(formatSize(task.totalBytes));
		return `${task.id}  ${parts.join(" · ")}  ${title}`;
	}

	private appendOutput(id: string, data: Buffer): void {
		const task = this.tasks.get(id);
		if (!task) return;
		task.totalBytes += data.length;
		task.totalLines += countNewlines(data);
		appendFileSync(task.outputPath, data);
		if (task.status === "running") this.emit("output", task);
	}

	private markBackgrounded(id: string): void {
		const task = this.tasks.get(id);
		if (!task || task.status !== "foreground") return;
		task.status = "running";
		task.backgroundedAt = Date.now();
		if (this.currentForegroundTaskId === id) this.currentForegroundTaskId = undefined;
		this.emit("backgrounded", task);
	}

	private completeTask(
		id: string,
		exitCode: number | null,
		status: Exclude<BackgroundTaskStatus, "foreground" | "running"> = exitCode === 0 ? "completed" : "failed",
	): void {
		const task = this.tasks.get(id);
		if (!task) return;
		const wasBackgrounded = task.status !== "foreground";
		if (task.status === "killed") {
			task.exitCode = exitCode;
			this.closeTaskStream(task);
			return;
		}
		task.status = status;
		task.exitCode = exitCode;
		task.endedAt = Date.now();
		if (this.currentForegroundTaskId === id) this.currentForegroundTaskId = undefined;
		this.closeTaskStream(task);
		if (wasBackgrounded) {
			this.emit(status === "completed" ? "completed" : "failed", task);
		} else {
			// Foreground tasks are removed when they finish normally; only backgrounded
			// tasks stay visible in /tasks.
			this.tasks.delete(id);
		}
	}

	private closeTaskStream(task: MutableBackgroundShellTask): void {
		try {
			closeSync(task.fd);
		} catch {
			// Ignore cleanup failures.
		}
	}

	private emit(type: BackgroundTaskEventKind, task: MutableBackgroundShellTask): void {
		const event = { type, task: cloneTask(task) } satisfies BackgroundTaskEvent;
		for (const listener of this.listeners) listener(event);
	}
}
