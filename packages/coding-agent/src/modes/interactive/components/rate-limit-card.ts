import { type Component, type Focusable, getKeybindings, Text, visibleWidth } from "@neosantara-xyz/tui";
import { spawn } from "child_process";
import type { RateLimitActionRequiredEvent } from "../../../core/agent-session.js";
import { theme } from "../theme/theme.js";

// ===========================================================================
// Layout constants (mirror tool-approval-request.ts sizing)
// ===========================================================================

const CARD_WIDTH = 78;
const CONTENT_WIDTH = CARD_WIDTH - 4;

type CardState = "pending" | "billing" | "compacting" | "dismissed";

// ===========================================================================
// Pure render helpers
// ===========================================================================

function truncateVisible(input: string, max: number): string {
	if (visibleWidth(input) <= max) return input;
	let out = "";
	for (const char of input) {
		if (visibleWidth(`${out}${char}…`) > max) break;
		out += char;
	}
	return `${out}…`;
}

function renderLine(content: string): string {
	return `  ${truncateVisible(content, CONTENT_WIDTH)}`;
}

function borderColor(event: RateLimitActionRequiredEvent): "warning" | "error" {
	return event.limitType === "BALANCE" ? "error" : "warning";
}

function cardTitle(event: RateLimitActionRequiredEvent): string {
	switch (event.limitType) {
		case "RPM":
			return "Rate Limit — Requests";
		case "ITPM":
			return "Rate Limit — Input Tokens";
		case "OTPM":
			return "Rate Limit — Output Tokens";
		case "BALANCE":
			return "Insufficient Balance";
	}
}

function renderTopBorder(event: RateLimitActionRequiredEvent): string {
	const title = cardTitle(event);
	const color = borderColor(event);
	const remaining = Math.max(1, CARD_WIDTH - visibleWidth(`╭─ ${title} `) - 1);
	return theme.fg(color, `╭─ ${title} ${"─".repeat(remaining)}╮`);
}

function renderBottomBorder(event: RateLimitActionRequiredEvent): string {
	return theme.fg(borderColor(event), `╰${"─".repeat(CARD_WIDTH - 2)}╯`);
}

type CardOption = {
	key: string;
	label: string;
	hint: string;
};

function buildOptions(event: RateLimitActionRequiredEvent): CardOption[] {
	const options: CardOption[] = [
		{
			key: "1",
			label: "Open billing page",
			hint: "add your balance",
		},
	];
	if (event.canCompact) {
		options.push({
			key: "2",
			label: "Compact context",
			hint: "reduce tokens and retry",
		});
	}
	options.push({
		key: event.canCompact ? "3" : "2",
		label: "Dismiss",
		hint: "close this card",
	});
	return options;
}

function renderOption(option: CardOption, selected: boolean): string {
	const marker = selected ? theme.fg("accent", "›") : " ";
	const key = selected ? theme.bold(option.key) : option.key;
	const label = selected ? theme.bold(option.label) : option.label;
	const labelPad = label + " ".repeat(Math.max(0, 26 - visibleWidth(label)));
	return renderLine(truncateVisible(`${marker} ${key}. ${labelPad} ${theme.fg("dim", option.hint)}`, CONTENT_WIDTH));
}

function renderCard(event: RateLimitActionRequiredEvent, state: CardState, selectedIndex: number): string {
	const lines: string[] = [];
	lines.push(renderTopBorder(event));

	// Message line
	const msg = truncateVisible(event.message, CONTENT_WIDTH);
	lines.push(renderLine(theme.bold(msg)));

	// Retry-after hint
	if (event.retryAfterSeconds !== undefined && event.retryAfterSeconds > 0) {
		lines.push(renderLine(theme.fg("dim", `Resets in ~${event.retryAfterSeconds}s`)));
	}

	lines.push(renderLine(""));

	if (state === "pending") {
		const options = buildOptions(event);
		for (let i = 0; i < options.length; i++) {
			lines.push(renderOption(options[i]!, i === selectedIndex));
		}
		lines.push(renderLine(""));
		lines.push(renderLine(theme.fg("dim", "↑/↓ select · Enter confirm · Esc dismiss")));
	} else if (state === "billing") {
		lines.push(renderLine(theme.fg("success", "✓ Opened billing page in browser")));
	} else if (state === "compacting") {
		lines.push(renderLine(theme.fg("success", "✓ Compaction started")));
	} else {
		lines.push(renderLine(theme.fg("dim", "Dismissed")));
	}

	lines.push(renderBottomBorder(event));
	return lines.join("\n");
}

// ===========================================================================
// Component
// ===========================================================================

export class RateLimitCardComponent implements Component, Focusable {
	focused = false;

	private readonly text: Text;
	private state: CardState = "pending";
	private selectedIndex = 0;
	private readonly options: CardOption[];

	constructor(
		private readonly event: RateLimitActionRequiredEvent,
		private readonly onCompact: () => void,
		private readonly onDismiss: () => void,
	) {
		this.options = buildOptions(event);
		this.text = new Text(this.render_(0), 1, 0);
	}

	handleInput(input: string): void {
		if (this.state !== "pending") return;
		const kb = getKeybindings();

		if (kb.matches(input, "tui.select.cancel")) {
			this.dismiss();
			return;
		}
		if (kb.matches(input, "tui.select.up")) {
			this.selectedIndex = (this.selectedIndex + this.options.length - 1) % this.options.length;
			this.refresh();
			return;
		}
		if (kb.matches(input, "tui.select.down")) {
			this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
			this.refresh();
			return;
		}
		if (kb.matches(input, "tui.select.confirm")) {
			this.choose(this.options[this.selectedIndex]!);
			return;
		}
		// Quick-key: numeric character matching option key
		const matched = this.options.find((o) => o.key === input.trim());
		if (matched) {
			this.choose(matched);
		}
	}

	invalidate(): void {
		this.text.invalidate();
	}

	render(width: number): string[] {
		return this.text.render(width);
	}

	private render_(_width: number): string {
		return renderCard(this.event, this.state, this.selectedIndex);
	}

	private refresh(): void {
		this.text.setText(this.render_(0));
	}

	private choose(option: CardOption): void {
		if (option.label === "Open billing page") {
			this.openBilling();
		} else if (option.label === "Compact context") {
			this.compact();
		} else {
			this.dismiss();
		}
	}

	private openBilling(): void {
		this.state = "billing";
		this.refresh();
		const url = "https://app.neosantara.xyz/billing";
		if (process.platform === "darwin") {
			spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
		} else if (process.platform === "win32") {
			spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
		} else {
			spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
		}
		this.onDismiss();
	}

	private compact(): void {
		this.state = "compacting";
		this.refresh();
		this.onCompact();
	}

	private dismiss(): void {
		this.state = "dismissed";
		this.refresh();
		this.onDismiss();
	}
}
