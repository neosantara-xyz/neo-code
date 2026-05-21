import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { BackgroundTaskManager } from "../src/core/background-tasks.js";

describe("background task manager", () => {
	it("backgrounds a foreground shell task and keeps it visible", () => {
		const manager = new BackgroundTaskManager();
		const events: string[] = [];
		manager.onUpdate((event) => events.push(event.type));
		const kill = vi.fn();
		const handle = manager.createForegroundShellTask({
			command: "npm run check",
			description: "Run repository check",
			cwd: process.cwd(),
			toolCallId: "tool-1",
			kill,
		});
		handle.appendOutput(Buffer.from("line one\nline two\n"));

		const backgrounded = manager.requestBackgroundCurrentShellTask();
		expect(backgrounded?.id).toBe(handle.id);
		expect(backgrounded?.status).toBe("running");
		expect(manager.getRunningBackgroundTaskCount()).toBe(1);
		expect(manager.listTasks()).toHaveLength(1);
		expect(existsSync(handle.outputPath)).toBe(true);
		expect(events).toContain("backgrounded");
		expect(kill).not.toHaveBeenCalled();
	});

	it("records completion and output tail for backgrounded tasks", async () => {
		const manager = new BackgroundTaskManager();
		const events: string[] = [];
		manager.onUpdate((event) => events.push(event.type));
		const handle = manager.createForegroundShellTask({
			command: "node script.js",
			cwd: process.cwd(),
			kill: vi.fn(),
		});
		handle.appendOutput(Buffer.from("alpha\nbeta\n"));
		manager.requestBackgroundCurrentShellTask();
		await handle.backgroundRequested;
		handle.complete(0);

		const task = manager.getTask(handle.id);
		expect(task?.status).toBe("completed");
		expect(task?.exitCode).toBe(0);
		expect(manager.getRunningBackgroundTaskCount()).toBe(0);
		expect(manager.readTaskOutputTail(handle.id)).toContain("beta");
		expect(events).toContain("completed");
	});

	it("stops a running background shell task", () => {
		const manager = new BackgroundTaskManager();
		const kill = vi.fn();
		const handle = manager.createForegroundShellTask({
			command: "sleep 999",
			cwd: process.cwd(),
			kill,
		});
		manager.requestBackgroundCurrentShellTask();

		const stopped = manager.stopTask(handle.id);
		expect(stopped?.status).toBe("killed");
		expect(kill).toHaveBeenCalledTimes(1);
	});
});
