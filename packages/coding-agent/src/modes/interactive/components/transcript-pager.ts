import { type Component, type Focusable, matchesKey, truncateToWidth } from "@neosantara/tui";
import { theme } from "../theme/theme.js";
import { rawKeyHint } from "./keybinding-hints.js";

const TRANSCRIPT_TITLE = "T R A N S C R I P T";

export class TranscriptPagerComponent implements Component, Focusable {
	private scrollOffset = 0;
	private autoFollow = true;
	private _focused = false;

	constructor(
		private readonly title: string,
		private readonly getLines: () => string[],
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
		const lines = this.getLines();
		const viewportHeight = Math.max(1, this.getTerminalRows() - 5);
		const maxScroll = Math.max(0, lines.length - viewportHeight);

		if (this.autoFollow) {
			this.scrollOffset = maxScroll;
		} else {
			this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxScroll));
		}

		const header = this.renderHeader(width);
		const viewport = this.renderViewport(lines, viewportHeight, width);
		const bottomBar = this.renderBottomBar(width, viewportHeight);
		const hints = this.renderHints(width);

		return [...header, ...viewport, bottomBar, ...hints];
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+t") || data === "q") {
			this.onClose();
			return;
		}
		if (matchesKey(data, "up") || data === "k") {
			this.scrollUp(1);
			return;
		}
		if (matchesKey(data, "down") || data === "j") {
			this.scrollDown(1);
			return;
		}
		if (matchesKey(data, "pageUp") || matchesKey(data, "ctrl+b")) {
			this.scrollUp(this.pageSize());
			return;
		}
		if (matchesKey(data, "pageDown") || matchesKey(data, "ctrl+f") || data === " ") {
			this.scrollDown(this.pageSize());
			return;
		}
		if (matchesKey(data, "ctrl+u")) {
			this.scrollUp(this.halfPageSize());
			return;
		}
		if (matchesKey(data, "ctrl+d")) {
			this.scrollDown(this.halfPageSize());
			return;
		}
		if (matchesKey(data, "home")) {
			this.scrollOffset = 0;
			this.autoFollow = false;
			return;
		}
		if (matchesKey(data, "end")) {
			this.autoFollow = true;
			return;
		}
	}

	private scrollUp(amount: number): void {
		this.scrollOffset = Math.max(0, this.scrollOffset - amount);
		this.autoFollow = false;
	}

	private scrollDown(amount: number): void {
		const lines = this.getLines();
		const viewportHeight = Math.max(1, this.getTerminalRows() - 3);
		const maxScroll = Math.max(0, lines.length - viewportHeight);
		this.scrollOffset = Math.min(maxScroll, this.scrollOffset + amount);
		if (this.scrollOffset >= maxScroll) {
			this.autoFollow = true;
		}
	}

	private pageSize(): number {
		return Math.max(1, this.getTerminalRows() - 5);
	}

	private halfPageSize(): number {
		return Math.max(1, Math.ceil(this.pageSize() / 2));
	}

	private renderHeader(width: number): string[] {
		const widthLimit = Math.max(1, width);
		const title = `/ ${this.title || TRANSCRIPT_TITLE}`;
		const fillWidth = Math.max(0, widthLimit - title.length);
		const fill = theme.fg("dim", "/ ".repeat(Math.ceil(fillWidth / 2)));
		const header = `${theme.fg("dim", title)}${fill}`;
		return [truncateToWidth(header, widthLimit, "")];
	}

	private renderViewport(lines: string[], viewportHeight: number, width: number): string[] {
		const visible = lines.slice(this.scrollOffset, this.scrollOffset + viewportHeight);
		const result: string[] = [];
		for (const line of visible) {
			result.push(truncateToWidth(line, Math.max(1, width), ""));
		}
		while (result.length < viewportHeight) {
			result.push(this.renderEmptyLine(width));
		}
		return result;
	}

	private renderEmptyLine(width: number): string {
		if (width <= 0) return "";
		return `${theme.fg("dim", "~")}${" ".repeat(Math.max(0, width - 1))}`;
	}

	private renderBottomBar(width: number, viewportHeight: number): string {
		const lines = this.getLines();
		const totalLines = lines.length;
		const maxScroll = Math.max(0, totalLines - viewportHeight);
		const percent = maxScroll === 0 ? 100 : Math.round((Math.min(this.scrollOffset, maxScroll) / maxScroll) * 100);
		const percentText = ` ${percent}% `;
		const line = theme.fg("dim", "─".repeat(Math.max(1, width)));
		const start = Math.max(0, width - percentText.length - 1);
		return `${truncateToWidth(line, start, "")}${theme.fg("dim", percentText)}`.padEnd(width);
	}

	private renderHints(width: number): string[] {
		const first = `${rawKeyHint("up/down", "to scroll")}   ${rawKeyHint("PgUp/PgDn", "to page")}   ${rawKeyHint("Home/End", "to jump")}`;
		const second = `${rawKeyHint("q/Ctrl+T", "to quit")}   ${rawKeyHint("Esc", "to close")}`;
		return [
			truncateToWidth(` ${first}`, Math.max(1, width), ""),
			truncateToWidth(` ${second}`, Math.max(1, width), ""),
		];
	}
}
