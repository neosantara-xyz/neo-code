import { type Component, type Focusable, matchesKey, truncateToWidth, visibleWidth } from "@neosantara/tui";
import { APP_TITLE } from "../../../config.js";
import { theme } from "../theme/theme.js";
import { rawKeyHint } from "./keybinding-hints.js";

export type UsageStatusKind = "success" | "warning" | "error" | "muted";

export interface UsageModelRow {
	id: string;
	displayName: string;
	providerName: string;
	active: boolean;
	percentAvailable: number | null;
	status: string;
	statusKind: UsageStatusKind;
	detail?: string;
}

export interface UsageScreenData {
	version: string;
	workspace: string;
	account: string;
	currentModel: string;
	billingMode: string;
	balance: string;
	periodSpend: string;
	sessionTokens: string;
	sessionCost: string;
	sessionDuration: string;
	backendStatus: string;
	updatedAt?: string;
	models: UsageModelRow[];
}

function clampPercent(percent: number): number {
	return Math.max(0, Math.min(100, percent));
}

export function formatUsageQuotaBar(percentAvailable: number | null, maxCells = 55): string {
	const cells = Math.max(10, Math.min(55, maxCells));
	if (percentAvailable === null) {
		const unknown = "░".repeat(cells);
		return groupBarCells(unknown);
	}

	const clamped = clampPercent(percentAvailable);
	const filled = Math.round((clamped / 100) * cells);
	const bar = `${"█".repeat(filled)}${"░".repeat(cells - filled)}`;
	return groupBarCells(bar);
}

function groupBarCells(bar: string): string {
	const groups: string[] = [];
	for (let i = 0; i < bar.length; i += 11) {
		groups.push(bar.slice(i, i + 11));
	}
	return groups.join(" ");
}

function padVisible(text: string, width: number): string {
	return `${text}${" ".repeat(Math.max(0, width - visibleWidth(text)))}`;
}

function colorStatus(kind: UsageStatusKind, text: string): string {
	switch (kind) {
		case "success":
			return theme.fg("success", text);
		case "warning":
			return theme.fg("warning", text);
		case "error":
			return theme.fg("error", text);
		case "muted":
			return theme.fg("muted", text);
	}
}

function percentLabel(percent: number | null): string {
	if (percent === null) return "n/a";
	return `${Math.round(clampPercent(percent))}%`;
}

function truncateLine(line: string, width: number): string {
	return truncateToWidth(line, Math.max(1, width), "");
}

export class UsageScreenComponent implements Component, Focusable {
	private scrollOffset = 0;
	private _focused = false;

	constructor(
		private readonly data: UsageScreenData,
		private readonly getTerminalRows: () => number,
		private readonly onClose: () => void,
	) {}

	get focused(): boolean {
		return this._focused;
	}

	set focused(value: boolean) {
		this._focused = value;
	}

	invalidate(): void {}

	render(width: number): string[] {
		const safeWidth = Math.max(40, width);
		const maxRows = Math.max(12, Math.min(this.getTerminalRows() - 1, 42));
		const header = this.renderHeader(safeWidth);
		const footer = this.renderFooter(safeWidth);
		const bodyHeight = Math.max(1, maxRows - header.length - footer.length);
		const body = this.renderBody(safeWidth);
		const maxScroll = Math.max(0, body.length - bodyHeight);
		this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxScroll));
		const visibleBody = body.slice(this.scrollOffset, this.scrollOffset + bodyHeight);
		while (visibleBody.length < bodyHeight) {
			visibleBody.push("");
		}
		return [...header, ...visibleBody, ...footer].map((line) => truncateLine(line, safeWidth));
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape") || matchesKey(data, "esc") || matchesKey(data, "ctrl+c")) {
			this.onClose();
			return;
		}
		if (matchesKey(data, "up")) {
			this.scrollBy(-1);
			return;
		}
		if (matchesKey(data, "down")) {
			this.scrollBy(1);
			return;
		}
		if (matchesKey(data, "pageUp")) {
			this.scrollBy(-this.pageSize());
			return;
		}
		if (matchesKey(data, "pageDown")) {
			this.scrollBy(this.pageSize());
			return;
		}
		if (matchesKey(data, "home") || matchesKey(data, "ctrl+home")) {
			this.scrollOffset = 0;
			return;
		}
		if (matchesKey(data, "end") || matchesKey(data, "ctrl+end")) {
			this.scrollOffset = Number.MAX_SAFE_INTEGER;
		}
	}

	private scrollBy(delta: number): void {
		this.scrollOffset = Math.max(0, this.scrollOffset + delta);
	}

	private pageSize(): number {
		return Math.max(4, Math.floor(this.getTerminalRows() * 0.65));
	}

	private renderHeader(width: number): string[] {
		const title = `${APP_TITLE} ${this.data.version}`;
		const logoLines = [
			["     ▄▀▀▄", title],
			["     ▀▀▀▀▀▀", this.data.account],
			["    ▀▀▀▀▀▀▀▀", this.data.currentModel],
			["   ▄▀▀    ▀▀▄", this.data.workspace],
			["  ▄▀▀      ▀▀▄", this.data.billingMode],
		] as const;
		const rendered = logoLines.map(([logo, text]) => {
			const left = theme.fg("accent", logo);
			const spacing = " ".repeat(7);
			return truncateLine(`${left}${spacing}${text}`, width);
		});
		const divider = theme.fg("borderMuted", `${"─".repeat(Math.max(0, width - 1))}>`);
		const section = `${theme.fg("borderMuted", `${"─".repeat(Math.max(0, width - 13))}└`)} ${theme.bold("Model Usage")}`;
		return [...rendered, divider, truncateLine(section, width)];
	}

	private renderBody(width: number): string[] {
		const lines: string[] = [];
		lines.push(`${theme.fg("dim", "Balance")} ${this.data.balance}`);
		lines.push(`${theme.fg("dim", "Period spend")} ${this.data.periodSpend}`);
		lines.push(
			`${theme.fg("dim", "Current session")} ${this.data.sessionTokens} · ${this.data.sessionCost} · ${this.data.sessionDuration}`,
		);
		lines.push(`${theme.fg("dim", "Backend")} ${this.data.backendStatus}`);
		if (this.data.updatedAt) {
			lines.push(`${theme.fg("dim", "Updated")} ${this.data.updatedAt}`);
		}
		lines.push("");

		const barCells = Math.max(10, Math.min(55, width - 10));
		for (const row of this.data.models) {
			const activeMark = row.active ? theme.fg("accent", "● ") : "  ";
			const name = row.active ? theme.bold(row.displayName) : row.displayName;
			lines.push(`${activeMark}${truncateLine(name, width - 2)}`);
			const bar = formatUsageQuotaBar(row.percentAvailable, barCells);
			const label = percentLabel(row.percentAvailable).padStart(4);
			lines.push(`  ${bar} ${label}`);
			const status = colorStatus(row.statusKind, row.status);
			const provider = theme.fg("dim", row.providerName);
			const detail = row.detail ? ` ${theme.fg("dim", row.detail)}` : "";
			lines.push(`  ${status} ${theme.fg("dim", "·")} ${provider}${detail}`);
			lines.push("");
		}

		if (this.data.models.length === 0) {
			lines.push(theme.fg("warning", "No models are available for the current configuration."));
		}
		return lines;
	}

	private renderFooter(width: number): string[] {
		const hints = [
			`${rawKeyHint("↑/↓", "Scroll")} · ${rawKeyHint("pgup/pgdown", "Page")} · ${rawKeyHint("ctrl+end", "Bottom")}`,
			`${rawKeyHint("ctrl+home", "Top")} · ${rawKeyHint("esc", "Close")}`,
		];
		const model = theme.fg("muted", this.data.currentModel);
		const bottom = `${hints[1]}${" ".repeat(Math.max(1, width - visibleWidth(hints[1]) - visibleWidth(model)))}${model}`;
		return [padVisible(truncateLine(hints[0], width), width), truncateLine(bottom, width)];
	}
}
