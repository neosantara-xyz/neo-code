import { Container, Spacer, Text, type TUI, visibleWidth } from "@neosantara/tui";
import {
	buildToolActivityGroupRender as buildRender,
	canMergeToolIntoActivityGroup,
	DEFAULT_TOOL_ACTIVITY_ICONS,
	formatToolActivityGroup,
	summarizeToolCall,
	type ToolActivityGroupFormatOptions,
	type ToolActivityGroupItem,
	type ToolActivityGroupRender,
	type ToolActivityKind,
	type ToolActivityKindCounts,
	type ToolActivityRow,
	type ToolActivityRowState,
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
	/**
	 * Optional per-kind icons. Pass `DEFAULT_TOOL_ACTIVITY_ICONS` (re-exported
	 * from `core/tools/tool-activity`) to enable the default opinionated set,
	 * or a partial map to override individual kinds. When omitted, branches
	 * render without icons to preserve the legacy compact layout.
	 */
	icons?: Partial<Record<ToolActivityKind, string>>;
}

const MIN_HINT_DISPLAY_MS = 450;
const DEFAULT_TOOL_REVEAL_DELAY_MS = 120;
const SHIMMER_FRAME_MS = 50;
const SHIMMER_SWEEP_MS = 1400;
const SHIMMER_TRAIL_PADDING = 20;
const SHIMMER_BAND_HALF_WIDTH = 6;

/**
 * Width thresholds for responsive tree layout. Mirrors the footer's compact
 * threshold so narrow Termux/SSH sessions get a coherent compact UI.
 *
 * - >= TIGHT_TREE_WIDTH (50) ... < COMPACT_TREE_WIDTH (72): drop file detail rows.
 * - < TIGHT_TREE_WIDTH (50): collapse to a single summary line.
 */
export const COMPACT_TREE_WIDTH = 72;
export const TIGHT_TREE_WIDTH = 50;

const graphemeSegmenter =
	typeof Intl !== "undefined" && "Segmenter" in Intl
		? new Intl.Segmenter(undefined, { granularity: "grapheme" })
		: undefined;

function splitGraphemes(text: string): string[] {
	if (!graphemeSegmenter) return Array.from(text);
	return Array.from(graphemeSegmenter.segment(text), (segment) => segment.segment);
}

/**
 * Cache key wrapper so we only rebuild the structured tree when snapshots,
 * minimum counts, or the chosen layout actually change. Shimmer ticks reuse
 * the cached render and only recolor.
 */
interface CachedRender {
	signature: string;
	render: ToolActivityGroupRender;
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
	private shimmerStartMs = Date.now();
	private animationPaused = false;
	private readonly maxCounts = new Map<ToolActivityKind, number>();
	private displayedSummary: string | undefined;
	private pendingSummary: string | undefined;
	private lastSummaryChangeAt = 0;
	private hintHoldTimer: NodeJS.Timeout | undefined;
	private revealTimer: NodeJS.Timeout | undefined;
	private cachedRender: CachedRender | undefined;
	private lastRenderWidth: number | undefined;
	private currentLayout: "full" | "compact" | "tight" = "full";
	private readonly icons: Partial<Record<ToolActivityKind, string>> | undefined;
	private streaming = false;

	constructor(expanded = false, options: ToolActivityGroupOptions = {}) {
		super();
		this.expanded = expanded;
		this.requestRender = options.requestRender ?? (options.ui ? () => options.ui?.requestRender() : undefined);
		this.gradualReveal = options.gradualReveal ?? false;
		this.revealDelayMs = Math.max(0, options.revealDelayMs ?? DEFAULT_TOOL_REVEAL_DELAY_MS);
		this.icons = options.icons;
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

	getItems(): Array<{
		id: string;
		toolName: string;
		args: any;
		result?: { content?: Array<{ type: string; text?: string }>; details?: unknown };
		isPartial?: boolean;
	}> {
		return Array.from(this.items.values()).map((item) => ({
			id: item.id,
			toolName: item.toolName,
			args: item.args,
			result: item.result,
			isPartial: item.isPartial,
		}));
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
		this.invalidateCache();
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
				this.invalidateCache();
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
		this.invalidateCache();
		this.updateDisplay();
	}

	markExecutionStarted(toolCallId: string): void {
		const item = this.items.get(toolCallId);
		if (!item) return;
		item.executionStarted = true;
		item.isPartial = true;
		item.component.markExecutionStarted();
		this.invalidateCache();
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
		this.invalidateCache();
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
		this.invalidateCache();
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

	setStreaming(streaming: boolean): void {
		if (this.streaming === streaming) return;
		this.streaming = streaming;
		this.invalidateCache();
		this.syncShimmerTimer();
		this.updateDisplay();
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
		const shouldAnimate = (this.hasRunningItems() || this.streaming) && !this.animationPaused;
		if (shouldAnimate && !this.shimmerTimer) {
			this.shimmerStartMs = Date.now();
			this.shimmerTimer = setInterval(() => {
				this.updateDisplay();
				this.requestRender?.();
			}, SHIMMER_FRAME_MS);
			this.shimmerTimer.unref?.();
			return;
		}
		if (!shouldAnimate && this.shimmerTimer) {
			clearInterval(this.shimmerTimer);
			this.shimmerTimer = undefined;
		}
	}

	private clearHintHoldTimer(): void {
		if (!this.hintHoldTimer) return;
		clearTimeout(this.hintHoldTimer);
		this.hintHoldTimer = undefined;
	}

	private invalidateCache(): void {
		this.cachedRender = undefined;
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
		if (!this.displayedSummary || this.displayedSummary === "◐ Working" || this.displayedSummary === "✦ Working")
			return this.commitDisplayedSummary(summary);
		if (summary === this.displayedSummary) return summary;

		// Commit immediately when the tree structure grows so the user sees
		// progress. Only hold when structure is stable but counts/labels flicker.
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
		const travelWidth = Math.max(1, width + SHIMMER_TRAIL_PADDING);
		const elapsed = Math.max(0, Date.now() - this.shimmerStartMs);
		const phase = (elapsed % SHIMMER_SWEEP_MS) / SHIMMER_SWEEP_MS;
		const center = width + SHIMMER_TRAIL_PADDING / 2 - phase * travelWidth;
		let rendered = "";
		let column = 0;
		for (const segment of splitGraphemes(line)) {
			const segmentWidth = visibleWidth(segment);
			const segmentCenter = column + segmentWidth / 2;
			const distance = Math.abs(segmentCenter - center);
			if (distance <= 1) {
				rendered += theme.bold(theme.fg(shimmerColor, segment));
			} else if (distance <= SHIMMER_BAND_HALF_WIDTH) {
				// Gradient: inner band is shimmer color, outer fades to base
				const intensity = 1 - distance / SHIMMER_BAND_HALF_WIDTH;
				const color = intensity > 0.5 ? shimmerColor : baseColor;
				rendered += intensity > 0.5 ? theme.fg(color, segment) : theme.fg(color, segment);
			} else {
				rendered += theme.fg(baseColor, segment);
			}
			column += segmentWidth;
		}
		return rendered;
	}

	private toneForRow(row: ToolActivityRow): { base: ThemeColor; animated: boolean } {
		switch (row.state) {
			case "error":
				return { base: "error", animated: false };
			case "running":
				return { base: "muted", animated: true };
			case "neutral":
				return { base: "muted", animated: false };
			default:
				return { base: "dim", animated: false };
		}
	}

	private layoutForWidth(width: number): "full" | "compact" | "tight" {
		if (width > 0 && width < TIGHT_TREE_WIDTH) return "tight";
		if (width > 0 && width < COMPACT_TREE_WIDTH) return "compact";
		return "full";
	}

	/**
	 * Build (or reuse) the structured render. Cache key is the formatter's
	 * signature; shimmer ticks reuse the cached render and only recolor.
	 */
	private getRender(layout: "full" | "compact" | "tight"): ToolActivityGroupRender {
		const visibleItems = this.visibleItems().map((item) => ({
			id: item.id,
			toolName: item.toolName,
			args: item.args,
			result: item.result,
			isError: item.isError,
			isPartial: item.isPartial,
			executionStarted: item.executionStarted,
		}));
		this.updateMaxCounts(visibleItems);

		const formatOptions: ToolActivityGroupFormatOptions = {
			minimumCounts: this.getMinimumCounts(),
			layout,
			inlineSingleTool: layout !== "tight",
			icons: this.icons,
			forceRunning: this.streaming,
		};

		const probe = buildRender(visibleItems, formatOptions);
		if (this.cachedRender && this.cachedRender.signature === probe.signature) {
			return this.cachedRender.render;
		}
		this.cachedRender = { signature: probe.signature, render: probe };
		return probe;
	}

	private updateDisplay(): void {
		this.syncShimmerTimer();
		this.clear();
		this.addChild(new Spacer(1));
		this.summaryText.setText(this.formatSummary(this.lastRenderWidth));
		this.addChild(this.summaryText);
		if (this.expanded) {
			this.addChild(this.rawContainer);
		}
	}

	render(width: number): string[] {
		const layout = this.layoutForWidth(width);
		if (layout !== this.currentLayout || this.lastRenderWidth !== width) {
			this.currentLayout = layout;
			this.lastRenderWidth = width;
			this.invalidateCache();
			this.summaryText.setText(this.formatSummary(width));
		}
		return super.render(width);
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

	private formatSummary(width?: number): string {
		const layout = this.currentLayout ?? this.layoutForWidth(width ?? 0);
		const render = this.getRender(layout);
		const baseLines: string[] = [];
		if (render.header) baseLines.push(render.header.text);
		for (const row of render.rows) baseLines.push(row.text);
		const baseText = baseLines.join("\n");
		const hasRunningItems = render.hasRunningItems;
		const heldText = this.applyHintHold(baseText, hasRunningItems);
		const heldLines = heldText.split("\n");
		const shouldShimmer = hasRunningItems && !this.animationPaused;

		// If hint-hold returned the previous string (different snapshot), we
		// can't map to structured rows anymore; fall back to legacy coloring.
		if (heldText !== baseText) {
			return this.colorLegacyLines(heldLines, hasRunningItems, shouldShimmer);
		}

		const coloredLines: string[] = [];
		let rowIndex = 0;
		for (const line of heldLines) {
			if (rowIndex === 0 && render.header) {
				coloredLines.push(this.renderHeaderLine(render.header.text, render.header.state, shouldShimmer));
				rowIndex++;
				continue;
			}
			const row = render.rows[rowIndex - (render.header ? 1 : 0)];
			if (!row) {
				coloredLines.push(theme.fg("muted", line));
				rowIndex++;
				continue;
			}
			coloredLines.push(this.renderStructuredRow(row, line, shouldShimmer));
			rowIndex++;
		}

		this.appendBottomHint(coloredLines, hasRunningItems, render.rows.length + (render.header ? 1 : 0));
		return coloredLines.join("\n");
	}

	private renderHeaderLine(line: string, state: ToolActivityRowState, shouldShimmer: boolean): string {
		if (state === "error") return theme.fg("error", theme.bold(line));
		if (state === "running" && shouldShimmer) return this.shimmerLine(line, "dim", "accent");
		return theme.fg("accent", theme.bold(line));
	}

	private renderStructuredRow(row: ToolActivityRow, line: string, shouldShimmer: boolean): string {
		if (row.state === "error" || row.text.includes("✗")) return theme.fg("error", line);
		const { base, animated } = this.toneForRow(row);
		// Single-tool action rows behave like a header inside their own row:
		// they keep solid accent coloring when done so users immediately see
		// completion, and shimmer when running.
		if (row.kind === "single-action") {
			if (row.state === "running" && shouldShimmer) return this.shimmerLine(line, "muted", "accent");
			return theme.fg("accent", theme.bold(line));
		}
		// Running branches shimmer to show active work
		if (animated && shouldShimmer) return this.shimmerLine(line, base, "accent");
		// Completed branches use accent color for tree connectors to show progress
		if (row.state === "done" && (row.kind === "branch" || row.kind === "detail")) {
			return theme.fg("dim", line);
		}
		return theme.fg(base, line);
	}

	private colorLegacyLines(lines: string[], hasRunningItems: boolean, shouldShimmer: boolean): string {
		// Used when hint-hold serves a stale string that no longer matches the
		// current snapshot. Falls back to prefix-based coloring (best effort).
		const colored = lines.map((line, index) => {
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
		this.appendBottomHint(colored, hasRunningItems, lines.length);
		return colored.join("\n");
	}

	private appendBottomHint(lines: string[], hasRunningItems: boolean, rowCount: number): void {
		if (this.expanded) return;
		if (hasRunningItems) {
			const hint = this.animationPaused
				? "    Review details in permission card"
				: this.hasForegroundShellRunning()
					? `    ${keyHint("app.transcript.view", "view live output")} · ${keyHint("app.task.background", "background")}`
					: `    ${keyHint("app.transcript.view", "view live tool output")}`;
			lines.push(hint);
		} else if (rowCount > 1) {
			lines.push(`    ${keyHint("app.transcript.view", "view output")}`);
		}
	}
}

// Re-exports retained for transition compatibility (imports from older paths).
export { DEFAULT_TOOL_ACTIVITY_ICONS, formatToolActivityGroup };
export type { ToolActivityRow, ToolActivityRowState, ToolActivityGroupRender };
export type { buildToolActivityGroupRender as BuildToolActivityGroupRenderFn } from "../../../core/tools/tool-activity.js";
