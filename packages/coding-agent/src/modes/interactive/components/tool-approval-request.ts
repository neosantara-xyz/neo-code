import { type Component, type Focusable, getKeybindings, Text, visibleWidth } from "@neosantara/tui";
import {
	getExitPlanModePlan,
	type ToolApprovalDecision,
	type ToolApprovalRequest,
} from "../../../core/tool-approval.js";
import { theme } from "../theme/theme.js";

export type ToolApprovalVisualState = "pending" | "allowed" | "denied";

type ApprovalOption = {
	key: string;
	label: string;
	hint: string;
	decision?: ToolApprovalDecision;
	startsFeedback?: boolean;
};

function sessionApprovalOption(request: ToolApprovalRequest): ApprovalOption {
	if (request.toolName === "bash") {
		return {
			key: "2",
			label: "Allow command for session",
			hint: "same command in this repo",
			decision: { behavior: "allow", scope: "session" },
		};
	}
	if (request.toolName === "write" || request.toolName === "edit") {
		return {
			key: "2",
			label: "Allow file for session",
			hint: "same file this session",
			decision: { behavior: "allow", scope: "session" },
		};
	}
	return {
		key: "2",
		label: "Allow for session",
		hint: "same action this session",
		decision: { behavior: "allow", scope: "session" },
	};
}

function defaultApprovalOptions(request: ToolApprovalRequest): ApprovalOption[] {
	return [
		{
			key: "1",
			label: "Allow once",
			hint: "only this action",
			decision: { behavior: "allow", scope: "once" },
		},
		sessionApprovalOption(request),
		{
			key: "3",
			label: "Deny",
			hint: "stop this run",
			decision: { behavior: "deny" },
		},
		{
			key: "4",
			label: "Deny with feedback",
			hint: "tell Neo what to change",
			startsFeedback: true,
		},
	];
}

const EXIT_PLAN_MODE_APPROVAL_OPTIONS: ApprovalOption[] = [
	{
		key: "1",
		label: "Yes, auto-accept edits",
		hint: "approve and use accept-edits",
		decision: { behavior: "allow", scope: "once", nextMode: "accept-edits" },
	},
	{
		key: "2",
		label: "Yes, manually approve edits",
		hint: "approve and use default",
		decision: { behavior: "allow", scope: "once", nextMode: "default" },
	},
	{
		key: "3",
		label: "Yes, fork to fresh context",
		hint: "implement in a new thread",
		// Codex's "Yes, clear context and implement" branch: fork the session
		// after approval and re-submit the approved plan as a fresh user
		// message. Default mode after fork; the user can switch later.
		decision: { behavior: "allow", scope: "once", nextMode: "default", forkAfterApproval: true },
	},
	{
		key: "4",
		label: "No, keep planning",
		hint: "revise the plan",
		decision: { behavior: "deny" },
	},
	{
		key: "5",
		label: "No, tell Neo",
		hint: "what to change in the plan",
		startsFeedback: true,
	},
];

function approvalOptions(request: ToolApprovalRequest): ApprovalOption[] {
	return request.toolName === "ExitPlanMode" ? EXIT_PLAN_MODE_APPROVAL_OPTIONS : defaultApprovalOptions(request);
}

function truncateVisible(input: string, max: number): string {
	if (visibleWidth(input) <= max) return input;
	let out = "";
	for (const char of input) {
		if (visibleWidth(`${out}${char}…`) > max) break;
		out += char;
	}
	return `${out}…`;
}

function padVisible(input: string, width: number): string {
	return input + " ".repeat(Math.max(0, width - visibleWidth(input)));
}

function isPrintableInput(input: string): boolean {
	return input.length === 1 && input.charCodeAt(0) >= 32;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function stringArg(args: unknown, ...names: string[]): string | undefined {
	const record = asRecord(args);
	if (!record) return undefined;
	for (const name of names) {
		const value = record[name];
		if (typeof value === "string") return value;
	}
	return undefined;
}

function arrayArg(args: unknown, name: string): unknown[] | undefined {
	const record = asRecord(args);
	const value = record?.[name];
	return Array.isArray(value) ? value : undefined;
}

function riskLabel(request: ToolApprovalRequest): string {
	if (request.toolName === "ExitPlanMode") return "plan approval";
	switch (request.risk) {
		case "command":
			return "command";
		case "write":
			return "file change";
		case "extension":
			return "extension tool";
		case "safe":
			return "read-only";
	}
}

function approvalTitle(request: ToolApprovalRequest): string {
	switch (request.toolName) {
		case "bash":
			return "Neo wants to run a command";
		case "edit":
			return "Neo wants to edit a file";
		case "write":
			return "Neo wants to write a file";
		case "read":
			return "Neo wants to read a file";
		case "grep":
			return "Neo wants to search files";
		case "find":
			return "Neo wants to find files";
		case "ls":
			return "Neo wants to list files";
		case "ExitPlanMode":
			return "Neo wants to exit plan mode";
		default:
			return `Neo wants to use ${request.toolName}`;
	}
}

function stateLine(state: ToolApprovalVisualState, decision?: ToolApprovalDecision): string {
	if (state === "allowed") {
		if (decision?.nextMode) return `✓ plan approved; next mode ${decision.nextMode}`;
		return decision?.scope === "session" ? "✓ allowed for this session" : "✓ allowed once";
	}
	if (state === "denied") {
		const feedback = decision?.feedback?.trim() || decision?.reason?.trim();
		return feedback ? `✕ denied — ${feedback}` : "✕ denied";
	}
	return "needs permission";
}

const APPROVAL_CARD_WIDTH = 78;
const APPROVAL_CONTENT_WIDTH = APPROVAL_CARD_WIDTH - 4;
const EXIT_PLAN_PREVIEW_LINES = 9;
const TOOL_PREVIEW_LINES = 12;
const TOOL_PREVIEW_SECTION_LINES = 5;

function renderTopBorder(title: string, borderColor: "accent" | "success" | "error"): string {
	const remaining = Math.max(1, APPROVAL_CARD_WIDTH - visibleWidth(`╭─ ${title} `) - 1);
	return theme.fg(borderColor, `╭─ ${title} ${"─".repeat(remaining)}╮`);
}

function renderLine(content: string): string {
	return `  ${truncateVisible(content, APPROVAL_CONTENT_WIDTH)}`;
}

function renderOption(
	option: ApprovalOption,
	index: number,
	selectedIndex: number,
	state: ToolApprovalVisualState,
): string {
	const selected = state === "pending" && index === selectedIndex;
	const marker = selected ? theme.fg("accent", "›") : " ";
	const key = selected ? theme.bold(option.key) : option.key;
	const label = selected ? theme.bold(option.label) : option.label;
	const line = truncateVisible(
		`${marker} ${key}. ${padVisible(label, 26)} ${theme.fg("dim", option.hint)}`,
		APPROVAL_CONTENT_WIDTH,
	);
	return renderLine(line);
}

function renderPlanPreview(request: ToolApprovalRequest): string[] {
	const plan = getExitPlanModePlan(request.args) ?? request.detail ?? request.summary;
	const planLines = plan.split("\n").map((line) => line.trimEnd());
	const visibleLines = planLines.slice(0, EXIT_PLAN_PREVIEW_LINES);
	const overflow = planLines.length - visibleLines.length;
	const lines = [
		renderLine(theme.fg("muted", "Here is Neo's plan:")),
		renderLine(theme.fg("muted", "┄".repeat(APPROVAL_CONTENT_WIDTH))),
	];
	for (const line of visibleLines) {
		lines.push(renderLine(line || " "));
	}
	if (overflow > 0) {
		lines.push(renderLine(theme.fg("dim", `… ${overflow} more lines; actions stay below`)));
	}
	lines.push(renderLine(theme.fg("muted", "┄".repeat(APPROVAL_CONTENT_WIDTH))));
	return lines;
}

function countDisplayLines(text: string): number {
	if (text.length === 0) return 0;
	const parts = text.split("\n");
	return text.endsWith("\n") ? parts.length - 1 : parts.length;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} bytes`;
	const kib = bytes / 1024;
	if (kib < 1024) return `${kib.toFixed(kib >= 10 ? 0 : 1)} KiB`;
	const mib = kib / 1024;
	return `${mib.toFixed(mib >= 10 ? 0 : 1)} MiB`;
}

function previewLinesFromText(text: string, maxLines: number): { lines: string[]; overflow: number; total: number } {
	const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	const rawLines = normalized.split("\n");
	const total = countDisplayLines(normalized);
	const lines = rawLines.slice(0, maxLines).map((line) => line.replace(/\t/g, "   "));
	if (normalized.endsWith("\n") && lines.length > total) lines.pop();
	return { lines, overflow: Math.max(0, total - lines.length), total };
}

function diffPreviewLines(text: string, marker: "+" | "-", maxLines: number): string[] {
	const preview = previewLinesFromText(text, maxLines);
	const color = marker === "+" ? "success" : "error";
	const lines = preview.lines.map((line) => theme.fg(color, `${marker} ${line.length > 0 ? line : " "}`));
	if (preview.overflow > 0) {
		lines.push(theme.fg("dim", `… ${preview.overflow} more line${preview.overflow === 1 ? "" : "s"}`));
	}
	return lines;
}

function renderPreviewFrame(title: string, bodyLines: string[]): string[] {
	const lines = [
		renderLine(theme.fg("muted", title)),
		renderLine(theme.fg("muted", "┄".repeat(APPROVAL_CONTENT_WIDTH))),
	];
	for (const line of bodyLines) {
		lines.push(renderLine(line || " "));
	}
	lines.push(renderLine(theme.fg("muted", "┄".repeat(APPROVAL_CONTENT_WIDTH))));
	return lines;
}

function renderWritePreview(request: ToolApprovalRequest): string[] | undefined {
	const content = stringArg(request.args, "content");
	if (content === undefined) return undefined;
	const filePath = stringArg(request.args, "path", "file_path", "filePath", "filename") ?? "file";
	const lineCount = countDisplayLines(content);
	const byteCount = Buffer.byteLength(content, "utf8");
	const body = [
		theme.bold(`write preview: ${lineCount} line${lineCount === 1 ? "" : "s"}, ${formatBytes(byteCount)}`),
		theme.fg("dim", `target: ${filePath}`),
		...diffPreviewLines(content, "+", TOOL_PREVIEW_LINES),
	];
	return renderPreviewFrame("Diff Neo wants to write:", body);
}

type ApprovalEdit = {
	oldText: string;
	newText: string;
};

function normalizeApprovalEdit(value: unknown): ApprovalEdit | undefined {
	const record = asRecord(value);
	if (!record) return undefined;
	const oldText =
		typeof record.oldText === "string"
			? record.oldText
			: typeof record.old_string === "string"
				? record.old_string
				: undefined;
	const newText =
		typeof record.newText === "string"
			? record.newText
			: typeof record.new_string === "string"
				? record.new_string
				: undefined;
	if (oldText === undefined || newText === undefined) return undefined;
	return { oldText, newText };
}

function getApprovalEdits(args: unknown): ApprovalEdit[] {
	const edits = arrayArg(args, "edits")
		?.map(normalizeApprovalEdit)
		.filter((edit) => edit !== undefined);
	if (edits && edits.length > 0) return edits;
	const oldText = stringArg(args, "oldText", "old_string");
	const newText = stringArg(args, "newText", "new_string");
	return oldText !== undefined && newText !== undefined ? [{ oldText, newText }] : [];
}

function renderEditDiffSection(label: string, text: string, marker: "+" | "-", maxLines: number): string[] {
	return [theme.fg("dim", label), ...diffPreviewLines(text || " ", marker, maxLines)];
}

function renderEditPreview(request: ToolApprovalRequest): string[] | undefined {
	const edits = getApprovalEdits(request.args);
	if (edits.length === 0) return undefined;
	const filePath = stringArg(request.args, "path", "file_path", "filePath", "filename") ?? "file";
	const firstEdit = edits[0]!;
	const createLike = firstEdit.oldText.length === 0;
	const body = [
		theme.bold(
			`${createLike ? "create" : "edit"} preview: ${edits.length} replacement${edits.length === 1 ? "" : "s"}`,
		),
		theme.fg("dim", `target: ${filePath}`),
	];
	if (createLike) {
		body.push(...renderEditDiffSection("new content:", firstEdit.newText, "+", TOOL_PREVIEW_LINES));
	} else {
		body.push(...renderEditDiffSection("remove:", firstEdit.oldText, "-", TOOL_PREVIEW_SECTION_LINES));
		body.push(...renderEditDiffSection("add:", firstEdit.newText, "+", TOOL_PREVIEW_SECTION_LINES));
	}
	if (edits.length > 1) {
		body.push(theme.fg("dim", `… ${edits.length - 1} more replacement${edits.length === 2 ? "" : "s"}`));
	}
	return renderPreviewFrame("Diff Neo wants to apply:", body);
}

function renderToolApprovalPreview(request: ToolApprovalRequest, state: ToolApprovalVisualState): string[] {
	if (state !== "pending") return [];
	if (request.toolName === "write") return renderWritePreview(request) ?? [];
	if (request.toolName === "edit") return renderEditPreview(request) ?? [];
	return [];
}

function renderLines(
	request: ToolApprovalRequest,
	state: ToolApprovalVisualState,
	decision: ToolApprovalDecision | undefined,
	selectedIndex: number,
	feedbackDraft: string,
	feedbackMode: boolean,
): string {
	const borderColor = state === "pending" ? "accent" : state === "allowed" ? "success" : "error";
	const isExitPlanMode = request.toolName === "ExitPlanMode";
	const title = isExitPlanMode && state === "pending" ? "Ready to code?" : approvalTitle(request);
	const header = renderTopBorder(title, borderColor);
	const badge =
		state === "pending"
			? theme.fg("accent", "PERMISSION")
			: state === "allowed"
				? theme.fg("success", "ALLOWED")
				: theme.fg("error", "DENIED");
	const summary = truncateVisible(request.summary, APPROVAL_CONTENT_WIDTH);
	const detail = request.detail ? truncateVisible(request.detail, APPROVAL_CONTENT_WIDTH) : undefined;
	const lines = [header, renderLine(`${badge} ${theme.fg("dim", `· ${riskLabel(request)} · ${request.mode} mode`)}`)];
	if (isExitPlanMode) {
		if (state === "pending") {
			lines.push(...renderPlanPreview(request));
			lines.push(renderLine(theme.fg("muted", "Neo has written up a plan and is ready to execute.")));
			lines.push(renderLine(theme.fg("muted", "Would you like to proceed?")));
		} else {
			lines.push(renderLine(theme.bold(summary)));
		}
	} else {
		lines.push(renderLine(theme.bold(summary)));
		if (detail) {
			lines.push(renderLine(theme.fg("dim", detail)));
		}
		const previewLines = renderToolApprovalPreview(request, state);
		if (previewLines.length > 0) {
			lines.push(...previewLines);
		}
	}
	if (state === "pending") {
		if (!isExitPlanMode) {
			lines.push(renderLine(theme.fg("muted", "Do you want to proceed?")));
		}
	} else {
		lines.push(renderLine(theme.fg(state === "allowed" ? "success" : "error", stateLine(state, decision))));
	}

	if (state === "pending") {
		lines.push(renderLine(""));
		if (feedbackMode) {
			const draft =
				feedbackDraft.length > 0
					? feedbackDraft
					: theme.fg("dim", isExitPlanMode ? "tell Neo what to change…" : "and tell Neo what to do differently…");
			const label = isExitPlanMode ? "Keep planning with feedback" : "No, and tell Neo";
			lines.push(renderLine(`${theme.bold(label)}: ${truncateVisible(draft, 56)}`));
			lines.push(renderLine(theme.fg("dim", "Type feedback · Enter submit · Esc back")));
		} else {
			const options = approvalOptions(request);
			for (let i = 0; i < options.length; i++) {
				lines.push(renderOption(options[i]!, i, selectedIndex, state));
			}
			lines.push(renderLine(""));
			lines.push(
				renderLine(
					theme.fg(
						"dim",
						isExitPlanMode
							? "Esc to cancel · ↑/↓ select · Enter confirm"
							: "Esc to deny · ↑/↓ select · Enter confirm",
					),
				),
			);
		}
	}
	return lines.join("\n");
}

export class ToolApprovalRequestComponent implements Component, Focusable {
	focused = false;
	private readonly text: Text;
	private state: ToolApprovalVisualState = "pending";
	private decision?: ToolApprovalDecision;
	private selectedIndex = 0;
	private feedbackMode = false;
	private feedbackDraft = "";

	constructor(
		private readonly request: ToolApprovalRequest,
		private readonly onDecision?: (decision: ToolApprovalDecision) => void,
	) {
		this.text = new Text(this.renderText(), 1, 0);
	}

	resolve(decision: ToolApprovalDecision): void {
		this.decision = decision;
		this.state = decision.behavior === "allow" ? "allowed" : "denied";
		this.feedbackMode = false;
		this.text.setText(this.renderText());
	}

	handleInput(input: string): void {
		if (this.state !== "pending") return;
		const keybindings = getKeybindings();

		if (this.feedbackMode) {
			if (keybindings.matches(input, "tui.select.cancel")) {
				this.feedbackMode = false;
				this.feedbackDraft = "";
				this.text.setText(this.renderText());
				return;
			}
			if (keybindings.matches(input, "tui.select.confirm")) {
				this.emitDecision({
					behavior: "deny",
					feedback: this.feedbackDraft.trim() || undefined,
				});
				return;
			}
			if (keybindings.matches(input, "tui.editor.deleteCharBackward")) {
				this.feedbackDraft = [...this.feedbackDraft].slice(0, -1).join("");
				this.text.setText(this.renderText());
				return;
			}
			if (isPrintableInput(input)) {
				this.feedbackDraft += input;
				this.text.setText(this.renderText());
			}
			return;
		}

		if (keybindings.matches(input, "tui.select.cancel")) {
			this.emitDecision({
				behavior: "deny",
				reason: "User cancelled permission prompt",
			});
			return;
		}
		if (keybindings.matches(input, "tui.select.up")) {
			const options = approvalOptions(this.request);
			this.selectedIndex = (this.selectedIndex + options.length - 1) % options.length;
			this.text.setText(this.renderText());
			return;
		}
		if (keybindings.matches(input, "tui.select.down")) {
			const options = approvalOptions(this.request);
			this.selectedIndex = (this.selectedIndex + 1) % options.length;
			this.text.setText(this.renderText());
			return;
		}
		if (keybindings.matches(input, "tui.select.confirm")) {
			this.choose(approvalOptions(this.request)[this.selectedIndex]!);
			return;
		}

		const quickOption = approvalOptions(this.request).find((option) => option.key === input.trim().toLowerCase());
		if (quickOption) {
			this.choose(quickOption);
			return;
		}

		const normalized = input.trim().toLowerCase();
		if (["y", "yes", "allow", "ok", "approve"].includes(normalized)) {
			this.emitDecision({ behavior: "allow", scope: "once" });
			return;
		}
		if (["a", "always", "session"].includes(normalized)) {
			this.emitDecision({ behavior: "allow", scope: "session" });
			return;
		}
		if (["n", "no", "deny", "reject"].includes(normalized)) {
			this.emitDecision({ behavior: "deny" });
		}
	}

	invalidate(): void {
		this.text.invalidate();
	}

	render(width: number): string[] {
		return this.text.render(width);
	}

	private choose(option: ApprovalOption): void {
		if (option.startsFeedback) {
			this.feedbackMode = true;
			this.feedbackDraft = "";
			this.text.setText(this.renderText());
			return;
		}
		if (option.decision) {
			this.emitDecision(option.decision);
		}
	}

	private emitDecision(decision: ToolApprovalDecision): void {
		this.onDecision?.(decision);
	}

	private renderText(): string {
		return renderLines(
			this.request,
			this.state,
			this.decision,
			this.selectedIndex,
			this.feedbackDraft,
			this.feedbackMode,
		);
	}
}
