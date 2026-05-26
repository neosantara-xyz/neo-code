import { type Component, type Focusable, matchesKey, truncateToWidth, visibleWidth } from "@neosantara/tui";
import { APP_TITLE } from "../../../config.js";
import { theme } from "../theme/theme.js";
import { rawKeyHint } from "./keybinding-hints.js";

export type DoctorStatus = "ok" | "warn" | "fail";

export interface DoctorLine {
	label: string;
	status: DoctorStatus;
	detail: string;
}

export interface DoctorSection {
	title: string;
	lines: DoctorLine[];
}

export interface DoctorDiagnostic {
	type: "error" | "warning" | "collision";
	message: string;
	path?: string;
}

export interface DoctorScreenData {
	version: string;
	sections: DoctorSection[];
	summary: { errors: number; warnings: number };
	resourceDiagnostics: DoctorDiagnostic[];
	tip?: string;
}

function padVisible(text: string, width: number): string {
	return `${text}${" ".repeat(Math.max(0, width - visibleWidth(text)))}`;
}

function truncateLine(line: string, width: number): string {
	return truncateToWidth(line, Math.max(1, width), "");
}

function statusMarker(status: DoctorStatus): string {
	switch (status) {
		case "ok":
			return theme.fg("success", "✓");
		case "warn":
			return theme.fg("warning", "!");
		case "fail":
			return theme.fg("error", "✗");
	}
}

export class DoctorScreenComponent implements Component, Focusable {
	private scrollOffset = 0;
	private _focused = false;

	constructor(
		private readonly data: DoctorScreenData,
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
		const renderWidth = Math.min(safeWidth, width);
		const maxRows = Math.max(12, Math.min(this.getTerminalRows() - 1, 42));
		const header = this.renderHeader(renderWidth);
		const footer = this.renderFooter(renderWidth);
		const bodyHeight = Math.max(1, maxRows - header.length - footer.length);
		const body = this.renderBody(renderWidth);
		const maxScroll = Math.max(0, body.length - bodyHeight);
		this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxScroll));
		const visibleBody = body.slice(this.scrollOffset, this.scrollOffset + bodyHeight);
		while (visibleBody.length < bodyHeight) {
			visibleBody.push("");
		}
		return [...header, ...visibleBody, ...footer].map((line) => truncateLine(line, width));
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
		const title = `${APP_TITLE} Doctor`;
		const summaryKind = this.summaryKind();
		const summary = `${statusMarker(summaryKind)} ${theme.fg("dim", "Summary")} ${this.data.summary.errors} errors, ${this.data.summary.warnings} warnings`;
		const lines = [`${theme.bold(title)}  ${theme.fg("dim", `v${this.data.version}`)}`, summary];
		const divider = theme.fg("borderMuted", "─".repeat(Math.max(0, width)));
		return [...lines.map((line) => truncateLine(line, width)), divider];
	}

	private summaryKind(): DoctorStatus {
		if (this.data.summary.errors > 0) return "fail";
		if (this.data.summary.warnings > 0) return "warn";
		return "ok";
	}

	private renderBody(width: number): string[] {
		const lines: string[] = [];
		const labelWidth = this.computeLabelWidth();

		for (const section of this.data.sections) {
			lines.push(theme.bold(section.title));
			for (const line of section.lines) {
				const label = theme.fg("dim", line.label.padEnd(labelWidth));
				lines.push(`${statusMarker(line.status)} ${label} ${line.detail}`);
			}
			lines.push("");
		}

		if (this.data.resourceDiagnostics.length > 0) {
			lines.push(theme.bold("Diagnostic details"));
			for (const diagnostic of this.data.resourceDiagnostics.slice(0, 8)) {
				const marker = diagnostic.type === "error" ? statusMarker("fail") : statusMarker("warn");
				const path = diagnostic.path ? theme.fg("dim", ` (${diagnostic.path})`) : "";
				lines.push(`${marker} ${diagnostic.message}${path}`);
			}
			if (this.data.resourceDiagnostics.length > 8) {
				lines.push(theme.fg("dim", `  + ${this.data.resourceDiagnostics.length - 8} more diagnostics`));
			}
			lines.push("");
		}

		if (this.data.tip) {
			lines.push(theme.fg("dim", `Tip: ${this.data.tip}`));
		}

		return lines.map((line) => truncateLine(line, width));
	}

	private computeLabelWidth(): number {
		let max = 0;
		for (const section of this.data.sections) {
			for (const line of section.lines) {
				if (line.label.length > max) max = line.label.length;
			}
		}
		return Math.min(20, Math.max(8, max));
	}

	private renderFooter(width: number): string[] {
		const hints = [
			`${rawKeyHint("↑/↓", "Scroll")} · ${rawKeyHint("pgup/pgdown", "Page")} · ${rawKeyHint("ctrl+end", "Bottom")}`,
			`${rawKeyHint("ctrl+home", "Top")} · ${rawKeyHint("esc", "Close")}`,
		];
		const right = theme.fg("muted", "/status · /context · /usage");
		const bottom = `${hints[1]}${" ".repeat(Math.max(1, width - visibleWidth(hints[1]) - visibleWidth(right)))}${right}`;
		return [padVisible(truncateLine(hints[0], width), width), truncateLine(bottom, width)];
	}
}
