/**
 * Multi-step picker for the `/review` slash command.
 *
 * Modeled on Codex's `open_review_popup` flow:
 *   Step 1 — pick a target preset (uncommitted, base branch, commit, custom).
 *   Step 2 — when applicable, pick a branch / commit from a sub-list.
 *
 * The component owns its own navigation. Callers supply an `onSelect`
 * callback that receives the resolved {@link ReviewTarget} once the user
 * confirms, and an `onCancel` callback for `Esc`.
 */

import { Container, getKeybindings, Spacer, Text, truncateToWidth } from "@neosantara/tui";
import type { BranchInfo, CommitInfo, ReviewTarget } from "../../../core/review/index.js";
import { theme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";
import { keyHint, rawKeyHint } from "./keybinding-hints.js";

type Step =
	| { kind: "presets" }
	| { kind: "branch"; branches: BranchInfo[] }
	| { kind: "commit"; commits: CommitInfo[] }
	| { kind: "pull-request" };

export interface ReviewSelectorOptions {
	branches: BranchInfo[];
	commits: CommitInfo[];
	cwd: string;
}

export class ReviewSelectorComponent extends Container {
	private step: Step;
	private cursor = 0;
	private listContainer: Container;
	private titleText: Text;
	private hintContainer: Container;
	private onSelectCallback: (target: ReviewTarget) => void;
	private onCancelCallback: () => void;
	private readonly options: ReviewSelectorOptions;
	private prompt = "";

	constructor(options: ReviewSelectorOptions, onSelect: (target: ReviewTarget) => void, onCancel: () => void) {
		super();
		this.options = options;
		this.onSelectCallback = onSelect;
		this.onCancelCallback = onCancel;
		this.step = { kind: "presets" };

		this.addChild(new DynamicBorder());
		this.addChild(new Spacer(1));

		this.titleText = new Text("", 1, 0);
		this.addChild(this.titleText);
		this.addChild(new Spacer(1));

		this.listContainer = new Container();
		this.addChild(this.listContainer);
		this.addChild(new Spacer(1));

		this.hintContainer = new Container();
		this.addChild(this.hintContainer);
		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder());

		this.refresh();
	}

	private refresh(): void {
		this.refreshTitle();
		this.refreshList();
		this.refreshHint();
	}

	private refreshTitle(): void {
		const title =
			this.step.kind === "presets"
				? "Select a review preset"
				: this.step.kind === "branch"
					? "Select a base branch"
					: this.step.kind === "commit"
						? "Select a commit"
						: "Custom review instructions";
		this.titleText.setText(theme.fg("accent", theme.bold(title)));
	}

	private getPresetOptions(): Array<{ label: string; description?: string }> {
		const branchCount = this.options.branches.length;
		const commitCount = this.options.commits.length;
		return [
			{
				label: "Review uncommitted changes",
				description: "Staged, unstaged, and untracked files in the working tree",
			},
			{
				label: "Review against a base branch",
				description: branchCount > 0 ? "PR-style diff vs. another local branch" : "(no local branches detected)",
			},
			{
				label: "Review a commit",
				description: commitCount > 0 ? "Pick a recent commit by subject" : "(git log returned no commits)",
			},
			{
				label: "Review a GitHub pull request",
				description: "Type the PR number; uses gh if available",
			},
			{
				label: "Custom review instructions",
				description: "Free-form prompt for ad-hoc reviews",
			},
		];
	}

	private refreshList(): void {
		this.listContainer.clear();
		const items = this.currentListItems();
		const maxVisible = 12;
		const start = Math.min(
			Math.max(0, this.cursor - Math.floor(maxVisible / 2)),
			Math.max(0, items.length - maxVisible),
		);
		const end = Math.min(items.length, start + maxVisible);

		if (this.step.kind === "pull-request") {
			this.listContainer.addChild(new Text(theme.fg("dim", "Type a PR number and press Enter."), 1, 0));
			this.listContainer.addChild(
				new Text(`${theme.fg("accent", "PR #")}${this.prompt}${theme.fg("dim", "_")}`, 1, 0),
			);
			return;
		}

		for (let i = start; i < end; i++) {
			const item = items[i]!;
			const isSelected = i === this.cursor;
			const cursorMark = isSelected ? theme.fg("accent", "→") : " ";
			const label = isSelected ? theme.fg("accent", item.label) : theme.fg("text", item.label);
			const description = item.description ? `  ${theme.fg("dim", item.description)}` : "";
			this.listContainer.addChild(
				new Text(truncateToWidth(`${cursorMark} ${label}${description}`, 100, "..."), 1, 0),
			);
		}
		if (items.length === 0) {
			this.listContainer.addChild(new Text(theme.fg("dim", "(no entries available)"), 1, 0));
		}
	}

	private currentListItems(): Array<{ label: string; description?: string }> {
		switch (this.step.kind) {
			case "presets":
				return this.getPresetOptions();
			case "branch":
				return this.step.branches.map((branch) => ({
					label: branch.isCurrent ? `${branch.name} (current)` : branch.name,
				}));
			case "commit":
				return this.step.commits.map((commit) => ({
					label: commit.subject,
					description: `${commit.sha.slice(0, 7)} · ${commit.relativeDate}`,
				}));
			case "pull-request":
				return [];
		}
	}

	private refreshHint(): void {
		this.hintContainer.clear();
		const hints =
			this.step.kind === "pull-request"
				? [
						rawKeyHint("0-9", "PR number"),
						keyHint("tui.select.confirm", "review"),
						keyHint("tui.select.cancel", "cancel"),
					]
				: [
						rawKeyHint("↑↓", "navigate"),
						keyHint("tui.select.confirm", "select"),
						keyHint("tui.select.cancel", this.step.kind === "presets" ? "cancel" : "back"),
					];
		this.hintContainer.addChild(new Text(hints.join("  "), 1, 0));
	}

	private moveCursor(delta: number): void {
		const items = this.currentListItems();
		if (items.length === 0) return;
		this.cursor = Math.max(0, Math.min(items.length - 1, this.cursor + delta));
		this.refreshList();
	}

	private confirm(): void {
		switch (this.step.kind) {
			case "presets":
				this.confirmPreset();
				break;
			case "branch":
				this.confirmBranch();
				break;
			case "commit":
				this.confirmCommit();
				break;
			case "pull-request":
				this.confirmPullRequest();
				break;
		}
	}

	private confirmPreset(): void {
		switch (this.cursor) {
			case 0:
				this.onSelectCallback({ kind: "uncommitted" });
				return;
			case 1:
				if (this.options.branches.length === 0) return;
				this.step = { kind: "branch", branches: this.options.branches };
				this.cursor = 0;
				this.refresh();
				return;
			case 2:
				if (this.options.commits.length === 0) return;
				this.step = { kind: "commit", commits: this.options.commits };
				this.cursor = 0;
				this.refresh();
				return;
			case 3:
				this.step = { kind: "pull-request" };
				this.prompt = "";
				this.cursor = 0;
				this.refresh();
				return;
			case 4: {
				// Custom: bail out here and ask the caller to launch a free-form
				// prompt elsewhere by emitting a stub `custom` target with empty
				// instructions. The caller checks for empty instructions and
				// opens its own input flow.
				this.onSelectCallback({ kind: "custom", instructions: "" });
				return;
			}
		}
	}

	private confirmBranch(): void {
		if (this.step.kind !== "branch") return;
		const branch = this.step.branches[this.cursor];
		if (!branch) return;
		this.onSelectCallback({ kind: "base-branch", branch: branch.name });
	}

	private confirmCommit(): void {
		if (this.step.kind !== "commit") return;
		const commit = this.step.commits[this.cursor];
		if (!commit) return;
		this.onSelectCallback({ kind: "commit", sha: commit.sha, title: commit.subject });
	}

	private confirmPullRequest(): void {
		const number = Number.parseInt(this.prompt, 10);
		if (!Number.isFinite(number) || number <= 0) return;
		this.onSelectCallback({ kind: "pull-request", number });
	}

	private goBack(): void {
		if (this.step.kind === "presets") {
			this.onCancelCallback();
			return;
		}
		this.step = { kind: "presets" };
		this.cursor = 0;
		this.prompt = "";
		this.refresh();
	}

	handleInput(keyData: string): void {
		const kb = getKeybindings();

		if (this.step.kind === "pull-request") {
			if (kb.matches(keyData, "tui.select.cancel")) {
				this.goBack();
				return;
			}
			if (kb.matches(keyData, "tui.select.confirm") || keyData === "\n" || keyData === "\r") {
				this.confirm();
				return;
			}
			if (keyData === "\u007F" || keyData === "\b") {
				this.prompt = this.prompt.slice(0, -1);
				this.refresh();
				return;
			}
			if (/^[0-9]$/.test(keyData) && this.prompt.length < 8) {
				this.prompt += keyData;
				this.refresh();
				return;
			}
			return;
		}

		if (kb.matches(keyData, "tui.select.up") || keyData === "k") {
			this.moveCursor(-1);
			return;
		}
		if (kb.matches(keyData, "tui.select.down") || keyData === "j") {
			this.moveCursor(1);
			return;
		}
		if (kb.matches(keyData, "tui.select.confirm") || keyData === "\n" || keyData === "\r") {
			this.confirm();
			return;
		}
		if (kb.matches(keyData, "tui.select.cancel")) {
			this.goBack();
		}
	}
}
