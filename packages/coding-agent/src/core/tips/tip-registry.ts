import type { Settings } from "../settings-manager.js";
import type { Tip, TipContext } from "./types.js";

/**
 * Catalog of built-in spinner tips for Neo Code.
 *
 * Tips are intentionally scoped to features that exist in this Neosantara
 * edition. Vendor-specific upsells, feature flags, marketplace plugins and
 * paid-tier hooks from the Claude Code original have been dropped.
 *
 * Each tip ships with a stable id (used as a cooldown key in
 * `~/.neo-code/agent/tip-history.json`), a plain-text content string and
 * a synchronous {@link Tip.isRelevant} predicate. The renderer prefixes
 * the content with `tip:` and a tree branch character — do not include
 * those manually.
 */
const BUILTIN_TIPS: ReadonlyArray<Tip> = [
	{
		id: "compact",
		content: "/compact to free context window",
		cooldownSessions: 5,
		isRelevant: () => true,
	},
	{
		id: "at-file",
		content: "@file to reference files in your prompt",
		cooldownSessions: 8,
		isRelevant: () => true,
	},
	{
		id: "tree",
		content: "/tree to navigate conversation history",
		cooldownSessions: 10,
		isRelevant: () => true,
	},
	{
		id: "shortcuts",
		content: "? to see all keyboard shortcuts",
		cooldownSessions: 12,
		isRelevant: () => true,
	},
	{
		id: "todo",
		content: "/todo to track tasks across sessions",
		cooldownSessions: 10,
		isRelevant: () => true,
	},
	{
		id: "model",
		content: "/model to switch model",
		cooldownSessions: 12,
		isRelevant: (ctx) => ctx.numStartups > 1,
	},
	{
		id: "agents",
		content: "/agents to manage subagent presets",
		cooldownSessions: 12,
		isRelevant: (ctx) => ctx.numStartups > 2,
	},
	{
		id: "skills",
		content: "/skills to manage reusable skill files",
		cooldownSessions: 14,
		isRelevant: (ctx) => ctx.numStartups > 2,
	},
	{
		id: "mcp",
		content: "/mcp to inspect connected MCP servers",
		cooldownSessions: 14,
		isRelevant: (ctx) => ctx.numStartups > 3,
	},
	{
		id: "drag-drop-images",
		content: "drag and drop images into the terminal",
		cooldownSessions: 15,
		isRelevant: (ctx) => !ctx.isSshSession && !ctx.isTermux,
	},
	{
		id: "image-paste",
		content: "Ctrl+V to paste images from your clipboard",
		cooldownSessions: 15,
		isRelevant: (ctx) => !ctx.isSshSession && !ctx.isTermux,
	},
	{
		id: "termux-keys",
		content: "/termux-keys to set up Android touch keyboard",
		cooldownSessions: 6,
		isRelevant: (ctx) => ctx.isTermux,
	},
	{
		id: "resume",
		content: "neo --resume to pick up a previous session",
		cooldownSessions: 12,
		isRelevant: (ctx) => ctx.numStartups > 1,
	},
	{
		id: "shift-tab-mode",
		content: "Shift+Tab to cycle agent work modes",
		cooldownSessions: 10,
		isRelevant: (ctx) => ctx.numStartups > 1,
	},
	{
		id: "settings",
		content: "/settings to configure Neo Code",
		cooldownSessions: 14,
		isRelevant: (ctx) => ctx.numStartups > 3,
	},
	{
		id: "memory",
		content: "/memory to view and update agent memory",
		cooldownSessions: 14,
		isRelevant: (ctx) => ctx.numStartups > 3,
	},
	{
		id: "doctor",
		content: "/doctor to diagnose your environment",
		cooldownSessions: 18,
		isRelevant: (ctx) => ctx.numStartups > 4,
	},
	{
		id: "usage",
		content: "/usage to see token spend in IDR",
		cooldownSessions: 14,
		isRelevant: () => true,
	},
];

/**
 * Convert user-supplied override strings into ad-hoc tips. Custom tips have
 * cooldown 0 so they always pass the eligibility filter, but they still
 * compete with built-ins by "longest unseen" gap.
 */
function getCustomTips(settings: Settings): Tip[] {
	const override = settings.spinnerTipsOverride;
	if (!override?.tips?.length) return [];
	const result: Tip[] = [];
	for (let i = 0; i < override.tips.length; i++) {
		const raw = override.tips[i];
		if (typeof raw !== "string") continue;
		const trimmed = raw.trim();
		if (!trimmed) continue;
		result.push({
			id: `custom-tip-${i}`,
			content: trimmed,
			cooldownSessions: 0,
			isRelevant: () => true,
		});
	}
	return result;
}

/**
 * Returns tips that pass {@link Tip.isRelevant} for the given context.
 *
 * When the user sets `spinnerTipsOverride.excludeDefault = true` and provides
 * at least one custom tip, the built-in catalog is skipped entirely.
 *
 * The cooldown filter is applied separately by {@link pickTipForTurn}, since
 * cooldown depends on history state.
 */
export function getRelevantTips(ctx: TipContext): Tip[] {
	const customTips = getCustomTips(ctx.settings);
	const override = ctx.settings.spinnerTipsOverride;
	if (override?.excludeDefault && customTips.length > 0) {
		return customTips;
	}
	const builtins = BUILTIN_TIPS.filter((tip) => safeIsRelevant(tip, ctx));
	return [...builtins, ...customTips];
}

function safeIsRelevant(tip: Tip, ctx: TipContext): boolean {
	try {
		return tip.isRelevant(ctx);
	} catch {
		return false;
	}
}

/** Snapshot of built-in tip ids. Useful for tests and audit logs. */
export function getBuiltinTipIds(): string[] {
	return BUILTIN_TIPS.map((tip) => tip.id);
}

export { BUILTIN_TIPS };
