import { resolve } from "node:path";
import type { Component } from "@neosantara/tui";
import { truncateToWidth, visibleWidth } from "@neosantara/tui";
import { APP_TITLE } from "../../../config.js";
import { theme } from "../theme/theme.js";

export interface WelcomeScreenOptions {
	version: string;
	modelLabel: string;
	cwdLabel: string;
	modeLabel: string;
	compactHints: string;
	expandedHints: string;
	expandHint: string;
	changelogMarkdown?: string;
	projectWarning?: string;
	recentActivity?: string[];
	expanded?: boolean;
}

interface FeedSection {
	title: string;
	lines: string[];
}

const MAX_BOX_WIDTH = 118;
const MAX_NARROW_BOX_WIDTH = 92;
const MIN_BOX_WIDTH = 32;
const MIN_WIDE_WIDTH = 104;
const LEFT_COLUMN_WIDTH = 50;
const MIN_RIGHT_COLUMN_WIDTH = 34;

const NEO_KANCI_MASCOT_BODY = [
	"  ▄██▄   ▄██▄",
	" ██░░██▄██░░██",
	" ██░░█████░░██",
	"   ███ >_ ███",
	"  ██  ▐▌ ▐▌ ██",
	"  ▀██▄███▄██▀",
	"     ▀▀▀▀▀",
];

export class WelcomeScreenComponent implements Component {
	private expanded: boolean;

	constructor(private readonly options: WelcomeScreenOptions) {
		this.expanded = options.expanded ?? false;
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
	}

	hasChangelogHeadline(): boolean {
		return getChangelogHeadline(this.options.changelogMarkdown) !== undefined;
	}

	invalidate(): void {
		// No cached state to invalidate.
	}

	render(width: number): string[] {
		const feedSections = this.getFeedSections();
		if (this.shouldRenderCondensed(width, feedSections)) {
			return this.renderCondensed(width);
		}

		if (this.shouldRenderWide(width, feedSections)) {
			return this.renderWide(width, feedSections);
		}

		return this.renderNarrow(width, feedSections);
	}

	private shouldRenderCondensed(width: number, feedSections: FeedSection[]): boolean {
		// Claude Code keeps the welcome identity visible on normal terminals. Only
		// collapse to a tiny card when the terminal is too narrow for the mascot and
		// context rows to remain readable.
		return width < 52 && !this.expanded && feedSections.length === 0;
	}

	private shouldRenderWide(width: number, feedSections: FeedSection[]): boolean {
		return width >= MIN_WIDE_WIDTH && (this.expanded || feedSections.length > 0);
	}

	private renderCondensed(width: number): string[] {
		const boxWidth = Math.max(MIN_BOX_WIDTH, Math.min(MAX_NARROW_BOX_WIDTH, width));
		const innerWidth = Math.max(1, boxWidth - 4);
		const lines: string[] = [];

		lines.push(this.renderTopBorder(boxWidth));
		lines.push(
			this.renderLine(
				`${theme.bold("Welcome to Neo Code")} ${theme.fg("muted", "·")} ${this.options.cwdLabel}`,
				innerWidth,
			),
		);
		lines.push(
			this.renderLine(`${this.options.modeLabel} ${theme.fg("dim", "·")} ${this.options.modelLabel}`, innerWidth),
		);
		lines.push(this.renderLine(this.options.compactHints, innerWidth));
		lines.push(this.renderBottomBorder(boxWidth));
		return lines;
	}

	private renderNarrow(width: number, feedSections: FeedSection[]): string[] {
		const boxWidth = Math.max(MIN_BOX_WIDTH, Math.min(MAX_NARROW_BOX_WIDTH, width));
		const innerWidth = Math.max(1, boxWidth - 4);
		const lines: string[] = [];

		lines.push(this.renderTopBorder(boxWidth));
		for (const line of this.getBrandLines()) {
			lines.push(this.renderLine(line, innerWidth));
		}
		lines.push(this.renderDivider("Context", boxWidth));
		for (const line of this.getContextLines()) {
			lines.push(this.renderLine(line, innerWidth));
		}

		if (!this.expanded) {
			lines.push(this.renderDivider("Shortcuts", boxWidth));
			for (const line of this.getCompactShortcutLines()) {
				lines.push(this.renderLine(line, innerWidth));
			}
		}

		for (const section of feedSections) {
			lines.push(this.renderDivider(section.title, boxWidth));
			for (const line of section.lines) {
				lines.push(this.renderLine(line, innerWidth));
			}
		}

		lines.push(this.renderBottomBorder(boxWidth));
		return lines;
	}

	private renderWide(width: number, feedSections: FeedSection[]): string[] {
		const boxWidth = Math.max(MIN_WIDE_WIDTH, Math.min(MAX_BOX_WIDTH, width));
		const innerWidth = Math.max(1, boxWidth - 4);
		const leftWidth = Math.min(LEFT_COLUMN_WIDTH, Math.max(36, innerWidth - MIN_RIGHT_COLUMN_WIDTH - 3));
		const rightWidth = Math.max(MIN_RIGHT_COLUMN_WIDTH, innerWidth - leftWidth - 3);
		const leftLines = this.getWideLeftLines();
		const rightLines = flattenFeedSections(feedSections);
		const rowCount = Math.max(leftLines.length, rightLines.length);
		const lines: string[] = [];

		lines.push(this.renderTopBorder(boxWidth));
		lines.push(
			this.renderWideLine(theme.bold("Welcome to Neo Code"), theme.fg("muted", "Guide"), leftWidth, rightWidth),
		);
		lines.push(this.renderWideDivider("Context", "Next", leftWidth, rightWidth));

		for (let index = 0; index < rowCount; index += 1) {
			lines.push(this.renderWideLine(leftLines[index] ?? "", rightLines[index] ?? "", leftWidth, rightWidth));
		}

		lines.push(this.renderBottomBorder(boxWidth));
		return lines;
	}

	private getBrandLines(): string[] {
		return [
			...getNeoKanciMascotLines(),
			"",
			theme.bold("Welcome to Neo Code"),
			theme.fg("muted", "Neosantara-first coding agent for your project terminal."),
			theme.fg("dim", "Ask, inspect, edit, run checks, and keep context visible."),
		];
	}

	private getContextLines(): string[] {
		return [
			this.formatLabelValue("Model", this.options.modelLabel),
			this.formatLabelValue("Project", this.options.cwdLabel),
			this.formatLabelValue(
				"Mode",
				`${this.options.modeLabel} · ${theme.fg("dim", "Shift+Tab cycles Default → Accept edits → Plan")}`,
			),
		];
	}

	private getWideLeftLines(): string[] {
		const lines = [
			...getNeoKanciMascotLines(),
			"",
			theme.fg("muted", "Neosantara-first coding agent for your project terminal."),
			"",
			...this.getContextLines(),
		];

		if (this.expanded) {
			lines.push("", theme.fg("muted", "Shortcuts"));
			for (const hint of splitNonEmptyLines(this.options.expandedHints).slice(0, 8)) {
				lines.push(hint);
			}
		} else {
			lines.push("", this.options.compactHints, this.options.expandHint);
		}

		return lines;
	}

	private getCompactShortcutLines(): string[] {
		return [this.options.compactHints, this.options.expandHint];
	}

	private getFeedSections(): FeedSection[] {
		const sections: FeedSection[] = [];
		const recentActivity = (this.options.recentActivity ?? []).filter((line) => line.trim().length > 0);
		const headline = getChangelogHeadline(this.options.changelogMarkdown);
		const tipLines = this.getTipLines();

		if (headline) {
			sections.push({ title: "What's new", lines: [headline, theme.fg("dim", "/changelog for more")] });
		}

		if (recentActivity.length > 0) {
			sections.push({ title: "Recent", lines: recentActivity.slice(0, 3) });
		}

		if (tipLines.length > 0) {
			sections.push({ title: "Tips for getting started", lines: tipLines });
		}

		return sections;
	}

	private getTipLines(): string[] {
		if (this.expanded) {
			return [
				...splitNonEmptyLines(this.options.expandedHints),
				"",
				`${theme.fg("dim", "/mode plan")} ${theme.fg("muted", "inspect first, then approve the plan")}`,
				`${theme.fg("dim", "/changelog")} ${theme.fg("muted", "see what changed after updates")}`,
				`${theme.fg("dim", "ask")}: ${theme.fg("muted", "explore this repo and suggest improvements")}`,
			].filter((line) => line.trim().length > 0);
		}

		if (this.options.projectWarning) {
			return [`${theme.fg("warning", "Note:")} ${theme.fg("muted", this.options.projectWarning)}`];
		}

		return [];
	}

	private renderTopBorder(width: number): string {
		const title = theme.bold(theme.fg("accent", `${APP_TITLE} v${this.options.version}`));
		return renderTitledBorder("╭", "╮", title, width);
	}

	private renderBottomBorder(width: number): string {
		const label = theme.fg("success", "ready");
		return renderTitledBorder("╰", "╯", label, width);
	}

	private renderDivider(label: string, width: number): string {
		return renderTitledBorder("├", "┤", theme.fg("muted", label), width);
	}

	private renderWideDivider(leftLabel: string, rightLabel: string, leftWidth: number, rightWidth: number): string {
		const left = renderSegment(theme.fg("muted", ` ${leftLabel} `), leftWidth + 1, "─");
		const right = renderSegment(theme.fg("muted", ` ${rightLabel} `), rightWidth, "─");
		return `${theme.fg("accent", "├─")}${left}${theme.fg("accent", "┬")}${right}${theme.fg("accent", "─┤")}`;
	}

	private renderLine(content: string, innerWidth: number): string {
		return `${theme.fg("accent", "│")} ${truncateToWidth(content, innerWidth, "…", true)} ${theme.fg("accent", "│")}`;
	}

	private renderWideLine(leftContent: string, rightContent: string, leftWidth: number, rightWidth: number): string {
		const left = padVisible(truncateToWidth(leftContent, leftWidth, "…", true), leftWidth);
		const right = padVisible(truncateToWidth(rightContent, rightWidth, "…", true), rightWidth);
		return `${theme.fg("accent", "│")} ${left} ${theme.fg("accent", "│")} ${right} ${theme.fg("accent", "│")}`;
	}

	private formatLabelValue(label: string, value: string): string {
		const labelWidth = 7;
		const labelText = theme.fg("dim", label.padEnd(labelWidth));
		return `${labelText} ${value}`;
	}
}

function renderTitledBorder(left: string, right: string, title: string, width: number): string {
	const start = `${theme.fg("accent", left)}─ ${title} `;
	const remaining = Math.max(1, width - visibleWidth(start) - visibleWidth(right));
	return `${start}${theme.fg("accent", "─".repeat(remaining))}${theme.fg("accent", right)}`;
}

function padVisible(value: string, width: number): string {
	return `${value}${" ".repeat(Math.max(0, width - visibleWidth(value)))}`;
}

function renderSegment(label: string, width: number, fill: string): string {
	const visibleLabelWidth = visibleWidth(label);
	if (visibleLabelWidth >= width) {
		return truncateToWidth(label, width, "…", true);
	}
	return `${label} ${theme.fg("accent", fill.repeat(Math.max(0, width - visibleLabelWidth - 1)))}`;
}

function getNeoKanciMascotLines(): string[] {
	return NEO_KANCI_MASCOT_BODY.map((line) => colorNeoKanciLine(line));
}

function colorNeoKanciLine(line: string): string {
	let output = "";
	for (const char of line) {
		if (char === "█" || char === "▄" || char === "▀") {
			output += theme.fg("accent", char);
		} else if (char === "░") {
			output += theme.fg("dim", char);
		} else if (char === ">" || char === "_" || char === "▐" || char === "▌") {
			output += theme.fg("text", char);
		} else {
			output += char;
		}
	}
	return output;
}

function flattenFeedSections(sections: FeedSection[]): string[] {
	const lines: string[] = [];
	for (const section of sections) {
		if (lines.length > 0) lines.push("");
		lines.push(theme.fg("muted", section.title));
		lines.push(...section.lines);
	}
	return lines;
}

function splitNonEmptyLines(value: string): string[] {
	return value
		.split("\n")
		.map((line) => line.trimEnd())
		.filter((line) => line.trim().length > 0);
}

export function getChangelogHeadline(markdown: string | undefined): string | undefined {
	if (!markdown) return undefined;
	for (const rawLine of markdown.split("\n")) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const normalized = line
			.replace(/^[-*]\s+/, "")
			.replace(/^\d+\.\s+/, "")
			.trim();
		if (!normalized || normalized.startsWith("---")) continue;
		return `${theme.fg("dim", "Updated:")} ${theme.fg("muted", normalized)}`;
	}
	return undefined;
}

export function getHomeDirectoryWarning(cwd: string, homeDir: string): string | undefined {
	if (normalizePath(cwd) !== normalizePath(homeDir)) return undefined;
	return "You launched Neo Code from your home directory. For best Neosantara project context, run it inside a project folder instead.";
}

function normalizePath(value: string): string {
	return resolve(value).replace(/[\\/]+$/, "");
}
