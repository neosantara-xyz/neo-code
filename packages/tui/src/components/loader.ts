import type { TUI } from "../tui.js";
import { getSegmenter, truncateToWidth, visibleWidth } from "../utils.js";
import { Text } from "./text.js";

export type LoaderMessageMode = "responding" | "requesting" | "tool-input" | "tool-use";
export type LoaderShimmerDirection = "left-to-right" | "right-to-left";

export interface LoaderIndicatorOptions {
	/** Animation frames. Use an empty array to hide the indicator. */
	frames?: string[];
	/** Frame interval in milliseconds for animated indicators. */
	intervalMs?: number;
	/** Add a Claude Code-style glimmer sweep across the message text. */
	shimmer?: boolean;
	/** Direction of the glimmer sweep. Claude Code uses right-to-left while responding/tool-use, left-to-right while requesting/tool-input. */
	shimmerDirection?: LoaderShimmerDirection;
	/** Frame interval in milliseconds for the glimmer sweep. */
	shimmerIntervalMs?: number;
	/** Number of terminal cells highlighted by the glimmer sweep. */
	shimmerWidth?: number;
	/** Color used for the glimmer segment. Falls back to the message color when omitted. */
	shimmerColorFn?: (str: string) => string;
	/** Maximum visible cells used for the message before coloring. Prevents long rotating labels from wrapping. */
	maxMessageWidth?: number;
	/** Claude Code-like message mode. Tool-use pulses the whole message; responding/tool-input/requesting use travelling glimmer when enabled. */
	mode?: LoaderMessageMode;
	/** Fade the indicator/message toward warning/error when no stream progress arrives and no tools are active. */
	stalledDetection?: boolean;
	/** Milliseconds with no progress before stalled coloring starts. Defaults to 3000ms. */
	stalledAfterMs?: number;
	/** Milliseconds used to fade from normal to stalled. Defaults to 2000ms. */
	stalledFadeMs?: number;
	/** Warning color used while stall intensity is still low. */
	stalledWarningColorFn?: (str: string) => string;
	/** Final stalled color. */
	stalledColorFn?: (str: string) => string;
	/** Show a Claude Code-style byline after the loader message, e.g. elapsed time and streamed output tokens. */
	showStatus?: boolean;
	/** Milliseconds before elapsed time is shown. Defaults to 30000ms. */
	elapsedAfterMs?: number;
	/** Milliseconds before output token estimate is shown. Defaults to 30000ms. */
	tokensAfterMs?: number;
	/** Color used for the status byline. Falls back to the message color when omitted. */
	statusColorFn?: (str: string) => string;
}

const GLYPH_CHARS = ["·", "✢", "✳", "✶", "✻", "✽"];
const DEFAULT_FRAMES = [...GLYPH_CHARS, ...[...GLYPH_CHARS].reverse()];
const DEFAULT_INTERVAL_MS = 80;
const DEFAULT_SHIMMER_INTERVAL_MS = 60;
const DEFAULT_SHIMMER_WIDTH = 3;
const SHIMMER_TRAIL_PADDING = 20;
const DEFAULT_STALLED_AFTER_MS = 3000;
const DEFAULT_STALLED_FADE_MS = 2000;
const DEFAULT_STATUS_AFTER_MS = 30_000;
const ESTIMATED_CHARS_PER_TOKEN = 4;
const STALLED_WARNING_THRESHOLD = 0.2;
const STALLED_ERROR_THRESHOLD = 0.66;

interface MessageSegment {
	segment: string;
	width: number;
}

/**
 * Loader component that updates with an optional spinning animation.
 */
export class Loader extends Text {
	private frames = [...DEFAULT_FRAMES];
	private intervalMs = DEFAULT_INTERVAL_MS;
	private intervalId: NodeJS.Timeout | null = null;
	private ui: TUI | null = null;
	private renderIndicatorVerbatim = false;
	private shimmer = false;
	private shimmerDirection: LoaderShimmerDirection = "right-to-left";
	private shimmerIntervalMs = DEFAULT_SHIMMER_INTERVAL_MS;
	private shimmerWidth = DEFAULT_SHIMMER_WIDTH;
	private shimmerColorFn: ((str: string) => string) | undefined;
	private maxMessageWidth: number | undefined;
	private mode: LoaderMessageMode = "responding";
	private animationStartMs = Date.now();
	private stalledDetection = false;
	private stalledAfterMs = DEFAULT_STALLED_AFTER_MS;
	private stalledFadeMs = DEFAULT_STALLED_FADE_MS;
	private stalledWarningColorFn: ((str: string) => string) | undefined;
	private stalledColorFn: ((str: string) => string) | undefined;
	private showStatus = false;
	private elapsedAfterMs = DEFAULT_STATUS_AFTER_MS;
	private tokensAfterMs = DEFAULT_STATUS_AFTER_MS;
	private statusColorFn: ((str: string) => string) | undefined;
	private lastProgressValue = 0;
	private lastProgressAtMs = Date.now();
	private hasActiveTools = false;

	constructor(
		ui: TUI,
		private spinnerColorFn: (str: string) => string,
		private messageColorFn: (str: string) => string,
		private message: string = "Loading...",
		indicator?: LoaderIndicatorOptions,
	) {
		super("", 1, 0);
		this.ui = ui;
		this.setIndicator(indicator);
	}

	render(width: number): string[] {
		return ["", ...super.render(width)];
	}

	start(): void {
		this.updateDisplay();
		this.restartAnimation();
	}

	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	setMessage(message: string, indicator?: LoaderIndicatorOptions): void {
		this.message = message;
		if (indicator) {
			this.setIndicator(indicator);
			return;
		}
		this.updateDisplay();
	}

	setIndicator(indicator?: LoaderIndicatorOptions): void {
		this.renderIndicatorVerbatim = indicator?.frames !== undefined;
		this.frames = indicator?.frames !== undefined ? [...indicator.frames] : [...DEFAULT_FRAMES];
		this.intervalMs = indicator?.intervalMs && indicator.intervalMs > 0 ? indicator.intervalMs : DEFAULT_INTERVAL_MS;
		this.shimmer = indicator?.shimmer ?? false;
		this.shimmerDirection =
			indicator?.shimmerDirection ??
			(indicator?.mode === "requesting" || indicator?.mode === "tool-input" ? "left-to-right" : "right-to-left");
		this.shimmerIntervalMs =
			indicator?.shimmerIntervalMs && indicator.shimmerIntervalMs > 0
				? indicator.shimmerIntervalMs
				: DEFAULT_SHIMMER_INTERVAL_MS;
		this.shimmerWidth =
			indicator?.shimmerWidth && indicator.shimmerWidth > 0 ? indicator.shimmerWidth : DEFAULT_SHIMMER_WIDTH;
		this.shimmerColorFn = indicator?.shimmerColorFn;
		this.maxMessageWidth =
			indicator?.maxMessageWidth && indicator.maxMessageWidth > 0 ? indicator.maxMessageWidth : undefined;
		this.mode = indicator?.mode ?? "responding";
		this.stalledDetection = indicator?.stalledDetection ?? false;
		this.stalledAfterMs =
			indicator?.stalledAfterMs && indicator.stalledAfterMs > 0
				? indicator.stalledAfterMs
				: DEFAULT_STALLED_AFTER_MS;
		this.stalledFadeMs =
			indicator?.stalledFadeMs && indicator.stalledFadeMs > 0 ? indicator.stalledFadeMs : DEFAULT_STALLED_FADE_MS;
		this.stalledWarningColorFn = indicator?.stalledWarningColorFn;
		this.stalledColorFn = indicator?.stalledColorFn;
		this.showStatus = indicator?.showStatus ?? false;
		this.elapsedAfterMs =
			indicator?.elapsedAfterMs !== undefined && indicator.elapsedAfterMs >= 0
				? indicator.elapsedAfterMs
				: DEFAULT_STATUS_AFTER_MS;
		this.tokensAfterMs =
			indicator?.tokensAfterMs !== undefined && indicator.tokensAfterMs >= 0
				? indicator.tokensAfterMs
				: DEFAULT_STATUS_AFTER_MS;
		this.statusColorFn = indicator?.statusColorFn;
		this.animationStartMs = Date.now();
		this.resetStalledDetection();
		this.start();
	}

	private restartAnimation(): void {
		this.stop();
		if (this.frames.length <= 1 && !this.shimmer && this.mode !== "tool-use" && !this.stalledDetection) {
			return;
		}

		const intervals = [this.intervalMs];
		if (this.shimmer) intervals.push(this.shimmerIntervalMs);
		if (this.mode === "tool-use") intervals.push(100);
		if (this.stalledDetection) intervals.push(100);
		const tickMs = Math.max(50, Math.min(...intervals));

		this.intervalId = setInterval(() => {
			this.updateDisplay();
		}, tickMs);
	}

	/**
	 * Update stream progress used by stalled detection.
	 *
	 * Claude Code only turns the spinner/message red when output stops and no
	 * tools are active. This mirrors that behavior without coupling the TUI
	 * component to a specific message shape.
	 */
	setStalledDetectionState(progressValue: number, hasActiveTools = false): void {
		const normalizedProgress = Number.isFinite(progressValue) ? Math.max(0, progressValue) : 0;
		const now = Date.now();

		if (hasActiveTools) {
			this.hasActiveTools = true;
			this.lastProgressAtMs = now;
			this.lastProgressValue = normalizedProgress;
			this.updateDisplay();
			return;
		}

		this.hasActiveTools = false;
		if (normalizedProgress < this.lastProgressValue || normalizedProgress > this.lastProgressValue) {
			this.lastProgressAtMs = now;
			this.lastProgressValue = normalizedProgress;
		}
		this.updateDisplay();
	}

	private resetStalledDetection(): void {
		const now = Date.now();
		this.lastProgressValue = 0;
		this.lastProgressAtMs = now;
		this.hasActiveTools = false;
	}

	private getElapsedMs(): number {
		return Date.now() - this.animationStartMs;
	}

	private getStalledIntensity(): number {
		if (!this.stalledDetection || this.hasActiveTools) return 0;
		const timeSinceProgress = Date.now() - this.lastProgressAtMs;
		if (timeSinceProgress <= this.stalledAfterMs) return 0;
		return Math.min((timeSinceProgress - this.stalledAfterMs) / this.stalledFadeMs, 1);
	}

	private getStatusColorFn(baseColorFn: (str: string) => string): (str: string) => string {
		const intensity = this.getStalledIntensity();
		if (intensity >= STALLED_ERROR_THRESHOLD && this.stalledColorFn) return this.stalledColorFn;
		if (intensity >= STALLED_WARNING_THRESHOLD && this.stalledWarningColorFn) return this.stalledWarningColorFn;
		return baseColorFn;
	}

	private getFrame(): string {
		if (this.frames.length === 0) {
			return "";
		}
		const frameIndex = Math.floor(this.getElapsedMs() / this.intervalMs) % this.frames.length;
		return this.frames[frameIndex] ?? "";
	}

	private getMessageSegments(): MessageSegment[] {
		return Array.from(getSegmenter().segment(this.getDisplayMessage()), ({ segment }) => ({
			segment,
			width: visibleWidth(segment),
		}));
	}

	private getDisplayMessage(): string {
		if (!this.maxMessageWidth) {
			return this.message;
		}
		return truncateToWidth(this.message, this.maxMessageWidth);
	}

	private getMessageWidth(segments: MessageSegment[]): number {
		return segments.reduce((width, segment) => width + segment.width, 0);
	}

	private renderToolUseMessage(): string {
		const messageColorFn = this.getStatusColorFn(this.messageColorFn);
		const shimmerColorFn = this.getStatusColorFn(this.shimmerColorFn ?? this.messageColorFn);
		const flashOpacity = (Math.sin((this.getElapsedMs() / 1000) * Math.PI) + 1) / 2;
		const colorFn = flashOpacity > 0.5 ? shimmerColorFn : messageColorFn;
		return colorFn(this.getDisplayMessage());
	}

	private renderShimmerMessage(): string {
		const messageColorFn = this.getStatusColorFn(this.messageColorFn);
		const displayMessage = this.getDisplayMessage();
		if (!this.shimmer || !displayMessage || displayMessage.trim() === "") {
			return messageColorFn(displayMessage);
		}

		const shimmerColorFn = this.getStatusColorFn(this.shimmerColorFn ?? this.messageColorFn);
		const segments = this.getMessageSegments();
		const messageWidth = this.getMessageWidth(segments);
		const shimmerTick = Math.floor(this.getElapsedMs() / this.shimmerIntervalMs);
		const cycleLength = Math.max(1, messageWidth + SHIMMER_TRAIL_PADDING);
		const glimmerIndex =
			this.shimmerDirection === "left-to-right"
				? (shimmerTick % cycleLength) - SHIMMER_TRAIL_PADDING / 2
				: messageWidth + SHIMMER_TRAIL_PADDING / 2 - (shimmerTick % cycleLength);
		const shimmerStart = glimmerIndex - Math.floor(this.shimmerWidth / 2);
		const shimmerEnd = shimmerStart + this.shimmerWidth - 1;

		if (shimmerStart >= messageWidth || shimmerEnd < 0) {
			return messageColorFn(displayMessage);
		}

		const clampedStart = Math.max(0, shimmerStart);
		let column = 0;
		let before = "";
		let shimmer = "";
		let after = "";
		for (const { segment, width } of segments) {
			const nextColumn = column + width;
			if (nextColumn <= clampedStart) {
				before += segment;
			} else if (column > shimmerEnd) {
				after += segment;
			} else {
				shimmer += segment;
			}
			column = nextColumn;
		}

		return `${before ? messageColorFn(before) : ""}${shimmerColorFn(shimmer)}${after ? messageColorFn(after) : ""}`;
	}

	private renderMessage(): string {
		if (this.mode === "tool-use") {
			return this.renderToolUseMessage();
		}
		return this.renderShimmerMessage();
	}

	private formatElapsedMs(ms: number): string {
		const totalSeconds = Math.max(0, Math.floor(ms / 1000));
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}m`;
		if (minutes > 0) return `${minutes}m${String(seconds).padStart(2, "0")}s`;
		return `${seconds}s`;
	}

	private formatTokenCount(count: number): string {
		if (count < 1000) return String(count);
		if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
		if (count < 1000000) return `${Math.round(count / 1000)}k`;
		return `${(count / 1000000).toFixed(1)}M`;
	}

	private renderStatusSuffix(): string {
		if (!this.showStatus) return "";
		const elapsedMs = this.getElapsedMs();
		const parts: string[] = [];
		if (elapsedMs >= this.elapsedAfterMs) {
			parts.push(this.formatElapsedMs(elapsedMs));
		}
		const estimatedTokens = Math.round(this.lastProgressValue / ESTIMATED_CHARS_PER_TOKEN);
		if (elapsedMs >= this.tokensAfterMs && estimatedTokens > 0) {
			parts.push(`↓ ${this.formatTokenCount(estimatedTokens)} tokens`);
		}
		if (parts.length === 0) return "";
		const colorFn = this.statusColorFn ?? this.messageColorFn;
		return colorFn(` (${parts.join(" · ")})`);
	}

	private updateDisplay(): void {
		const frame = this.getFrame();
		const spinnerColorFn = this.getStatusColorFn(this.spinnerColorFn);
		const renderedFrame = this.renderIndicatorVerbatim ? frame : spinnerColorFn(frame);
		const indicator = frame.length > 0 ? `${renderedFrame} ` : "";
		this.setText(`${indicator}${this.renderMessage()}${this.renderStatusSuffix()}`);
		if (this.ui) {
			this.ui.requestRender();
		}
	}
}
