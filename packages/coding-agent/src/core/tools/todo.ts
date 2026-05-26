import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentToolResult } from "@neosantara-xyz/agent-core";
import { type Static, Type } from "typebox";
import type { ExtensionContext, ToolDefinition } from "../extensions/types.js";

const todoItemSchema = Type.Object({
	id: Type.String({ description: "Stable todo id, such as todo-1" }),
	content: Type.String({ description: "Concrete task text in imperative form (e.g. 'Run tests')" }),
	status: Type.Union([Type.Literal("pending"), Type.Literal("in_progress"), Type.Literal("completed")]),
});

const todoSchema = Type.Object({
	items: Type.Optional(Type.Array(todoItemSchema, { description: "Complete replacement list of current todos" })),
	note: Type.Optional(Type.String({ description: "Optional short planning note to store with the todo list" })),
});

export type TodoToolInput = Static<typeof todoSchema>;

export interface TodoToolDetails {
	path: string;
	count: number;
	pending: number;
	inProgress: number;
	completed: number;
}

interface TodoFile {
	version: 1;
	updatedAt: string;
	note?: string;
	items: TodoToolInput["items"];
}

function getTodoPath(cwd: string): string {
	return join(cwd, ".neo-code", "todos.json");
}

function summarize(items: NonNullable<TodoToolInput["items"]>): Omit<TodoToolDetails, "path"> {
	return {
		count: items.length,
		pending: items.filter((item) => item.status === "pending").length,
		inProgress: items.filter((item) => item.status === "in_progress").length,
		completed: items.filter((item) => item.status === "completed").length,
	};
}

async function readTodoFile(path: string): Promise<TodoFile> {
	try {
		const raw = await readFile(path, "utf8");
		const parsed = JSON.parse(raw) as Partial<TodoFile>;
		return {
			version: 1,
			updatedAt: parsed.updatedAt ?? new Date().toISOString(),
			note: parsed.note,
			items: parsed.items ?? [],
		};
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
			return { version: 1, updatedAt: new Date().toISOString(), items: [] };
		}
		throw error;
	}
}

function formatTodoList(file: TodoFile): string {
	const lines = ["Todo list"];
	if (file.note) lines.push(`Note: ${file.note}`);
	if (!file.items || file.items.length === 0) {
		lines.push("No todos recorded.");
		return lines.join("\n");
	}
	for (const item of file.items) {
		const marker = item.status === "completed" ? "x" : item.status === "in_progress" ? ">" : " ";
		lines.push(`- [${marker}] ${item.id}: ${item.content}`);
	}
	return lines.join("\n");
}

export function createTodoToolDefinition(cwd: string): ToolDefinition<typeof todoSchema, TodoToolDetails> {
	return {
		name: "todo",
		label: "Todo",
		description:
			"Read or replace the current implementation todo list. Use proactively for multi-step tasks (3+ steps). Helps track progress and shows the user what you are working on. Mark each task completed immediately when done.",
		promptSnippet: "Maintain a concise implementation todo list for multi-step work.",
		promptGuidelines: [
			"Use todo proactively when a task requires 3+ steps, the user provides multiple tasks, or work is non-trivial. Do NOT use for single trivial tasks or purely informational requests.",
			"Keep exactly ONE item as in_progress at a time. Mark items completed immediately after finishing, not in batches.",
			"Create specific, actionable items. Break complex tasks into smaller steps.",
			"When blocked or encountering errors, keep the task in_progress and add a new task for the blocker. Never mark a task completed if tests fail or implementation is partial.",
			"Update the todo list in real-time as you work. Remove tasks that are no longer relevant.",
		],
		parameters: todoSchema,
		executionMode: "sequential",
		getActivityDescription: (args) => (args.items ? "updating todos" : "reading todos"),
		getToolUseSummary: (args) => (args.items ? `Update ${args.items.length} todos` : "Read todos"),
		renderToolResultSummary: (result) => {
			const details = result.details;
			return `todos ${details.completed}/${details.count} completed, ${details.inProgress} in progress`;
		},
		async execute(
			_toolCallId,
			params,
			_signal,
			_onUpdate,
			_ctx: ExtensionContext,
		): Promise<AgentToolResult<TodoToolDetails>> {
			const path = getTodoPath(cwd);
			const existing = await readTodoFile(path);
			const next: TodoFile = {
				version: 1,
				updatedAt: new Date().toISOString(),
				note: params.note ?? existing.note,
				items: params.items ?? existing.items ?? [],
			};
			if (params.items || params.note !== undefined) {
				await mkdir(join(cwd, ".neo-code"), { recursive: true });
				await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
			}
			const metrics = summarize(next.items ?? []);

			// Verification nudge: when all 3+ tasks are completed and none mentions
			// verification/testing, remind the agent to verify its work.
			const allDone = (next.items ?? []).length >= 3 && metrics.pending === 0 && metrics.inProgress === 0;
			const hasVerification = (next.items ?? []).some((t) => /verif|test|check|validate/i.test(t.content));
			const nudge =
				allDone && !hasVerification
					? "\n\nAll tasks completed. Consider verifying your work: run tests, check for regressions, or review the changes before reporting completion."
					: "";

			return {
				content: [
					{
						type: "text",
						text: `${formatTodoList(next)}\n\nStored at ${path}\n\nContinue using the todo list to track progress. Mark tasks completed as you finish them.${nudge}`,
					},
				],
				details: { path, ...metrics },
			};
		},
	};
}
