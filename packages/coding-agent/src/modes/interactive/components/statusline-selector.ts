/**
 * Configuration picker for the interactive footer's status line.
 *
 * Lists every {@link StatuslineItemId} from `core/statusline.ts` with its
 * current enabled flag and order. Users can:
 *
 * - Navigate with `Up`/`Down` (or `k`/`j`).
 * - Toggle on/off with `Space`.
 * - Reorder with `[` (move up) and `]` (move down).
 * - Confirm with `Enter` to persist the configuration via the supplied
 *   `onSubmit` callback.
 * - Cancel with `Esc` (no-op on settings).
 *
 * The picker takes a snapshot of the current configuration at construction
 * time and operates on that copy until submit/cancel, so the live footer
 * keeps rendering its previous state until the user explicitly saves.
 */

import { Container, getKeybindings, Spacer, Text, truncateToWidth } from "@neosantara-xyz/tui";
import {
	getStatuslineItemMetadata,
	normalizeStatuslineItems,
	type StatuslineItemConfig,
} from "../../../core/statusline.js";
import { theme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";
import { keyHint, rawKeyHint } from "./keybinding-hints.js";

const HINT_LINE_WIDTH = 80;

export interface StatuslineSelectorOptions {
	title?: string;
}

export class StatuslineSelectorComponent extends Container {
	private items: StatuslineItemConfig[];
	private cursor = 0;
	private listContainer: Container;
	private hintContainer: Container;
	private onSubmitCallback: (items: StatuslineItemConfig[]) => void;
	private onCancelCallback: () => void;

	constructor(
		current: StatuslineItemConfig[],
		onSubmit: (items: StatuslineItemConfig[]) => void,
		onCancel: () => void,
		options?: StatuslineSelectorOptions,
	) {
		super();
		// Defensive copy so the picker mutates its own snapshot only.
		this.items = normalizeStatuslineItems(current);
		this.onSubmitCallback = onSubmit;
		this.onCancelCallback = onCancel;

		this.addChild(new DynamicBorder());
		this.addChild(new Spacer(1));

		const title = options?.title ?? "Status line items";
		this.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));
		this.addChild(
			new Text(theme.fg("dim", "Toggle which items appear in the footer status line and reorder them."), 1, 0),
		);
		this.addChild(new Spacer(1));

		this.listContainer = new Container();
		this.addChild(this.listContainer);
		this.addChild(new Spacer(1));

		this.hintContainer = new Container();
		this.addChild(this.hintContainer);
		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder());

		this.refreshList();
		this.refreshHint();
	}

	private refreshList(): void {
		this.listContainer.clear();
		for (let i = 0; i < this.items.length; i++) {
			const item = this.items[i]!;
			const meta = getStatuslineItemMetadata(item.id);
			const isCursor = i === this.cursor;
			const checkbox = item.enabled ? theme.fg("success", "[x]") : theme.fg("dim", "[ ]");
			const cursorMark = isCursor ? theme.fg("accent", "→") : " ";
			const labelColor = item.enabled ? "text" : "dim";
			const labelText = theme.fg(labelColor, meta.label);
			const description = theme.fg("dim", meta.description);
			const orderHint = theme.fg("muted", `${String(i + 1).padStart(2, " ")}.`);
			const line = `${cursorMark} ${orderHint} ${checkbox} ${labelText} ${description}`;
			this.listContainer.addChild(new Text(truncateToWidth(line, HINT_LINE_WIDTH, "..."), 1, 0));
		}
	}

	private refreshHint(): void {
		this.hintContainer.clear();
		this.hintContainer.addChild(
			new Text(
				[
					rawKeyHint("↑↓", "navigate"),
					rawKeyHint("space", "toggle"),
					rawKeyHint("[ ]", "reorder"),
					keyHint("tui.select.confirm", "save"),
					keyHint("tui.select.cancel", "cancel"),
				].join("  "),
				1,
				0,
			),
		);
	}

	private moveCursor(delta: number): void {
		if (this.items.length === 0) return;
		this.cursor = Math.max(0, Math.min(this.items.length - 1, this.cursor + delta));
		this.refreshList();
	}

	private toggleCurrent(): void {
		const current = this.items[this.cursor];
		if (!current) return;
		this.items[this.cursor] = { ...current, enabled: !current.enabled };
		this.refreshList();
	}

	private moveItem(delta: -1 | 1): void {
		const fromIndex = this.cursor;
		const toIndex = fromIndex + delta;
		if (toIndex < 0 || toIndex >= this.items.length) return;
		const moved = this.items[fromIndex]!;
		const replaced = this.items[toIndex]!;
		this.items[toIndex] = moved;
		this.items[fromIndex] = replaced;
		this.cursor = toIndex;
		this.refreshList();
	}

	handleInput(keyData: string): void {
		const kb = getKeybindings();
		if (kb.matches(keyData, "tui.select.up") || keyData === "k") {
			this.moveCursor(-1);
			return;
		}
		if (kb.matches(keyData, "tui.select.down") || keyData === "j") {
			this.moveCursor(1);
			return;
		}
		if (keyData === " ") {
			this.toggleCurrent();
			return;
		}
		if (keyData === "[") {
			this.moveItem(-1);
			return;
		}
		if (keyData === "]") {
			this.moveItem(1);
			return;
		}
		if (kb.matches(keyData, "tui.select.confirm") || keyData === "\n" || keyData === "\r") {
			this.onSubmitCallback([...this.items]);
			return;
		}
		if (kb.matches(keyData, "tui.select.cancel")) {
			this.onCancelCallback();
		}
	}

	/** Snapshot of the in-flight configuration. Useful for tests. */
	getCurrentItems(): StatuslineItemConfig[] {
		return this.items.map((item) => ({ ...item }));
	}
}
