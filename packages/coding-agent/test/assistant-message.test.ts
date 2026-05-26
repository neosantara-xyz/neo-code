import type { AssistantMessage } from "@neosantara/ai";
import { beforeAll, describe, expect, it } from "vitest";
import { AssistantMessageComponent } from "../src/modes/interactive/components/assistant-message.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";
import { stripAnsi } from "../src/utils/ansi.js";

function assistantMessage(content: AssistantMessage["content"]): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "openai-responses",
		provider: "neosantara",
		model: "neo-test",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				total: 0,
			},
		},
		stopReason: "stop",
		timestamp: 0,
	};
}

describe("AssistantMessageComponent", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	it("hides raw thinking content by default", () => {
		const component = new AssistantMessageComponent(
			assistantMessage([
				{ type: "thinking", thinking: 'User meminta untuk "explore projectnya". Saya perlu membaca file.' },
				{ type: "text", text: "Project ini berisi beberapa package." },
			]),
		);

		const rendered = stripAnsi(component.render(100).join("\n"));

		expect(rendered).toContain("Thinking...");
		expect(rendered).toContain("Project ini berisi beberapa package.");
		expect(rendered).not.toContain("User meminta");
		expect(rendered).not.toContain("Saya perlu membaca file");
	});
});
