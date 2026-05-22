import type { TipHistoryStore } from "./tip-history.js";
import { getRelevantTips } from "./tip-registry.js";
import type { Tip, TipContext } from "./types.js";

/**
 * Threshold percentages that drive the render-time context override. Once
 * the context window utilization crosses {@link CONTEXT_TIP_WARNING_PERCENT}
 * the tip line nudges the user toward `/compact`. Above
 * {@link CONTEXT_TIP_URGENT_PERCENT} the wording escalates to "urgent" so
 * the message stays readable as the percentage climbs.
 */
export const CONTEXT_TIP_WARNING_PERCENT = 70;
export const CONTEXT_TIP_URGENT_PERCENT = 90;

const HIGH_CONTEXT_TIP_ID = "high-context-warning";
const URGENT_CONTEXT_TIP_ID = "urgent-context-warning";

/**
 * Render-time override that bypasses the cooldown-based catalog when
 * context utilization is high. Returns a synthetic {@link Tip} so the
 * caller can render it without changing the surrounding flow, but the
 * picker is intentionally kept separate from {@link pickTipForTurn} —
 * callers must not pass the override through `recordShownTip` because
 * the tip should keep firing every turn until the user runs `/compact`.
 */
export function pickContextOverrideTip(ctx: TipContext): Tip | undefined {
	if (ctx.settings.spinnerTipsEnabled === false) return undefined;
	const percent = ctx.contextPercent;
	if (typeof percent !== "number" || !Number.isFinite(percent)) return undefined;
	if (percent >= CONTEXT_TIP_URGENT_PERCENT) {
		return {
			id: URGENT_CONTEXT_TIP_ID,
			content: `context ${percent.toFixed(0)}% — urgent: /compact to free context window`,
			cooldownSessions: 0,
			isRelevant: () => true,
		};
	}
	if (percent >= CONTEXT_TIP_WARNING_PERCENT) {
		return {
			id: HIGH_CONTEXT_TIP_ID,
			content: `context ${percent.toFixed(0)}% — /compact to free context window`,
			cooldownSessions: 0,
			isRelevant: () => true,
		};
	}
	return undefined;
}

/**
 * Pick a single tip to show during a working turn.
 *
 * Selection rules:
 *  - Returns `undefined` when `settings.spinnerTipsEnabled === false`.
 *  - Filters by {@link Tip.isRelevant} using the supplied {@link TipContext}.
 *  - Filters by per-tip cooldown (`getSessionsSinceLastShown >= cooldownSessions`).
 *  - Among eligible tips, returns the one with the longest "sessions since
 *    last shown" gap. Tips that have never been shown have an `Infinity`
 *    gap and therefore win until at least one is recorded.
 *  - When multiple tips tie on gap, the catalog order in `tip-registry.ts`
 *    is the tiebreaker (built-ins before custom tips).
 *
 * Render-time overrides such as the high-context `/compact` reminder are
 * handled by {@link pickContextOverrideTip}, which callers should consult
 * before falling back to this function.
 */
export function pickTipForTurn(ctx: TipContext, history: TipHistoryStore): Tip | undefined {
	if (ctx.settings.spinnerTipsEnabled === false) return undefined;

	const relevant = getRelevantTips(ctx);
	if (relevant.length === 0) return undefined;

	const eligible: Tip[] = [];
	for (const tip of relevant) {
		const gap = history.getSessionsSinceLastShown(tip.id);
		if (gap >= tip.cooldownSessions) {
			eligible.push(tip);
		}
	}

	if (eligible.length === 0) return undefined;
	if (eligible.length === 1) return eligible[0];

	let bestTip = eligible[0]!;
	let bestGap = history.getSessionsSinceLastShown(bestTip.id);
	for (let i = 1; i < eligible.length; i++) {
		const tip = eligible[i]!;
		const gap = history.getSessionsSinceLastShown(tip.id);
		if (gap > bestGap) {
			bestTip = tip;
			bestGap = gap;
		}
	}
	return bestTip;
}

/**
 * Mark a tip as shown so it falls back into cooldown for the next
 * `tip.cooldownSessions` startups. Idempotent within a single session.
 */
export function recordShownTip(tip: Tip, history: TipHistoryStore): void {
	history.recordShown(tip.id);
}
