import { type Component, truncateToWidth, visibleWidth } from "@neosantara/tui";
import { getAgentWorkModeLabel, getAgentWorkModeSymbol, isDefaultAgentWorkMode } from "../../../core/agent-mode.js";
import type { AgentSession } from "../../../core/agent-session.js";
import type { ReadonlyFooterDataProvider } from "../../../core/footer-data-provider.js";
import type { SettingsManager } from "../../../core/settings-manager.js";
import {
	DEFAULT_STATUSLINE_ITEMS,
	type StatuslineItemConfig,
	type StatuslineItemId,
} from "../../../core/statusline.js";
import { theme } from "../theme/theme.js";
import { keyDisplayText, keyText } from "./keybinding-hints.js";

/**
 * Sanitize text for display in a single-line status.
 * Removes newlines, tabs, carriage returns, and other control characters.
 */
function sanitizeStatusText(text: string): string {
	// Replace newlines, tabs, carriage returns with space, then collapse multiple spaces
	return text
		.replace(/[\r\n\t]/g, " ")
		.replace(/ +/g, " ")
		.trim();
}

/**
 * Width below which the footer drops low-priority items and shortens
 * verbose labels. Phone-landscape Termux sessions are typically 60-68
 * cols, so 70 is a useful break. Exported for tests.
 */
export const COMPACT_FOOTER_WIDTH = 70;

/**
 * Format token counts for compact terminal display.
 */
function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

function formatIdrCompact(amount: number): string {
	if (amount < 1000) return `Rp${amount.toFixed(0)}`;
	if (amount < 10000) return `Rp${(amount / 1000).toFixed(1)}rb`;
	if (amount < 1000000) return `Rp${Math.round(amount / 1000)}rb`;
	if (amount < 10000000) return `Rp${(amount / 1000000).toFixed(1)}jt`;
	if (amount < 1000000000) return `Rp${Math.round(amount / 1000000)}jt`;
	return `Rp${(amount / 1000000000).toFixed(1)}M`;
}

function formatPercentCompact(percent: number): string {
	return percent >= 10 ? `${percent.toFixed(0)}%` : `${percent.toFixed(1)}%`;
}

export type ContextFooterSeverity = "ok" | "warning" | "error";

export function formatContextFooterSegment(
	percent: number | null | undefined,
	contextWindow: number,
	autoCompactEnabled: boolean,
	tokens?: number | null,
	compact = false,
): { text: string; severity: ContextFooterSeverity } {
	const strategy = autoCompactEnabled ? "auto" : "manual";
	const windowText = contextWindow > 0 ? formatTokens(contextWindow) : "?";
	if (typeof percent !== "number" || !Number.isFinite(percent)) {
		const text = compact ? `ctx ?/${windowText}` : `ctx ?/${windowText} · ${strategy}`;
		return { text, severity: "warning" };
	}

	const normalized = Math.max(0, percent);
	const severity: ContextFooterSeverity = normalized >= 90 ? "error" : normalized >= 70 ? "warning" : "ok";
	const percentText = formatPercentCompact(normalized);
	if (compact) {
		// Narrow terminals: drop the strategy label and the absolute token
		// count to keep the segment under ~14 visible cells.
		return { text: `ctx ${percentText}/${windowText}`, severity };
	}
	if (typeof tokens !== "number" || !Number.isFinite(tokens)) {
		return { text: `ctx ${percentText}/${windowText} · ${strategy}`, severity };
	}

	return { text: `ctx ${formatTokens(tokens)}/${windowText} (${percentText}) · ${strategy}`, severity };
}

export function formatFooterHint(isStreaming: boolean, hasBackgroundTasks: boolean, compact = false): string {
	if (compact) {
		// Phone-landscape: a single hint is enough; "?" reveals the rest.
		return isStreaming ? `${keyText("app.interrupt")} stop` : "?";
	}
	const parts = isStreaming
		? [`${keyText("app.interrupt")} interrupt`]
		: ["? shortcuts", `${keyText("app.mode.cycle")} mode`];
	if (hasBackgroundTasks) {
		parts.push("/tasks manage");
	}
	return parts.join(" · ");
}

export function renderShortcutOverlay(width: number): string[] {
	const shortcuts = [
		["?", "toggle this overlay"],
		[keyDisplayText("app.interrupt"), "interrupt / cancel"],
		[keyDisplayText("app.mode.cycle"), "cycle mode"],
		[keyDisplayText("app.transcript.view"), "view transcript"],
		[keyDisplayText("app.tools.expand"), "expand output"],
		[keyDisplayText("app.thinking.cycle"), "cycle thinking level"],
		[keyDisplayText("app.model.select"), "select model"],
		[keyDisplayText("app.session.tree"), "session tree"],
		[keyDisplayText("app.session.new"), "new session"],
		[keyDisplayText("app.session.resume"), "resume session"],
		["!", "shell command prefix"],
		["/compact", "compact context"],
		["/usage", "show usage stats"],
	];

	const colWidth = Math.floor(width / 2);
	const rows: string[] = [];
	for (let i = 0; i < shortcuts.length; i += 2) {
		const left = shortcuts[i]!;
		const right = shortcuts[i + 1];
		const leftStr = `  ${theme.fg("accent", left[0]!)}  ${left[1]}`;
		const rightStr = right ? `  ${theme.fg("accent", right[0]!)}  ${right[1]}` : "";
		rows.push(
			truncateToWidth(
				`${leftStr}${" ".repeat(Math.max(1, colWidth - visibleWidth(leftStr)))}${rightStr}`,
				width,
				"",
			),
		);
	}
	return [theme.fg("dim", "─".repeat(width)), ...rows, ""];
}

/**
 * Footer component that shows pwd, token stats, and context usage.
 * Computes token/context stats from session, gets git branch and extension statuses from provider.
 *
 * Item visibility and ordering is configurable via `settings.statusline.items`.
 * See `core/statusline.ts` for the item catalog.
 */
export class FooterComponent implements Component {
	private autoCompactEnabled = true;
	public shortcutOverlayVisible = false;

	constructor(
		private session: AgentSession,
		private footerData: ReadonlyFooterDataProvider,
		private settingsManager?: SettingsManager,
	) {}

	setSession(session: AgentSession): void {
		this.session = session;
	}

	setSettingsManager(settingsManager: SettingsManager): void {
		this.settingsManager = settingsManager;
	}

	private getStatuslineItems(): StatuslineItemConfig[] {
		if (this.settingsManager) {
			return this.settingsManager.getStatuslineItems();
		}
		return DEFAULT_STATUSLINE_ITEMS.map((item) => ({ ...item }));
	}

	private isItemEnabled(items: StatuslineItemConfig[], id: StatuslineItemId): boolean {
		return items.find((item) => item.id === id)?.enabled === true;
	}

	private getEnabledLeftItemsInOrder(items: StatuslineItemConfig[]): StatuslineItemId[] {
		const leftIds: StatuslineItemId[] = ["modePill", "backgroundPill", "context", "billing", "hint"];
		const leftSet = new Set<StatuslineItemId>(leftIds);
		return items.filter((item) => item.enabled && leftSet.has(item.id)).map((item) => item.id);
	}

	setAutoCompactEnabled(enabled: boolean): void {
		this.autoCompactEnabled = enabled;
	}

	/**
	 * No-op: git branch caching now handled by provider.
	 * Kept for compatibility with existing call sites in interactive-mode.
	 */
	invalidate(): void {
		// No-op: git branch is cached/invalidated by provider
	}

	/**
	 * Clean up resources.
	 * Git watcher cleanup now handled by provider.
	 */
	dispose(): void {
		// Git watcher cleanup handled by provider
	}

	render(width: number): string[] {
		const state = this.session.state;
		const statuslineItems = this.getStatuslineItems();
		const compact = width > 0 && width < COMPACT_FOOTER_WIDTH;

		// Calculate cumulative usage from ALL session entries (not just post-compaction messages)
		let totalCost = 0;

		for (const entry of this.session.sessionManager.getEntries()) {
			if (entry.type === "message" && entry.message.role === "assistant") {
				totalCost += entry.message.usage.cost.total;
			}
		}

		// Calculate context usage from session (handles compaction correctly).
		// After compaction, tokens are unknown until the next LLM response.
		const contextUsage = this.session.getContextUsage();
		const contextWindow = contextUsage?.contextWindow ?? state.model?.contextWindow ?? 0;
		const contextPercentValue = typeof contextUsage?.percent === "number" ? contextUsage.percent : null;

		// Replace home directory with ~
		let pwd = this.session.sessionManager.getCwd();
		const home = process.env.HOME || process.env.USERPROFILE;
		if (home && pwd.startsWith(home)) {
			pwd = `~${pwd.slice(home.length)}`;
		}

		// Add git branch if enabled and available
		const branch = this.footerData.getGitBranch();
		if (branch && this.isItemEnabled(statuslineItems, "branch") && !compact) {
			pwd = `${pwd} (${branch})`;
		}

		// Add session name if enabled and set
		const sessionName = this.session.sessionManager.getSessionName();
		if (sessionName && this.isItemEnabled(statuslineItems, "sessionName") && !compact) {
			pwd = `${pwd} • ${sessionName}`;
		}

		// On narrow terminals collapse the cwd to its last segment so the
		// path line never pushes the model name off-screen.
		if (compact) {
			const lastSep = Math.max(pwd.lastIndexOf("/"), pwd.lastIndexOf("\\"));
			if (lastSep > 0 && lastSep < pwd.length - 1) {
				pwd = pwd.slice(lastSep + 1);
			}
		}

		// Build stats line. The primary footer number is the *current request context*,
		// not cumulative session input. Cumulative billing still exists, but belongs
		// in /usage and /context so compacted sessions show active context clearly.
		const usingSubscription = state.model ? this.session.modelRegistry.isUsingOAuth(state.model) : false;
		const costStr = `${formatIdrCompact(totalCost)}${usingSubscription ? " (sub)" : ""}`;
		const contextTokensValue = typeof contextUsage?.tokens === "number" ? contextUsage.tokens : null;
		const contextSegment = formatContextFooterSegment(
			contextPercentValue,
			contextWindow,
			this.autoCompactEnabled,
			contextTokensValue,
			compact,
		);
		const contextColor =
			contextSegment.severity === "error" ? "error" : contextSegment.severity === "warning" ? "warning" : "dim";
		const billingText = `bill ${costStr}`;
		const runningBackgroundTasks = this.session.getRunningBackgroundTaskCount();
		const hasBackgroundTasks = runningBackgroundTasks > 0;

		// Mode pill
		const mode = this.session.agentMode;
		const modeIsDefault = isDefaultAgentWorkMode(mode);
		const modeColor = mode === "plan" ? "warning" : mode === "full" ? "error" : mode === "ask" ? "accent" : "success";
		const modePill = modeIsDefault
			? ""
			: theme.fg(modeColor, `${getAgentWorkModeSymbol(mode)} ${getAgentWorkModeLabel(mode).toLowerCase()}`);
		const backgroundPill = hasBackgroundTasks
			? theme.fg("warning", `bg ${runningBackgroundTasks} shell${runningBackgroundTasks === 1 ? "" : "s"}`)
			: "";
		const hintText = theme.fg("dim", formatFooterHint(this.session.isStreaming, hasBackgroundTasks, compact));

		// Map each left-column statusline item id to its rendered string. Items
		// that have no content for the current state (e.g. modePill in default
		// mode) collapse to empty strings and are filtered below.
		// On narrow terminals (Termux phone landscape, ~60 cols) we drop the
		// billing label and mode label to keep the line under one row.
		const compactModePill = compact && modePill ? theme.fg(modeColor, getAgentWorkModeSymbol(mode)) : modePill;
		const leftRenderers: Record<StatuslineItemId, string> = {
			modePill: compactModePill,
			backgroundPill,
			context: theme.fg(contextColor, contextSegment.text),
			billing: compact ? "" : theme.fg("dim", billingText),
			hint: compact ? "" : hintText,
			modelName: "",
			thinkingLevel: "",
			providerName: "",
			branch: "",
			sessionName: "",
		};

		const leftOrder = this.getEnabledLeftItemsInOrder(statuslineItems);
		const statsParts = leftOrder.map((id) => leftRenderers[id]).filter((part) => part.length > 0);
		let statsLeft = statsParts.join(` ${theme.fg("muted", "·")} `);

		// Build right-side items (model + thinking + provider).
		const showModelName = this.isItemEnabled(statuslineItems, "modelName");
		const showThinking = this.isItemEnabled(statuslineItems, "thinkingLevel") && !compact;
		const showProvider = this.isItemEnabled(statuslineItems, "providerName") && !compact;
		const modelName = state.model?.id || "no-model";

		let statsLeftWidth = visibleWidth(statsLeft);

		// If statsLeft is too wide, truncate it
		if (statsLeftWidth > width) {
			statsLeft = truncateToWidth(statsLeft, width, "...");
			statsLeftWidth = visibleWidth(statsLeft);
		}

		// Calculate available space for padding (minimum 2 spaces between stats and model)
		const minPadding = 2;

		const modelParts: string[] = [];
		if (showModelName) modelParts.push(modelName);
		if (showThinking && state.model?.reasoning) {
			const thinkingLevel = state.thinkingLevel || "off";
			const effortSymbol = thinkingLevel === "high" ? "●" : thinkingLevel === "medium" ? "◐" : "○";
			modelParts.push(`${effortSymbol} ${thinkingLevel}`);
		}
		const modelText = modelParts.length > 0 ? theme.fg("dim", modelParts.join(" • ")) : "";
		const rightSideWithoutProvider = modelText;

		// Prepend the provider in parentheses if there are multiple providers and there's enough room
		let rightSide = rightSideWithoutProvider;
		if (
			showProvider &&
			rightSideWithoutProvider.length > 0 &&
			this.footerData.getAvailableProviderCount() > 1 &&
			state.model
		) {
			const withProvider = `${theme.fg("dim", `(${state.model.provider})`)} ${rightSideWithoutProvider}`;
			rightSide = withProvider;
			if (statsLeftWidth + minPadding + visibleWidth(rightSide) > width) {
				// Too wide, fall back
				rightSide = rightSideWithoutProvider;
			}
		}

		const rightSideWidth = visibleWidth(rightSide);
		const totalNeeded = statsLeftWidth + minPadding + rightSideWidth;

		let statsLine: string;
		if (rightSideWidth === 0) {
			statsLine = statsLeft;
		} else if (totalNeeded <= width) {
			// Both fit - add padding to right-align model
			const padding = " ".repeat(width - statsLeftWidth - rightSideWidth);
			statsLine = statsLeft + padding + rightSide;
		} else {
			// Need to truncate right side
			const availableForRight = width - statsLeftWidth - minPadding;
			if (availableForRight > 0) {
				const truncatedRight = truncateToWidth(rightSide, availableForRight, "");
				const truncatedRightWidth = visibleWidth(truncatedRight);
				const padding = " ".repeat(Math.max(0, width - statsLeftWidth - truncatedRightWidth));
				statsLine = statsLeft + padding + truncatedRight;
			} else {
				// Not enough space for right side at all
				statsLine = statsLeft;
			}
		}

		const pwdLine = truncateToWidth(theme.fg("dim", pwd), width, theme.fg("dim", "..."));
		const lines: string[] = [];

		// Shortcut overlay above footer
		if (this.shortcutOverlayVisible) {
			lines.push(...renderShortcutOverlay(width));
		}

		lines.push(pwdLine);
		if (statsLine.length > 0) {
			lines.push(statsLine);
		}

		// Add extension statuses on a single line, sorted by key alphabetically
		const extensionStatuses = this.footerData.getExtensionStatuses();
		if (extensionStatuses.size > 0) {
			const sortedStatuses = Array.from(extensionStatuses.entries())
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([, text]) => sanitizeStatusText(text));
			const statusLine = sortedStatuses.join(" ");
			// Truncate to terminal width with dim ellipsis for consistency with footer style
			lines.push(truncateToWidth(statusLine, width, theme.fg("dim", "...")));
		}

		return lines;
	}
}
