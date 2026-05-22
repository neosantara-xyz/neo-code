/**
 * Configurable status line items for the interactive footer.
 *
 * The interactive footer (`FooterComponent`) historically rendered a fixed
 * set of segments. Codex's `/statusline` lets users toggle which items appear
 * in the bottom status line; Neo Code now supports the same idea.
 *
 * Each {@link StatuslineItemId} maps to one renderer in `FooterComponent`. The
 * rendered set + ordering is taken from `settings.statusline.items` when
 * provided, falling back to {@link DEFAULT_STATUSLINE_ITEMS}.
 */

export type StatuslineItemId =
	| "modePill"
	| "backgroundPill"
	| "context"
	| "billing"
	| "hint"
	| "modelName"
	| "thinkingLevel"
	| "providerName"
	| "branch"
	| "sessionName";

/**
 * One ordered entry in the user's status line preference. The id is matched
 * against {@link StatuslineItemId}; unknown ids are dropped during merge.
 */
export interface StatuslineItemConfig {
	id: StatuslineItemId;
	enabled: boolean;
}

/**
 * Catalog metadata for a status line item: human-readable label and
 * description used by the configuration UI. Renderers live in `FooterComponent`.
 */
export interface StatuslineItemMetadata {
	id: StatuslineItemId;
	label: string;
	description: string;
}

export const STATUSLINE_ITEM_METADATA: ReadonlyArray<StatuslineItemMetadata> = [
	{ id: "modePill", label: "Mode pill", description: "Active workflow mode (plan, ask, full, …) when not default" },
	{
		id: "backgroundPill",
		label: "Background pill",
		description: "Number of running background shell tasks",
	},
	{ id: "context", label: "Context usage", description: "Current request context tokens vs. window size" },
	{ id: "billing", label: "Billing total", description: "Cumulative session cost in IDR" },
	{ id: "hint", label: "Action hint", description: "Compact keyboard hint (interrupt / shortcuts / mode cycle)" },
	{ id: "modelName", label: "Model name", description: "Active model id rendered on the right side" },
	{
		id: "thinkingLevel",
		label: "Thinking level",
		description: "Current thinking effort indicator next to the model",
	},
	{
		id: "providerName",
		label: "Provider name",
		description: "Provider prefix shown only when multiple providers are available",
	},
	{ id: "branch", label: "Git branch", description: "Current branch suffix on the path line" },
	{ id: "sessionName", label: "Session name", description: "Session label set via /name on the path line" },
];

/**
 * Default order + visibility for the status line. Mirrors the original
 * hardcoded behavior so existing users see no change until they opt in.
 */
export const DEFAULT_STATUSLINE_ITEMS: ReadonlyArray<StatuslineItemConfig> = [
	{ id: "modePill", enabled: true },
	{ id: "backgroundPill", enabled: true },
	{ id: "context", enabled: true },
	{ id: "billing", enabled: true },
	{ id: "hint", enabled: true },
	{ id: "modelName", enabled: true },
	{ id: "thinkingLevel", enabled: true },
	{ id: "providerName", enabled: true },
	{ id: "branch", enabled: true },
	{ id: "sessionName", enabled: true },
];

const VALID_IDS = new Set<StatuslineItemId>(STATUSLINE_ITEM_METADATA.map((meta) => meta.id));

/**
 * Sanitize a user-supplied list of items. Unknown ids are dropped, duplicates
 * are kept once (first-wins), and any default ids missing from the list are
 * appended at the end as `enabled: false` so users see them in the picker.
 */
export function normalizeStatuslineItems(
	items: ReadonlyArray<StatuslineItemConfig> | undefined | null,
): StatuslineItemConfig[] {
	if (!items || items.length === 0) {
		return DEFAULT_STATUSLINE_ITEMS.map((item) => ({ ...item }));
	}

	const seen = new Set<StatuslineItemId>();
	const result: StatuslineItemConfig[] = [];
	for (const item of items) {
		if (!item || typeof item !== "object") continue;
		if (typeof item.id !== "string" || !VALID_IDS.has(item.id as StatuslineItemId)) continue;
		const id = item.id as StatuslineItemId;
		if (seen.has(id)) continue;
		seen.add(id);
		result.push({ id, enabled: item.enabled !== false });
	}

	for (const fallback of DEFAULT_STATUSLINE_ITEMS) {
		if (!seen.has(fallback.id)) {
			result.push({ id: fallback.id, enabled: false });
			seen.add(fallback.id);
		}
	}

	return result;
}

/**
 * Convenience used by tests and the picker to look up metadata by id.
 */
export function getStatuslineItemMetadata(id: StatuslineItemId): StatuslineItemMetadata {
	const meta = STATUSLINE_ITEM_METADATA.find((entry) => entry.id === id);
	if (!meta) {
		throw new Error(`Unknown statusline item: ${id}`);
	}
	return meta;
}

/**
 * Returns the enabled subset in the user's preferred order. Used by the
 * footer renderer to decide which segments to emit.
 */
export function getEnabledStatuslineItems(items: StatuslineItemConfig[]): StatuslineItemId[] {
	return items.filter((item) => item.enabled).map((item) => item.id);
}
