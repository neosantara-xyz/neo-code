import { type Component, type Focusable, matchesKey, truncateToWidth, visibleWidth } from "@neosantara/tui";
import { APP_TITLE } from "../../../config.js";
import { theme } from "../theme/theme.js";
import { rawKeyHint } from "./keybinding-hints.js";

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
}

function padVisible(text: string, width: number): string {
	return `${text}${" ".repeat(Math.max(0, width - visibleWidth(text)))}`;
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
		const lines = [
			`${theme.bold(title)}  ${theme.fg("dim", this.data.billingMode)}`,
			`${theme.fg("dim", "Account")}    ${this.data.account}`,
			`${theme.fg("dim", "Workspace")}  ${this.data.workspace}`,
			`${theme.fg("dim", "Model")}      ${this.data.currentModel}`,
		];
		const divider = theme.fg("borderMuted", "─".repeat(Math.max(0, width)));
		return [...lines.map((line) => truncateLine(line, width)), divider];
	}

	private renderBody(width: number): string[] {
		const lines: string[] = [];
		const labelWidth = 16;
		const labelPad = (label: string): string => theme.fg("dim", label.padEnd(labelWidth));

		lines.push(theme.bold("Account billing"));
		lines.push(`${labelPad("Balance")}${this.data.balance}`);
		lines.push(`${labelPad("Period spend")}${this.data.periodSpend}`);
		lines.push(`${labelPad("Backend")}${this.data.backendStatus}`);
		if (this.data.updatedAt) {
			lines.push(`${labelPad("Updated")}${this.data.updatedAt}`);
		}
		lines.push("");

		lines.push(theme.bold("Current session"));
		lines.push(`${labelPad("Tokens")}${this.data.sessionTokens}`);
		lines.push(`${labelPad("Cost")}${this.data.sessionCost}`);
		lines.push(`${labelPad("Duration")}${this.data.sessionDuration}`);
		return lines.map((line) => truncateLine(line, width));
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
