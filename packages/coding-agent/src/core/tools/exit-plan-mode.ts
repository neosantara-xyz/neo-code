import { Text } from "@neosantara/tui";
import { type Static, Type } from "typebox";
import type { AgentWorkMode } from "../agent-mode.js";
import type { ToolDefinition, ToolRenderResultOptions } from "../extensions/types.js";
import { formatToolActivityResultLine } from "./tool-activity.js";

export const EXIT_PLAN_MODE_TOOL_NAME = "ExitPlanMode" as const;

const allowedPromptSchema = Type.Object({
	tool: Type.String({ description: "Tool name this semantic permission applies to, for example Bash" }),
	prompt: Type.String({ description: "Semantic action description, for example run tests" }),
});

const exitPlanModeSchema = Type.Object({
	plan: Type.String({
		description: "Final implementation plan in markdown. Include files, steps, risks, and verification.",
	}),
	allowedPrompts: Type.Optional(
		Type.Array(allowedPromptSchema, {
			description: "Optional semantic permissions that would help implement the plan after approval.",
		}),
	),
});

export type ExitPlanModeToolInput = Static<typeof exitPlanModeSchema>;

export interface ExitPlanModeToolDetails {
	approved: boolean;
	restoredMode: AgentWorkMode;
	plan: string;
	allowedPrompts?: Array<{ tool: string; prompt: string }>;
}

export interface ExitPlanModeToolOptions {
	getCurrentMode: () => AgentWorkMode;
	onApproved: (plan: string) => AgentWorkMode;
}

function firstPlanLine(plan: string): string {
	const line = plan
		.split("\n")
		.map((value) => value.trim())
		.find((value) => value.length > 0);
	return line ? line.replace(/^#+\s*/, "") : "Final plan";
}

function compact(value: string, max = 180): string {
	const normalized = value.replace(/\s+/g, " ").trim();
	if (normalized.length <= max) return normalized;
	return `${normalized.slice(0, Math.max(0, max - 1))}…`;
}

function formatExitPlanModeCall(args: ExitPlanModeToolInput | undefined): string {
	const title = args?.plan ? firstPlanLine(args.plan) : "Final plan";
	return `✦ Plan ready\n  ├─ ${compact(title, 90)}`;
}

function formatExitPlanModeResult(
	result: { content: Array<{ type: "text"; text: string }>; details?: ExitPlanModeToolDetails; isError?: boolean },
	args: ExitPlanModeToolInput | undefined,
	options: ToolRenderResultOptions,
): string | undefined {
	if (!options.expanded && !result.isError) {
		return `\n${formatToolActivityResultLine(EXIT_PLAN_MODE_TOOL_NAME, args, result)}`;
	}
	const output = result.content
		.filter((content): content is { type: "text"; text: string } => content.type === "text")
		.map((content) => content.text)
		.join("\n");
	return output ? `\n${output}` : undefined;
}

export function createExitPlanModeToolDefinition(
	options: ExitPlanModeToolOptions,
): ToolDefinition<typeof exitPlanModeSchema, ExitPlanModeToolDetails> {
	return {
		name: EXIT_PLAN_MODE_TOOL_NAME,
		label: "exit plan mode",
		description:
			"Use this tool only in plan mode when the final implementation plan is ready for user approval. It asks the user to approve the plan, exits plan mode after approval, and lets Neo continue implementation.",
		promptSnippet: "Submit the final plan for approval and exit plan mode",
		promptGuidelines: [
			`In plan mode, call ${EXIT_PLAN_MODE_TOOL_NAME} with the final plan when planning is complete instead of asking for approval in normal text.`,
		],
		parameters: exitPlanModeSchema,
		executionMode: "sequential",
		isSearchOrReadCommand() {
			return { isSearch: false, isRead: false, isList: false };
		},
		getToolUseSummary(args) {
			return `Submit plan: ${compact(firstPlanLine(args.plan), 80)}`;
		},
		getActivityDescription() {
			return "submitting plan";
		},
		renderToolResultSummary(result) {
			const details = result.details as ExitPlanModeToolDetails | undefined;
			return details?.approved ? `plan approved; mode ${details.restoredMode}` : "plan submitted";
		},
		async execute(_toolCallId, params) {
			if (options.getCurrentMode() !== "plan") {
				throw new Error(`${EXIT_PLAN_MODE_TOOL_NAME}: only available in plan mode`);
			}

			const plan = params.plan.trim();
			if (!plan) {
				throw new Error(`${EXIT_PLAN_MODE_TOOL_NAME}: plan must not be empty`);
			}

			const restoredMode = options.onApproved(plan);
			const allowedPrompts = params.allowedPrompts?.map((entry) => ({
				tool: entry.tool,
				prompt: entry.prompt,
			}));
			const allowedPromptText = allowedPrompts?.length
				? `\n\nSemantic permissions requested by the plan:\n${allowedPrompts
						.map((entry) => `- ${entry.tool}: ${entry.prompt}`)
						.join("\n")}`
				: "";

			return {
				content: [
					{
						type: "text",
						text: `User approved the plan. Plan mode is now exited and Neo is in ${restoredMode} mode. You can now start implementing.\n\n## Approved Plan\n${plan}${allowedPromptText}`,
					},
				],
				details: {
					approved: true,
					restoredMode,
					plan,
					allowedPrompts,
				},
			};
		},
		renderCall(args) {
			return new Text(formatExitPlanModeCall(args as ExitPlanModeToolInput | undefined), 1, 0);
		},
		renderResult(result, options, _theme, context) {
			const output = formatExitPlanModeResult(
				result as {
					content: Array<{ type: "text"; text: string }>;
					details?: ExitPlanModeToolDetails;
					isError?: boolean;
				},
				context.args as ExitPlanModeToolInput | undefined,
				options,
			);
			return new Text(output ?? "", 1, 0);
		},
	};
}
