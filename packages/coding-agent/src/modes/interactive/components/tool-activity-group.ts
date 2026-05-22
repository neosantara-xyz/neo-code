import { Container, Spacer, Text, type TUI, visibleWidth } from "@neosantara/tui";
import {
	canMergeToolIntoActivityGroup,
	formatToolActivityGroup,
	summarizeToolCall,
	type ToolActivityGroupItem,
	type ToolActivityKind,
	type ToolActivityKindCounts,
} from "../../../core/tools/tool-activity.js";
import { type ThemeColor, theme } from "../theme/theme.js";
import { keyHint } from "./keybinding-hints.js";
import type { ToolExecutionComponent } from "./tool-execution.js";

interface ToolActivityGroupEntry extends ToolActivityGroupItem {
	component: ToolExecutionComponent;
}

interface ToolActivityGroupOptions {
	requestRender?: () => void;
	ui?: TUI;
	gradualReveal?: boolean;
	revealDelayMs?: number;
}

const MIN_HINT_DISPLAY_MS = 700;
const DEFAULT_TOOL_REVEAL_DELAY_MS = 500;

const graphemeSegmenter =
	typeof Intl !== "undefined" && "Segmenter" in Intl
		? new Intl.Segmenter(undefined, { granularity: "grapheme" })
		: undefined;

function splitGraphemes(text: string): string[] {
	if (!graphemeSegmenter) return Array.from(text);
	return Array.from(graphemeSegmenter.segment(text), (segment) => segment.segment);
}

export class ToolActivityGroupComponent extends Container {
	private readonly summaryText: Text;
	private readonly rawContainer = new Container();
	private readonly items = new Map<string, ToolActivityGroupEntry>();
	private readonly visibleToolIds = new Set<string>();
	private readonly revealQueue: string[] = [];
	private readonly requestRender?: () => void;
	private readonly gradualReveal: boolean;
	private readonly revealDelayMs: number;
	private expanded = false;
	private showImages = true;
	private imageWidthCells = 60;
	private shimmerTimer: NodeJS.Timeout | undefined;
	private shimmerTick = 0;
	private animationPaused = false;
	private readonly maxCounts = new Map<ToolActivityKind, number>();
	private displayedSummary: string | undefined;
	private pendingSummary: string | undefined;
	private lastSummaryChangeAt = 0;
	private hintHoldTimer: NodeJS.Timeout | undefined;
	private revealTimer: NodeJS.Timeout | undefined;

	constructor(expanded = false, options: ToolActivityGroupOptions = {}) {
		super();
		this.expanded = expanded;
		this.requestRender = options.requestRender ?? (options.ui ? () => options.ui?.requestRender() : undefined);
		this.gradualReveal = options.gradualReveal ?? false;
		this.revealDelayMs = Math.max(0, options.revealDelayMs ?? DEFAULT_TOOL_REVEAL_DELAY_MS);
		this.summaryText = new Text("", 1, 0);
		this.updateDisplay();
	}

	canAcceptTool(toolName: string, args: any): boolean {
		const snapshots = Array.from(this.items.values()).map((item) => ({
			id: item.id,
			toolName: item.toolName,
			args: item.args,
			result: item.result,
			isError: item.isError,
			isPartial: item.isPartial,
			executionStarted: item.executionStarted,
		}));
		return canMergeToolIntoActivityGroup(snapshots, toolName, args);
	}

	addTool(toolName: string, toolCallId: string, args: any, component: ToolExecutionComponent): void {
		const existing = this.items.get(toolCallId);
		if (existing) {
			existing.args = args;
			if (existing.component !== component) {
				if (this.visibleToolIds.has(toolCallId)) {
					this.rawContainer.removeChild(existing.component);
				}
				existing.component = component;
				this.attachVisibleComponent(existing);
			}
		} else {
			component.setExpanded(this.expanded);
			component.setShowImages(this.showImages);
			component.setImageWidthCells(this.imageWidthCells);
			this.items.set(toolCallId, {
				id: toolCallId,
				toolName,
				args,
				component,
				isPartial: true,
			});
			this.queueToolReveal(toolCallId);
		}
		this.updateDisplay();
	}

	private attachVisibleComponent(item: ToolActivityGroupEntry): void {
		if (!this.visibleToolIds.has(item.id)) return;
		if (!this.rawContainer.children.includes(item.component)) {
			this.rawContainer.addChild(item.component);
		}
	}

	private revealTool(toolCallId: string): boolean {
		const item = this.items.get(toolCallId);
		if (!item || this.visibleToolIds.has(toolCallId)) return false;
		this.visibleToolIds.add(toolCallId);
		this.attachVisibleComponent(item);
		return true;
	}

	private queueToolReveal(toolCallId: string): void {
		if (!this.gradualReveal || this.expanded || this.visibleToolIds.size === 0) {
			this.revealTool(toolCallId);
			return;
		}

		if (this.visibleToolIds.has(toolCallId) || this.revealQueue.includes(toolCallId)) return;
		this.revealQueue.push(toolCallId);
		this.syncRevealTimer();
	}

	private revealQueuedTools(): boolean {
		let changed = false;
		while (this.revealQueue.length > 0) {
			const toolCallId = this.revealQueue.shift();
			if (toolCallId && this.revealTool(toolCallId)) {
				changed = true;
			}
		}
		if (changed) this.clearRevealTimer();
		return changed;
	}

	private clearRevealTimer(): void {
		if (!this.revealTimer) return;
		clearTimeout(this.revealTimer);
		this.revealTimer = undefined;
	}

	private syncRevealTimer(): void {
		if (!this.gradualReveal || this.animationPaused || this.revealQueue.length === 0 || this.revealTimer) return;
		this.revealTimer = setTimeout(() => {
			this.revealTimer = undefined;
			const nextToolCallId = this.revealQueue.shift();
			if (nextToolCallId && this.revealTool(nextToolCallId)) {
				this.updateDisplay();
				this.requestRender?.();
			}
			this.syncRevealTimer();
		}, this.revealDelayMs);
		this.revealTimer.unref?.();
	}

	updateToolArgs(toolCallId: string, args: any): void {
		const item = this.items.get(toolCallId);
		if (!item) return;
		item.args = args;
		item.component.updateArgs(args);
		this.updateDisplay();
	}

	markExecutionStarted(toolCallId: string): void {
		const item = this.items.get(toolCallId);
		if (!item) return;
		item.executionStarted = true;
		item.isPartial = true;
		item.component.markExecutionStarted();
		this.updateDisplay();
	}

	updateToolResult(
		toolCallId: string,
		result: {
			content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
			details?: any;
			isError: boolean;
		},
		isPartial = false,
	): void {
		const item = this.items.get(toolCallId);
		if (!item) return;
		item.result = result;
		item.isError = result.isError;
		item.isPartial = isPartial;
		item.component.updateResult(result, isPartial);
		this.updateDisplay();
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
		if (expanded) {
			this.revealQueuedTools();
		} else {
			this.syncRevealTimer();
		}
		for (const item of this.items.values()) {
			item.component.setExpanded(expanded);
		}
		this.updateDisplay();
	}

	setShowImages(show: boolean): void {
		this.showImages = show;
		for (const item of this.items.values()) {
			item.component.setShowImages(show);
		}
	}

	setImageWidthCells(width: number): void {
		this.imageWidthCells = width;
		for (const item of this.items.values()) {
			item.component.setImageWidthCells(width);
		}
	}

	setAnimationPaused(paused: boolean): void {
		if (this.animationPaused === paused) return;
		this.animationPaused = paused;
		if (paused) {
			this.clearRevealTimer();
		} else {
			this.syncRevealTimer();
		}
		this.syncShimmerTimer();
		this.updateDisplay();
	}

	private hasRunningItems(): boolean {
		return Array.from(this.items.values()).some((item) => !item.result || item.isPartial === true);
	}

	private hasForegroundShellRunning(): boolean {
		return Array.from(this.items.values()).some(
			(item) => item.toolName === "bash" && (!item.result || item.isPartial === true),
		);
	}

	private syncShimmerTimer(): void {
		const shouldAnimate = this.hasRunningItems() && !this.animationPaused;
		if (shouldAnimate && !this.shimmerTimer) {
			this.shimmerTimer = setInterval(() => {
				this.shimmerTick += 1;
				this.updateDisplay();
				this.requestRender?.();
			}, 180);
			this.shimmerTimer.unref?.();
			return;
		}
		if (!shouldAnimate && this.shimmerTimer) {
			clearInterval(this.shimmerTimer);
			this.shimmerTimer = undefined;
			this.shimmerTick = 0;
		}
	}

	private clearHintHoldTimer(): void {
		if (!this.hintHoldTimer) return;
		clearTimeout(this.hintHoldTimer);
		this.hintHoldTimer = undefined;
	}

	private updateMaxCounts(items: ToolActivityGroupItem[]): void {
		for (const item of items) {
			const kind = summarizeToolCall(item.toolName, item.args).kind;
			this.maxCounts.set(kind, Math.max(this.maxCounts.get(kind) ?? 0, 1));
		}

		const currentCounts = new Map<ToolActivityKind, number>();
		for (const item of items) {
			const kind = summarizeToolCall(item.toolName, item.args).kind;
			currentCounts.set(kind, (currentCounts.get(kind) ?? 0) + 1);
		}
		for (const [kind, count] of currentCounts) {
			this.maxCounts.set(kind, Math.max(this.maxCounts.get(kind) ?? 0, count));
		}
	}

	private getMinimumCounts(): ToolActivityKindCounts {
		const counts: ToolActivityKindCounts = {};
		for (const [kind, count] of this.maxCounts) {
			counts[kind] = count;
		}
		return counts;
	}

	private commitDisplayedSummary(summary: string): string {
		if (this.displayedSummary !== summary) {
			this.displayedSummary = summary;
			this.lastSummaryChangeAt = Date.now();
		}
		this.pendingSummary = undefined;
		this.clearHintHoldTimer();
		return summary;
	}

	private schedulePendingSummary(delayMs: number): void {
		if (this.hintHoldTimer) return;
		this.hintHoldTimer = setTimeout(() => {
			this.hintHoldTimer = undefined;
			const pending = this.pendingSummary;
			if (!pending) return;
			this.displayedSummary = pending;
			this.pendingSummary = undefined;
			this.lastSummaryChangeAt = Date.now();
			this.updateDisplay();
			this.requestRender?.();
		}, delayMs);
		this.hintHoldTimer.unref?.();
	}

	private applyHintHold(summary: string, hasRunningItems: boolean): string {
		if (!this.displayedSummary || this.displayedSummary === "✦ Working") return this.commitDisplayedSummary(summary);
		if (summary === this.displayedSummary) return summary;

		// Commit immediately when tree structure grows (new items revealed) so
		// the user sees progress. Only hold when the structure is stable but
		// labels/counts are updating (avoids jarring rapid count flickers).
		const newLineCount = summary.split("\n").length;
		const oldLineCount = this.displayedSummary.split("\n").length;
		if (newLineCount !== oldLineCount) return this.commitDisplayedSummary(summary);

		// Also commit immediately if the "Current" activity line changed
		const currentLine = summary.split("\n").find((l) => l.includes("└─ Current") || l.includes("⠋"));
		const prevCurrentLine = this.displayedSummary
			.split("\n")
			.find((l) => l.includes("└─ Current") || l.includes("⠋"));
		if (currentLine && currentLine !== prevCurrentLine) return this.commitDisplayedSummary(summary);

		if (this.animationPaused) {
			this.pendingSummary = summary;
			return this.displayedSummary;
		}
		if (!hasRunningItems) return this.commitDisplayedSummary(summary);

		const elapsed = Date.now() - this.lastSummaryChangeAt;
		if (elapsed >= MIN_HINT_DISPLAY_MS) return this.commitDisplayedSummary(summary);

		this.pendingSummary = summary;
		this.schedulePendingSummary(MIN_HINT_DISPLAY_MS - elapsed);
		return this.displayedSummary;
	}

	private shimmerLine(line: string, baseColor: ThemeColor, shimmerColor: ThemeColor): string {
		if (!line || line.trim() === "") return theme.fg(baseColor, line);
		const width = visibleWidth(line);
		const cycle = Math.max(1, width + 20);
		const center = width + 10 - (this.shimmerTick % cycle);
		const start = center - 1;
		const end = center + 1;
		let rendered = "";
		let column = 0;
		for (const segment of splitGraphemes(line)) {
			const segmentWidth = visibleWidth(segment);
			const color = column <= end && column + segmentWidth > start ? shimmerColor : baseColor;
			rendered += theme.fg(color, segment);
			column += segmentWidth;
		}
		return rendered;
	}

	private updateDisplay(): void {
		this.syncShimmerTimer();
		this.clear();
		this.addChild(new Spacer(1));
		this.summaryText.setText(this.formatSummary());
		this.addChild(this.summaryText);
		if (this.expanded) {
			this.addChild(this.rawContainer);
		}
	}

	dispose(): void {
		if (this.shimmerTimer) {
			clearInterval(this.shimmerTimer);
			this.shimmerTimer = undefined;
		}
		this.clearHintHoldTimer();
		this.clearRevealTimer();
	}

	private visibleItems(): ToolActivityGroupEntry[] {
		return Array.from(this.items.values()).filter((item) => this.visibleToolIds.has(item.id));
	}

	private formatSummary(): string {
		const snapshots = this.visibleItems().map((item) => ({
			id: item.id,
			toolName: item.toolName,
			args: item.args,
			result: item.result,
			isError: item.isError,
			isPartial: item.isPartial,
			executionStarted: item.executionStarted,
		}));
		this.updateMaxCounts(snapshots);
		const hasRunningItems = this.hasRunningItems();
		const base = this.applyHintHold(
			formatToolActivityGroup(snapshots, { minimumCounts: this.getMinimumCounts() }),
			hasRunningItems,
		);
		const shouldShimmer = hasRunningItems && !this.animationPaused;
		const coloredLines = base.split("\n").map((line, index) => {
			if (index === 0) {
				return hasRunningItems ? theme.fg("muted", theme.bold(line)) : theme.fg("accent", theme.bold(line));
			}
			if (line.includes("✗")) return theme.fg("error", line);
			const trimmed = line.trimStart();
			if (
				trimmed.startsWith("├─") ||
				trimmed.startsWith("└─") ||
				trimmed.startsWith("│") ||
				trimmed.startsWith("⠋") ||
				trimmed.startsWith("⎿")
			) {
				return shouldShimmer ? this.shimmerLine(line, "muted", "accent") : theme.fg("dim", line);
			}
			return theme.fg("muted", line);
		});
		if (!this.expanded && hasRunningItems) {
			const expandHint = this.animationPaused
				? "    Review details in permission card"
				: this.hasForegroundShellRunning()
					? `    ${keyHint("app.tools.expand", "expand live output")} · ${keyHint("app.task.background", "background")}`
					: `    ${keyHint("app.tools.expand", "expand live tool output")}`;
			coloredLines.push(expandHint);
		} else if (!this.expanded && !hasRunningItems && snapshots.length > 1) {
			coloredLines.push(`    ${keyHint("app.tools.expand", "expand output")}`);
		}
		return coloredLines.join("\n");
	}
}
