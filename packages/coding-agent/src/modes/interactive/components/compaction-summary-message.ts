import { Box, Markdown, type MarkdownTheme, Spacer, Text } from "@neosantara/tui";
import type { CompactionSummaryMessage } from "../../../core/messages.js";
import { getMarkdownTheme, theme } from "../theme/theme.js";
import { keyText } from "./keybinding-hints.js";

/**
 * Component that renders a compaction message with collapsed/expanded state.
 * Uses same background color as custom messages for visual consistency.
 */
export class CompactionSummaryMessageComponent extends Box {
	private expanded = false;
	private message: CompactionSummaryMessage;
	private markdownTheme: MarkdownTheme;

	constructor(message: CompactionSummaryMessage, markdownTheme: MarkdownTheme = getMarkdownTheme()) {
		super(1, 1, (t) => theme.bg("customMessageBg", t));
		this.message = message;
		this.markdownTheme = markdownTheme;
		this.updateDisplay();
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
		this.updateDisplay();
	}

	override invalidate(): void {
		super.invalidate();
		this.updateDisplay();
	}

	private updateDisplay(): void {
		this.clear();

		const before = this.message.tokensBefore.toLocaleString();
		const after = this.message.tokensAfter;
		const summarized = this.message.summarizedMessages;
		const label = theme.fg("customMessageLabel", `\x1b[1m✦ Compacted context\x1b[22m`);
		this.addChild(new Text(label, 0, 0));
		this.addChild(new Spacer(1));

		const rows = [
			`  ├─ before ${before} tokens`,
			after !== undefined ? `  ├─ after ~${after.toLocaleString()} tokens` : undefined,
			summarized !== undefined
				? `  ├─ summarized ${summarized.toLocaleString()} message${summarized === 1 ? "" : "s"}`
				: undefined,
			this.expanded
				? `  └─ ${keyText("app.tools.expand")} collapse summary`
				: `  └─ ${keyText("app.tools.expand")} expand summary`,
		]
			.filter((row): row is string => Boolean(row))
			.map((row) => theme.fg("customMessageText", row))
			.join("\n");

		this.addChild(new Text(rows, 0, 0));

		if (this.expanded) {
			this.addChild(new Spacer(1));
			this.addChild(
				new Markdown(this.message.summary, 0, 0, this.markdownTheme, {
					color: (text: string) => theme.fg("customMessageText", text),
				}),
			);
		}
	}
}
