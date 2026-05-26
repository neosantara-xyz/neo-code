import { type Component, type Focusable, matchesKey, truncateToWidth } from "@neosantara/tui";
import { theme } from "../theme/theme.js";
import { rawKeyHint } from "./keybinding-hints.js";

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
		const viewportHeight = Math.max(1, this.getTerminalRows() - 3);
		const maxScroll = Math.max(0, lines.length - viewportHeight);

		if (this.autoFollow) {
			this.scrollOffset = maxScroll;
		} else {
			this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxScroll));
		}

		const header = this.renderHeader(width);
		const viewport = this.renderViewport(lines, viewportHeight, width);
		const footer = this.renderFooter(width);

		return [...header, ...viewport, ...footer];
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape") || data === "q") {
			this.onClose();
			return;
		}
		if (matchesKey(data, "up")) {
			this.scrollUp(1);
			return;
		}
		if (matchesKey(data, "down")) {
			this.scrollDown(1);
			return;
		}
		if (matchesKey(data, "pageUp")) {
			this.scrollUp(this.pageSize());
			return;
		}
		if (matchesKey(data, "pageDown")) {
			this.scrollDown(this.pageSize());
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
		return Math.max(1, this.getTerminalRows() - 3);
	}

	private renderHeader(width: number): string[] {
		const headerText = theme.bold(this.title);
		return [truncateToWidth(headerText, Math.max(1, width), "")];
	}

	private renderViewport(lines: string[], viewportHeight: number, width: number): string[] {
		const visible = lines.slice(this.scrollOffset, this.scrollOffset + viewportHeight);
		const result: string[] = [];
		for (const line of visible) {
			result.push(truncateToWidth(line, Math.max(1, width), ""));
		}
		while (result.length < viewportHeight) {
			result.push("");
		}
		return result;
	}

	private renderFooter(width: number): string[] {
		const followStatus = this.autoFollow ? "on" : "off";
		const hint = `${rawKeyHint("up/dn", "scroll")} ${rawKeyHint("PgUp/PgDn", "page")} ${rawKeyHint("q/Esc", "close")} ${theme.fg("dim", `auto-follow: ${followStatus}`)}`;
		return [truncateToWidth(hint, Math.max(1, width), "")];
	}
}
