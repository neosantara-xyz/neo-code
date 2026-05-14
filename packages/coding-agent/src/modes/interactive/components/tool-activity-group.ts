import { Container, Spacer, Text } from "@neosantara/tui";
import {
	formatToolActivityGroup,
	summarizeToolResult,
	type ToolActivityGroupItem,
	type ToolActivityResultSummary,
} from "../../../core/tools/tool-activity.js";
import { type ThemeColor, theme } from "../theme/theme.js";
import type { ToolExecutionComponent } from "./tool-execution.js";

interface ToolActivityGroupEntry extends ToolActivityGroupItem {
	component: ToolExecutionComponent;
}

function statusColor(summary: ToolActivityResultSummary | undefined, isRunning: boolean): ThemeColor {
	if (isRunning) return "accent";
	if (summary?.status === "error") return "error";
	if (summary?.status === "neutral") return "muted";
	return "success";
}

export class ToolActivityGroupComponent extends Container {
	private readonly summaryText: Text;
	private readonly rawContainer = new Container();
	private readonly items = new Map<string, ToolActivityGroupEntry>();
	private expanded = false;
	private showImages = true;
	private imageWidthCells = 60;

	constructor(expanded = false) {
		super();
		this.expanded = expanded;
		this.summaryText = new Text("", 1, 0);
		this.updateDisplay();
	}

	addTool(toolName: string, toolCallId: string, args: any, component: ToolExecutionComponent): void {
		const existing = this.items.get(toolCallId);
		if (existing) {
			existing.args = args;
			existing.component = component;
		} else {
			component.setExpanded(this.expanded);
			component.setShowImages(this.showImages);
			component.setImageWidthCells(this.imageWidthCells);
			this.rawContainer.addChild(component);
			this.items.set(toolCallId, {
				id: toolCallId,
				toolName,
				args,
				component,
				isPartial: true,
			});
		}
		this.updateDisplay();
	}

	updateToolArgs(toolCallId: string, args: any): void {
		const item = this.items.get(toolCallId);
		if (!item) return;
		item.args = args;
		item.component.updateArgs(args);
		this.updateDisplay();
	}

	markExecutionStarted(toolCallId: string): void {
		const item = this.items.get(toolCallId);
		if (!item) return;
		item.executionStarted = true;
		item.isPartial = true;
		item.component.markExecutionStarted();
		this.updateDisplay();
	}

	updateToolResult(
		toolCallId: string,
		result: {
			content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
			details?: any;
			isError: boolean;
		},
		isPartial = false,
	): void {
		const item = this.items.get(toolCallId);
		if (!item) return;
		item.result = result;
		item.isError = result.isError;
		item.isPartial = isPartial;
		item.component.updateResult(result, isPartial);
		this.updateDisplay();
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
		for (const item of this.items.values()) {
			item.component.setExpanded(expanded);
		}
		this.updateDisplay();
	}

	setShowImages(show: boolean): void {
		this.showImages = show;
		for (const item of this.items.values()) {
			item.component.setShowImages(show);
		}
	}

	setImageWidthCells(width: number): void {
		this.imageWidthCells = width;
		for (const item of this.items.values()) {
			item.component.setImageWidthCells(width);
		}
	}

	private updateDisplay(): void {
		this.clear();
		this.addChild(new Spacer(1));
		this.summaryText.setText(this.formatSummary());
		this.addChild(this.summaryText);
		if (this.expanded) {
			this.addChild(this.rawContainer);
		}
	}

	private formatSummary(): string {
		const snapshots = Array.from(this.items.values()).map((item) => ({
			id: item.id,
			toolName: item.toolName,
			args: item.args,
			result: item.result,
			isError: item.isError,
			isPartial: item.isPartial,
			executionStarted: item.executionStarted,
		}));
		const base = formatToolActivityGroup(snapshots);
		const coloredLines = base.split("\n").map((line, index) => {
			if (index === 0) return theme.fg("accent", theme.bold(line));
			const item = snapshots[index - 1];
			const summary = item?.result
				? summarizeToolResult(item.toolName, item.args, item.result, {
						isError: item.isError,
						isPartial: item.isPartial,
					})
				: undefined;
			const isRunning = !item?.result || item.isPartial === true;
			return theme.fg(statusColor(summary, isRunning), line);
		});
		if (!this.expanded) {
			coloredLines.push(theme.fg("dim", "  ⎿ Ctrl+O expand raw tool output"));
		}
		return coloredLines.join("\n");
	}
}
