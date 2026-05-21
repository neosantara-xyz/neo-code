import { beforeAll, describe, expect, it } from "vitest";
import type { CompactionSummaryMessage } from "../src/core/messages.js";
import { CompactionSummaryMessageComponent } from "../src/modes/interactive/components/compaction-summary-message.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";
import { stripAnsi } from "../src/utils/ansi.js";

function renderPlain(component: CompactionSummaryMessageComponent): string {
	return stripAnsi(component.render(100).join("\n"));
}

describe("compaction summary message", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	it("updates the expand hint when the summary is expanded", () => {
		const message: CompactionSummaryMessage = {
			role: "compactionSummary",
			summary: "## Goal\nKeep the session going",
			tokensBefore: 123456,
			tokensAfter: 4321,
			summarizedMessages: 8,
			timestamp: Date.now(),
		};
		const component = new CompactionSummaryMessageComponent(message);

		expect(renderPlain(component)).toContain("expand summary");
		expect(renderPlain(component)).not.toContain("Keep the session going");

		component.setExpanded(true);

		const expanded = renderPlain(component);
		expect(expanded).toContain("collapse summary");
		expect(expanded).toContain("Keep the session going");
	});
});
