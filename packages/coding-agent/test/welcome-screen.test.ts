import { beforeAll, describe, expect, it } from "vitest";
import {
	getChangelogHeadline,
	getHomeDirectoryWarning,
	WelcomeScreenComponent,
} from "../src/modes/interactive/components/welcome-screen.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";
import { stripAnsi } from "../src/utils/ansi.js";

function renderPlain(component: WelcomeScreenComponent, width = 88): string {
	return component
		.render(width)
		.map((line) => stripAnsi(line).trimEnd())
		.join("\n");
}

describe("welcome screen component", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	it("renders a Claude-style startup card with context and shortcuts on normal terminals", () => {
		const component = new WelcomeScreenComponent({
			version: "0.74.26",
			modelLabel: "Neosantara/grok-4.1-fast-non-reasoning",
			cwdLabel: "~/neo-code",
			modeLabel: "Default",
			compactHints: "Shift+Tab mode · / commands · ! bash · Ctrl+C interrupt",
			expandedHints: "Shift+Tab cycle mode\n/ commands",
			expandHint: "Press Ctrl+O to expand startup help and raw tool output.",
		});

		const rendered = renderPlain(component);

		expect(rendered).toContain("Neo Code v0.74.26");
		expect(rendered).toContain("Welcome to Neo Code");
		expect(rendered).toContain(">_");
		expect(rendered).toContain("Context");
		expect(rendered).toContain("Shortcuts");
		expect(rendered).toContain("Shift+Tab mode · / commands");
		expect(rendered).not.toContain("What's new");
		expect(rendered).toContain("ready");
	});

	it("condenses only on very narrow terminals", () => {
		const component = new WelcomeScreenComponent({
			version: "0.74.26",
			modelLabel: "model",
			cwdLabel: "~/neo-code",
			modeLabel: "Default",
			compactHints: "Shift+Tab mode",
			expandedHints: "Shift+Tab cycle mode\n/ commands",
			expandHint: "Press Ctrl+O to expand startup help.",
		});

		const lines = renderPlain(component, 48).split("\n");
		const rendered = lines.join("\n");

		expect(lines.length).toBe(5);
		expect(rendered).toContain("Welcome to Neo Code");
		expect(rendered).toContain("Default");
		expect(rendered).not.toContain("Context");
	});

	it("renders a narrow boxed welcome with context and changelog headline", () => {
		const component = new WelcomeScreenComponent({
			version: "0.74.25",
			modelLabel: "Neosantara/grok-4.1-fast-non-reasoning",
			cwdLabel: "~/neo-code",
			modeLabel: "Default",
			compactHints: "Shift+Tab mode · / commands · ! bash · Ctrl+C interrupt",
			expandedHints: "Shift+Tab cycle mode\n/ commands",
			expandHint: "Press Ctrl+O to expand startup help and raw tool output.",
			changelogMarkdown: "## 0.74.25\n- fix(welcome): dedupe release notes",
		});

		const rendered = renderPlain(component, 88);

		expect(rendered).toContain("Neo Code v0.74.25");
		expect(rendered).toContain("Welcome to Neo Code");
		expect(rendered).toContain(">_");
		expect(rendered).toContain("██");
		expect(rendered).not.toContain("/  \\_/  \\");
		expect(rendered).toContain("Context");
		expect(rendered).toContain("Model");
		expect(rendered).toContain("Project");
		expect(rendered).toContain("Mode");
		expect(rendered).toContain("Shift+Tab cycles Default → Accept edits → Plan");
		expect(rendered).toContain("What's new");
		expect(rendered).toContain("Updated: fix(welcome): dedupe release notes");
		expect(rendered).toContain("/changelog for more");
		expect(component.hasChangelogHeadline()).toBe(true);
	});

	it("renders a wide two-column welcome when feed content is present", () => {
		const component = new WelcomeScreenComponent({
			version: "0.74.26",
			modelLabel: "Neosantara/grok-4.1-fast-non-reasoning",
			cwdLabel: "~/neo-code",
			modeLabel: "Default",
			compactHints: "Shift+Tab mode · / commands · ! bash · Ctrl+C interrupt",
			expandedHints: "Ctrl+C interrupt\nShift+Tab cycle mode",
			expandHint: "Press Ctrl+O to expand startup help and raw tool output.",
			changelogMarkdown: "## 0.74.26\n- feat(welcome): add wide layout",
			recentActivity: ["Resumed session · 12 messages · 4 tool calls"],
		});

		const rendered = renderPlain(component, 118);

		expect(rendered).toContain("Welcome to Neo Code");
		expect(rendered).toContain(">_");
		expect(rendered).toContain("██");
		expect(rendered).toContain("Guide");
		expect(rendered).toContain("Context");
		expect(rendered).toContain("Next");
		expect(rendered).toContain("What's new");
		expect(rendered).toContain("Updated: feat(welcome): add wide layout");
		expect(rendered).toContain("Recent");
		expect(rendered).toContain("Resumed session · 12 messages · 4 tool calls");
	});

	it("switches to expanded shortcuts and try feed", () => {
		const component = new WelcomeScreenComponent({
			version: "0.74.25",
			modelLabel: "model",
			cwdLabel: "repo",
			modeLabel: "Default",
			compactHints: "compact only",
			expandedHints: "Ctrl+C interrupt\nShift+Tab cycle mode",
			expandHint: "expand hint",
		});

		component.setExpanded(true);
		const rendered = renderPlain(component, 88);

		expect(rendered).toContain("Tips for getting started");
		expect(rendered).toContain("Ctrl+C interrupt");
		expect(rendered).toContain("Shift+Tab cycle mode");
		expect(rendered).toContain("/mode plan");
		expect(rendered).toContain("/changelog");
		expect(rendered).not.toContain("compact only");
	});

	it("shows a Neosantara project warning when launched from the home directory", () => {
		const warning = getHomeDirectoryWarning("/home/biva", "/home/biva");
		const component = new WelcomeScreenComponent({
			version: "0.74.19",
			modelLabel: "model",
			cwdLabel: "~",
			modeLabel: "Default",
			compactHints: "compact",
			expandedHints: "expanded",
			expandHint: "expand",
			projectWarning: warning,
		});

		const rendered = renderPlain(component);

		expect(warning).toBe(
			"You launched Neo Code from your home directory. For best Neosantara project context, run it inside a project folder instead.",
		);
		expect(rendered).toContain("Tips for getting started");
		expect(rendered).toContain("Note: You launched Neo Code from your home directory");
		expect(getHomeDirectoryWarning("/home/biva/project", "/home/biva")).toBeUndefined();
	});

	it("shows resumed session activity when available", () => {
		const component = new WelcomeScreenComponent({
			version: "0.74.24",
			modelLabel: "model",
			cwdLabel: "repo",
			modeLabel: "Default",
			compactHints: "compact",
			expandedHints: "expanded",
			expandHint: "expand",
			recentActivity: ["Resumed session · 12 messages · 4 tool calls", "Context 31.0% used · /context for details"],
		});

		const rendered = renderPlain(component);

		expect(rendered).toContain("Recent");
		expect(rendered).toContain("Resumed session · 12 messages · 4 tool calls");
		expect(rendered).toContain("Context 31.0% used · /context for details");
	});

	it("extracts the first changelog item as a startup headline", () => {
		const headline = stripAnsi(getChangelogHeadline("## 0.74.15\n\n- fix(changelog): show notes") ?? "");

		expect(headline).toBe("Updated: fix(changelog): show notes");
	});
});
