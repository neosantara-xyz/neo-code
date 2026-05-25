/**
 * Interactive mode for the coding agent.
 * Handles TUI rendering and user interaction, delegating business logic to AgentSession.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentMessage } from "@neosantara/agent-core";
import {
	type AssistantMessage,
	getProviders,
	type ImageContent,
	type Message,
	type Model,
	type OAuthProviderId,
	type OAuthSelectPrompt,
} from "@neosantara/ai";
import type {
	AutocompleteItem,
	AutocompleteProvider,
	EditorComponent,
	Keybinding,
	KeyId,
	MarkdownTheme,
	OverlayHandle,
	OverlayOptions,
	SlashCommand,
} from "@neosantara/tui";
import {
	CombinedAutocompleteProvider,
	type Component,
	Container,
	fuzzyFilter,
	Loader,
	type LoaderIndicatorOptions,
	Markdown,
	matchesKey,
	ProcessTerminal,
	Spacer,
	setKeybindings,
	Text,
	TruncatedText,
	TUI,
	truncateToWidth,
	visibleWidth,
} from "@neosantara/tui";
import { spawn, spawnSync } from "child_process";
import {
	APP_NAME,
	APP_TITLE,
	detectInstallMethod,
	getAgentDir,
	getAuthPath,
	getDebugLogPath,
	getShareViewerUrl,
	VERSION,
} from "../../config.js";
import {
	AGENT_WORK_MODE_CONFIG,
	AGENT_WORK_MODES,
	type AgentWorkMode,
	formatAgentWorkModeCycleList,
	formatAgentWorkModeList,
	getAgentWorkModeFooterDetail,
	getAgentWorkModeLabel,
	getAgentWorkModeToolSummary,
	getNextAgentWorkMode,
	parseAgentWorkMode,
} from "../../core/agent-mode.js";
import { type AgentSession, type AgentSessionEvent, parseSkillBlock } from "../../core/agent-session.js";
import { type AgentSessionRuntime, SessionImportFileNotFoundError } from "../../core/agent-session-runtime.js";
import { AGENTS_FILE_NAME, INIT_AGENTS_PROMPT } from "../../core/agents-command.js";
import { AuthStorage } from "../../core/auth-storage.js";
import { estimateTokens, getAutoCompactTriggerTokens } from "../../core/compaction/index.js";
import type {
	AutocompleteProviderFactory,
	EditorFactory,
	ExtensionCommandContext,
	ExtensionContext,
	ExtensionRunner,
	ExtensionUIContext,
	ExtensionUIDialogOptions,
	ExtensionWidgetOptions,
} from "../../core/extensions/index.js";
import { FooterDataProvider, type ReadonlyFooterDataProvider } from "../../core/footer-data-provider.js";
import { type AppKeybinding, KeybindingsManager } from "../../core/keybindings.js";
import { getLspManager } from "../../core/lsp/manager.js";
import { defaultModelPerProvider, findExactModelReferenceMatch, resolveModelScope } from "../../core/model-resolver.js";
import { loginWithNeosantaraDeviceAuth } from "../../core/neosantara-device-auth.js";
import { openLocal } from "../../core/open-file.js";
import { DefaultPackageManager } from "../../core/package-manager.js";
import { exitAfterCleanup } from "../../core/process-lifecycle.js";
import { BUILT_IN_PROVIDER_DISPLAY_NAMES } from "../../core/provider-display-names.js";
import type { ResourceDiagnostic } from "../../core/resource-loader.js";
import {
	buildReviewKickoffMessage,
	buildReviewUserPrompt,
	getCommitSubject,
	isGitRepository,
	listLocalBranches,
	listRecentCommits,
	type ReviewTarget,
	resolveMergeBase,
} from "../../core/review/index.js";
import { formatMissingSessionCwdPrompt, MissingSessionCwdError } from "../../core/session-cwd.js";
import { type SessionContext, SessionManager } from "../../core/session-manager.js";
import { getSkillDescription, getSkillDisplayName } from "../../core/skills.js";
import { parseSkillsCommand } from "../../core/skills-command.js";
import { BUILTIN_SLASH_COMMANDS } from "../../core/slash-commands.js";
import type { SourceInfo } from "../../core/source-info.js";
import {
	buildInstallTelemetryPayload,
	type InstallTelemetryEvent,
	isInstallTelemetryEnabled,
} from "../../core/telemetry.js";
import {
	getTermuxApiCapabilities,
	getTermuxStatusSnapshot,
	listTermuxApiTools,
	summarizeTermuxApiCapabilities,
	termuxNotify,
	termuxVibrate,
} from "../../core/termux-api.js";
import {
	applyNeoTermuxTouchKeyboard,
	findLatestTermuxPropertiesBackup,
	getTermuxTouchKeyboardStatus,
	isTermuxEnvironment,
	NEO_TERMUX_EXTRA_KEYS,
	restoreLatestTermuxTouchKeyboardBackup,
} from "../../core/termux-touch-keyboard.js";
import {
	FileTipHistoryStore,
	pickContextOverrideTip,
	pickTipForTurn,
	recordShownTip,
	type Tip,
	type TipContext,
	type TipHistoryStore,
} from "../../core/tips/index.js";
import { getExitPlanModePlan, type ToolApprovalDecision, type ToolApprovalRequest } from "../../core/tool-approval.js";
import { formatToolInputLoadingMessage, formatToolLoadingMessage } from "../../core/tools/tool-activity.js";
import type { TruncationResult } from "../../core/tools/truncate.js";
import { formatChangelogEntries, getAllChangelogEntries, getNewEntries } from "../../utils/changelog.js";
import { copyToClipboard } from "../../utils/clipboard.js";
import { extensionForImageMimeType, readClipboardImage } from "../../utils/clipboard-image.js";
import { parseGitUrl } from "../../utils/git.js";
import { getNeosantaraUserAgent } from "../../utils/neosantara-user-agent.js";
import { getCwdRelativePath } from "../../utils/paths.js";
import { killTrackedDetachedChildren } from "../../utils/shell.js";
import { ensureTool, getToolPath } from "../../utils/tools-manager.js";
import { checkForNewPiVersion } from "../../utils/version-check.js";
import { ArminComponent } from "./components/armin.js";
import { AssistantMessageComponent } from "./components/assistant-message.js";
import { BashExecutionComponent } from "./components/bash-execution.js";
import { BorderedLoader } from "./components/bordered-loader.js";
import { BranchSummaryMessageComponent } from "./components/branch-summary-message.js";
import { CompactionSummaryMessageComponent } from "./components/compaction-summary-message.js";
import { CountdownTimer } from "./components/countdown-timer.js";
import { CustomEditor } from "./components/custom-editor.js";
import { CustomMessageComponent } from "./components/custom-message.js";
import { renderDiff } from "./components/diff.js";
import {
	type DoctorDiagnostic,
	type DoctorLine,
	DoctorScreenComponent,
	type DoctorScreenData,
	type DoctorSection,
} from "./components/doctor-screen.js";
import { DynamicBorder } from "./components/dynamic-border.js";
import { ExtensionEditorComponent } from "./components/extension-editor.js";
import { ExtensionInputComponent } from "./components/extension-input.js";
import { ExtensionSelectorComponent } from "./components/extension-selector.js";
import { FooterComponent } from "./components/footer.js";
import { formatKeyText, keyDisplayText, keyHint, keyText, rawKeyHint } from "./components/keybinding-hints.js";
import { LoginDialogComponent } from "./components/login-dialog.js";
import { ModelSelectorComponent } from "./components/model-selector.js";
import { NeosantaraAnnouncementComponent } from "./components/neosantara-announcement.js";
import { type AuthSelectorProvider, OAuthSelectorComponent } from "./components/oauth-selector.js";
import { RateLimitCardComponent } from "./components/rate-limit-card.js";
import { ReviewSelectorComponent } from "./components/review-selector.js";
import { ScopedModelsSelectorComponent } from "./components/scoped-models-selector.js";
import { SessionSelectorComponent } from "./components/session-selector.js";
import { SettingsSelectorComponent } from "./components/settings-selector.js";
import { SkillInvocationMessageComponent } from "./components/skill-invocation-message.js";
import { StatuslineSelectorComponent } from "./components/statusline-selector.js";
import { ToolActivityGroupComponent } from "./components/tool-activity-group.js";
import { ToolApprovalRequestComponent } from "./components/tool-approval-request.js";
import { ToolExecutionComponent } from "./components/tool-execution.js";
import { TreeSelectorComponent } from "./components/tree-selector.js";
import { UsageScreenComponent } from "./components/usage-screen.js";
import { UserMessageComponent } from "./components/user-message.js";
import { UserMessageSelectorComponent } from "./components/user-message-selector.js";
import { getHomeDirectoryWarning, WelcomeScreenComponent } from "./components/welcome-screen.js";
import {
	getAvailableThemes,
	getAvailableThemesWithPaths,
	getEditorTheme,
	getMarkdownTheme,
	getThemeByName,
	initTheme,
	onThemeChange,
	setRegisteredThemes,
	setTheme,
	setThemeInstance,
	stopThemeWatcher,
	Theme,
	type ThemeColor,
	theme,
} from "./theme/theme.js";
import {
	formatDefaultWorkingMessage,
	pickDefaultWorkingMessageIndex,
	shouldAttachSpinnerTipForMode,
} from "./working-loader-state.js";

const CLAUDE_STYLE_SPINNER_FRAMES = ["·", "✢", "✳", "✶", "✻", "✽", "✽", "✻", "✶", "✳", "✢", "·"];
type WorkingLoaderMode = "responding" | "tool-input" | "tool-use";
type ToolPermissionPreset = "default" | "read-only" | "full" | "no-tools";

/** Interface for components that can be expanded/collapsed */
interface Expandable {
	setExpanded(expanded: boolean): void;
}

function formatIdrCurrency(amount: number): string {
	return new Intl.NumberFormat("id-ID", {
		style: "currency",
		currency: "IDR",
		maximumFractionDigits: 2,
	}).format(amount);
}

function formatOptionalIdrCurrency(amount: number | null | undefined): string {
	return typeof amount === "number" ? formatIdrCurrency(amount) : "unavailable";
}

function formatPercent(value: number | null | undefined): string {
	return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}%` : "unknown";
}

function formatBytes(bytes: number): string {
	const units = ["B", "KB", "MB", "GB"] as const;
	let value = bytes;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex++;
	}
	return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

type NeosantaraModelQuota = {
	modelId: string;
	displayName?: string;
	percentAvailable?: number;
	available?: boolean;
	status?: string;
	resetAt?: string;
};

type NeosantaraUsageSnapshot = {
	billingModel: "pay_as_you_go";
	currency: "IDR";
	balanceIdr?: number;
	monthlySpendIdr?: number;
	updatedAt?: string;
	modelQuotas: NeosantaraModelQuota[];
};

type NeosantaraUsageResult = {
	snapshot: NeosantaraUsageSnapshot | null;
	status: "connected" | "login required" | "unavailable";
	detail?: string;
};

type CliUsagePayload = {
	billing_model?: unknown;
	currency?: unknown;
	balance_idr?: unknown;
	period_spend_idr?: unknown;
	period?: {
		reset_date?: unknown;
		end_date?: unknown;
	};
	model_quota?: unknown;
	model_quotas?: unknown;
	modelQuotas?: unknown;
	quotas?: unknown;
	models?: unknown;
};

function normalizeNeosantaraApiBaseUrl(): string {
	const raw =
		process.env.NEOSANTARA_API_BASE_URL?.trim() ||
		process.env.NEO_CODE_NEOSANTARA_API_BASE_URL?.trim() ||
		"https://api.neosantara.xyz";
	return raw.replace(/\/+$/, "").replace(/\/v1$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberFromUnknown(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return undefined;
}

function parseCliUsagePayload(payload: unknown): CliUsagePayload | null {
	if (!isRecord(payload)) return null;
	const data = isRecord(payload.data) ? payload.data : payload;
	return data as CliUsagePayload;
}

function stringFromUnknown(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function booleanFromUnknown(value: unknown): boolean | undefined {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (["true", "yes", "available", "ok"].includes(normalized)) return true;
		if (["false", "no", "unavailable", "blocked"].includes(normalized)) return false;
	}
	return undefined;
}

function percentFromQuotaRecord(record: Record<string, unknown>): number | undefined {
	const direct =
		numberFromUnknown(record.percent_available) ??
		numberFromUnknown(record.available_percent) ??
		numberFromUnknown(record.remaining_percent) ??
		numberFromUnknown(record.percentAvailable) ??
		numberFromUnknown(record.quota_available_percent);
	if (direct !== undefined) return direct;

	const used = numberFromUnknown(record.used) ?? numberFromUnknown(record.usage);
	const limit = numberFromUnknown(record.limit) ?? numberFromUnknown(record.quota);
	if (used !== undefined && limit !== undefined && limit > 0) {
		return Math.max(0, 100 - (used / limit) * 100);
	}

	const remaining = numberFromUnknown(record.remaining);
	if (remaining !== undefined && limit !== undefined && limit > 0) {
		return (remaining / limit) * 100;
	}

	return undefined;
}

function parseModelQuotaRecord(value: unknown, fallbackModelId?: string): NeosantaraModelQuota | undefined {
	if (!isRecord(value)) return undefined;
	const modelId =
		stringFromUnknown(value.model) ??
		stringFromUnknown(value.model_id) ??
		stringFromUnknown(value.modelId) ??
		stringFromUnknown(value.id) ??
		fallbackModelId;
	if (!modelId) return undefined;

	return {
		modelId,
		displayName:
			stringFromUnknown(value.name) ?? stringFromUnknown(value.display_name) ?? stringFromUnknown(value.displayName),
		percentAvailable: percentFromQuotaRecord(value),
		available:
			booleanFromUnknown(value.available) ??
			booleanFromUnknown(value.quota_available) ??
			booleanFromUnknown(value.enabled),
		status: stringFromUnknown(value.status) ?? stringFromUnknown(value.message),
		resetAt:
			stringFromUnknown(value.reset_at) ?? stringFromUnknown(value.resetAt) ?? stringFromUnknown(value.reset_date),
	};
}

function parseModelQuotas(value: unknown): NeosantaraModelQuota[] {
	if (Array.isArray(value)) {
		return value
			.map((entry) => parseModelQuotaRecord(entry))
			.filter((entry): entry is NeosantaraModelQuota => !!entry);
	}
	if (!isRecord(value)) return [];
	return Object.entries(value)
		.map(([modelId, entry]) => parseModelQuotaRecord(entry, modelId))
		.filter((entry): entry is NeosantaraModelQuota => !!entry);
}

function extractModelQuotas(data: CliUsagePayload): NeosantaraModelQuota[] {
	for (const candidate of [data.model_quota, data.model_quotas, data.modelQuotas, data.quotas, data.models]) {
		const parsed = parseModelQuotas(candidate);
		if (parsed.length > 0) return parsed;
	}
	return [];
}

async function getNeosantaraBackendUsageSnapshot(): Promise<NeosantaraUsageResult> {
	const apiKey = await AuthStorage.create().getApiKey("neosantara", {
		includeFallback: false,
	});
	if (!apiKey) {
		return { snapshot: null, status: "login required" };
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10_000);
	try {
		const response = await fetch(`${normalizeNeosantaraApiBaseUrl()}/v1/cli/usage`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"User-Agent": getNeosantaraUserAgent(),
			},
			signal: controller.signal,
		});
		const payload = await response.json().catch(() => null);

		if (response.status === 401) {
			return { snapshot: null, status: "login required" };
		}
		if (!response.ok) {
			return {
				snapshot: null,
				status: "unavailable",
				detail: `HTTP ${response.status}`,
			};
		}

		const data = parseCliUsagePayload(payload);
		if (!data) {
			return {
				snapshot: null,
				status: "unavailable",
				detail: "invalid response",
			};
		}

		return {
			snapshot: {
				billingModel: data.billing_model === "pay_as_you_go" ? "pay_as_you_go" : "pay_as_you_go",
				currency: data.currency === "IDR" ? "IDR" : "IDR",
				balanceIdr: numberFromUnknown(data.balance_idr),
				monthlySpendIdr: numberFromUnknown(data.period_spend_idr),
				updatedAt:
					typeof data.period?.reset_date === "string"
						? data.period.reset_date
						: typeof data.period?.end_date === "string"
							? data.period.end_date
							: undefined,
				modelQuotas: extractModelQuotas(data),
			},
			status: "connected",
		};
	} catch (error) {
		const detail = error instanceof Error && error.name === "AbortError" ? "timeout" : undefined;
		return { snapshot: null, status: "unavailable", detail };
	} finally {
		clearTimeout(timeout);
	}
}

function isExpandable(obj: unknown): obj is Expandable {
	return typeof obj === "object" && obj !== null && "setExpanded" in obj && typeof obj.setExpanded === "function";
}

class ExpandableText extends Text implements Expandable {
	constructor(
		private readonly getCollapsedText: () => string,
		private readonly getExpandedText: () => string,
		expanded = false,
		paddingX = 0,
		paddingY = 0,
	) {
		super(expanded ? getExpandedText() : getCollapsedText(), paddingX, paddingY);
	}

	setExpanded(expanded: boolean): void {
		this.setText(expanded ? this.getExpandedText() : this.getCollapsedText());
	}
}

type CompactionQueuedMessage = {
	text: string;
	mode: "steer" | "followUp";
};

const DEAD_TERMINAL_ERROR_CODES = new Set(["EIO", "EPIPE", "ENOTCONN"]);

function isDeadTerminalError(error: unknown): boolean {
	if (!error || typeof error !== "object" || !("code" in error)) {
		return false;
	}
	const code = (error as NodeJS.ErrnoException).code;
	return code !== undefined && DEAD_TERMINAL_ERROR_CODES.has(code);
}

function isUnknownModel(model: Model<any> | undefined): boolean {
	return !!model && model.provider === "unknown" && model.id === "unknown" && model.api === "unknown";
}

function hasDefaultModelProvider(providerId: string): providerId is keyof typeof defaultModelPerProvider {
	return providerId in defaultModelPerProvider;
}

const BUILT_IN_MODEL_PROVIDERS = new Set<string>(getProviders());

export function isApiKeyLoginProvider(
	providerId: string,
	oauthProviderIds: ReadonlySet<string>,
	builtInProviderIds: ReadonlySet<string> = BUILT_IN_MODEL_PROVIDERS,
): boolean {
	if (BUILT_IN_PROVIDER_DISPLAY_NAMES[providerId]) {
		return true;
	}
	if (builtInProviderIds.has(providerId)) {
		return false;
	}
	return !oauthProviderIds.has(providerId);
}

/**
 * Options for InteractiveMode initialization.
 */
export interface InteractiveModeOptions {
	/** Providers that were migrated to auth.json (shows warning) */
	migratedProviders?: string[];
	/** Warning message if session model couldn't be restored */
	modelFallbackMessage?: string;
	/** Initial message to send on startup (can include @file content) */
	initialMessage?: string;
	/** Images to attach to the initial message */
	initialImages?: ImageContent[];
	/** Additional messages to send after the initial message */
	initialMessages?: string[];
	/** Force verbose startup (overrides quietStartup setting) */
	verbose?: boolean;
}

export class InteractiveMode {
	private runtimeHost: AgentSessionRuntime;
	private ui: TUI;
	private chatContainer: Container;
	private pendingMessagesContainer: Container;
	private approvalContainer: Container;
	private statusContainer: Container;
	private defaultEditor: CustomEditor;
	private editor: EditorComponent;
	private editorComponentFactory: EditorFactory | undefined;
	private autocompleteProvider: AutocompleteProvider | undefined;
	private autocompleteProviderWrappers: AutocompleteProviderFactory[] = [];
	private fdPath: string | undefined;
	private editorContainer: Container;
	private footer: FooterComponent;
	private footerDataProvider: FooterDataProvider;
	// Stored so the same manager can be injected into custom editors, selectors, and extension UI.
	private keybindings: KeybindingsManager;
	private version: string;
	private isInitialized = false;
	private onInputCallback?: (text: string) => void;
	private loadingAnimation: Loader | undefined = undefined;
	private workingMessage: string | undefined = undefined;
	private workingVisible = true;
	private workingIndicatorOptions: LoaderIndicatorOptions | undefined = undefined;
	private readonly defaultWorkingMessages = ["ngulik", "ngetik", "ngritik", "ngoprek"];
	private defaultWorkingMessageIndex = pickDefaultWorkingMessageIndex(this.defaultWorkingMessages.length);
	private currentWorkingLoaderMode: WorkingLoaderMode = "responding";
	private readonly defaultHiddenThinkingLabel = "Thinking...";
	private hiddenThinkingLabel = this.defaultHiddenThinkingLabel;

	// Spinner tip line state. The tip is picked once per agent turn (in
	// `agent_start`) and rendered as a separate `└─ tip: ...` line below
	// the loader. Both the loader and the tip line live inside
	// `statusContainer`, so `agent_end` clears them together.
	private readonly tipHistory: TipHistoryStore = new FileTipHistoryStore();
	private numStartups = 0;
	private currentTip: Tip | undefined = undefined;
	private currentTipText: TruncatedText | undefined = undefined;
	private tipPickedThisTurn = false;
	private spinnerTipDismissedThisTurn = false;

	// Away summary state
	private terminalBlurredAt: number | undefined = undefined;
	private workCompletedWhileAway = false;
	/**
	 * `Date.now()` at the most recent `agent_start`. Used by the opt-in
	 * Termux completion notification to filter short turns.
	 */
	private currentTurnStartedAt: number | undefined = undefined;

	// Low balance warning state
	private lowBalanceWarningShown = false;
	private lastKnownBalanceIdr: number | undefined = undefined;

	private lastSigintTime = 0;
	private readonly sessionStartTime = Date.now();
	private lastEscapeTime = 0;
	private shortcutOverlayVisible = false;
	private changelogMarkdown: string | undefined = undefined;
	private startupNoticesShown = false;

	// Status line tracking (for mutating immediately-sequential status updates)
	private lastStatusSpacer: Spacer | undefined = undefined;
	private lastStatusText: Text | undefined = undefined;

	// Streaming message tracking
	private streamingComponent: AssistantMessageComponent | undefined = undefined;
	private streamingMessage: AssistantMessage | undefined = undefined;

	// Tool execution tracking: toolCallId -> component
	private pendingTools = new Map<string, ToolExecutionComponent>();
	private pendingToolGroups = new Map<string, ToolActivityGroupComponent>();
	private activeToolExecutionIds = new Set<string>();
	private currentToolActivityGroup?: ToolActivityGroupComponent;
	private pendingToolApproval?: {
		request: ToolApprovalRequest;
		component: ToolApprovalRequestComponent;
		resolve: (decision: ToolApprovalDecision) => void;
	};

	// Tool output expansion state
	private toolOutputExpanded = false;

	// Thinking block visibility state
	private hideThinkingBlock = false;

	// Skill commands: command name -> skill file path
	private skillCommands = new Map<string, string>();

	// Agent subscription unsubscribe function
	private unsubscribe?: () => void;
	private signalCleanupHandlers: Array<() => void> = [];

	// Track if editor is in bash mode (text starts with !)
	private isBashMode = false;

	// Track current bash execution component
	private bashComponent: BashExecutionComponent | undefined = undefined;

	// Track pending bash components (shown in pending area, moved to chat on submit)
	private pendingBashComponents: BashExecutionComponent[] = [];

	// Auto-compaction state
	private autoCompactionLoader: Loader | undefined = undefined;
	private autoCompactionEscapeHandler?: () => void;

	// Auto-retry state
	private retryLoader: Loader | undefined = undefined;
	private retryCountdown: CountdownTimer | undefined = undefined;
	private retryEscapeHandler?: () => void;

	// Rate-limit card state (at most one active at a time)
	private rateLimitCard: RateLimitCardComponent | undefined = undefined;

	// Messages queued while compaction is running
	private compactionQueuedMessages: CompactionQueuedMessage[] = [];

	// Shutdown state
	private shutdownRequested = false;

	// Extension UI state
	private extensionSelector: ExtensionSelectorComponent | undefined = undefined;
	private extensionInput: ExtensionInputComponent | undefined = undefined;
	private extensionEditor: ExtensionEditorComponent | undefined = undefined;
	private extensionTerminalInputUnsubscribers = new Set<() => void>();

	// Extension widgets (components rendered above/below the editor)
	private extensionWidgetsAbove = new Map<string, Component & { dispose?(): void }>();
	private extensionWidgetsBelow = new Map<string, Component & { dispose?(): void }>();
	private widgetContainerAbove!: Container;
	private widgetContainerBelow!: Container;

	// Custom footer from extension (undefined = use built-in footer)
	private customFooter: (Component & { dispose?(): void }) | undefined = undefined;

	// Header container that holds the built-in or custom header
	private headerContainer: Container;

	// Built-in header (logo + keybinding hints + changelog)
	private builtInHeader: Component | undefined = undefined;

	// Custom header from extension (undefined = use built-in header)
	private customHeader: (Component & { dispose?(): void }) | undefined = undefined;

	// Convenience accessors
	private get session(): AgentSession {
		return this.runtimeHost.session;
	}
	private get agent() {
		return this.session.agent;
	}
	private get sessionManager() {
		return this.session.sessionManager;
	}
	private get settingsManager() {
		return this.session.settingsManager;
	}

	constructor(
		runtimeHost: AgentSessionRuntime,
		private options: InteractiveModeOptions = {},
	) {
		this.runtimeHost = runtimeHost;
		this.runtimeHost.setBeforeSessionInvalidate(() => {
			this.resetExtensionUI();
		});
		this.runtimeHost.setRebindSession(async () => {
			await this.rebindCurrentSession();
		});
		this.version = VERSION;
		this.ui = new TUI(new ProcessTerminal(), this.settingsManager.getShowHardwareCursor());
		this.ui.setClearOnShrink(this.settingsManager.getClearOnShrink());
		this.headerContainer = new Container();
		this.chatContainer = new Container();
		this.pendingMessagesContainer = new Container();
		this.approvalContainer = new Container();
		this.statusContainer = new Container();
		this.widgetContainerAbove = new Container();
		this.widgetContainerBelow = new Container();
		this.keybindings = KeybindingsManager.create();
		setKeybindings(this.keybindings);
		const editorPaddingX = this.settingsManager.getEditorPaddingX();
		const autocompleteMaxVisible = this.settingsManager.getAutocompleteMaxVisible();
		this.defaultEditor = new CustomEditor(this.ui, getEditorTheme(), this.keybindings, {
			paddingX: editorPaddingX,
			autocompleteMaxVisible,
		});
		this.editor = this.defaultEditor;
		this.editorContainer = new Container();
		this.editorContainer.addChild(this.editor as Component);
		this.footerDataProvider = new FooterDataProvider(this.sessionManager.getCwd());
		this.footer = new FooterComponent(this.session, this.footerDataProvider, this.settingsManager);
		this.footer.setAutoCompactEnabled(this.session.autoCompactionEnabled);

		// Load hide thinking block setting
		this.hideThinkingBlock = this.settingsManager.getHideThinkingBlock();

		// Register themes from resource loader and initialize
		setRegisteredThemes(this.session.resourceLoader.getThemes().themes);
		initTheme(this.settingsManager.getTheme(), true);
	}

	private getAutocompleteSourceTag(sourceInfo?: SourceInfo): string | undefined {
		if (!sourceInfo) {
			return undefined;
		}

		const scopePrefix = sourceInfo.scope === "user" ? "u" : sourceInfo.scope === "project" ? "p" : "t";
		const source = sourceInfo.source.trim();

		if (source === "auto" || source === "local" || source === "cli") {
			return scopePrefix;
		}

		if (source.startsWith("npm:")) {
			return `${scopePrefix}:${source}`;
		}

		const gitSource = parseGitUrl(source);
		if (gitSource) {
			const ref = gitSource.ref ? `@${gitSource.ref}` : "";
			return `${scopePrefix}:git:${gitSource.host}/${gitSource.path}${ref}`;
		}

		return scopePrefix;
	}

	private prefixAutocompleteDescription(description: string | undefined, sourceInfo?: SourceInfo): string | undefined {
		const sourceTag = this.getAutocompleteSourceTag(sourceInfo);
		if (!sourceTag) {
			return description;
		}
		return description ? `[${sourceTag}] ${description}` : `[${sourceTag}]`;
	}

	private getBuiltInCommandConflictDiagnostics(extensionRunner: ExtensionRunner): ResourceDiagnostic[] {
		const builtinNames = new Set(BUILTIN_SLASH_COMMANDS.map((command) => command.name));
		return extensionRunner
			.getRegisteredCommands()
			.filter((command) => builtinNames.has(command.name))
			.map((command) => ({
				type: "warning" as const,
				message:
					command.invocationName === command.name
						? `Extension command '/${command.name}' conflicts with built-in interactive command. Skipping in autocomplete.`
						: `Extension command '/${command.name}' conflicts with built-in interactive command. Available as '/${command.invocationName}'.`,
				path: command.sourceInfo.path,
			}));
	}

	private createBaseAutocompleteProvider(): AutocompleteProvider {
		// Define commands for autocomplete
		const slashCommands: SlashCommand[] = BUILTIN_SLASH_COMMANDS.map((command) => ({
			name: command.name,
			description: command.description,
			...(command.argumentHint && { argumentHint: command.argumentHint }),
		}));

		const modelCommand = slashCommands.find((command) => command.name === "model");
		if (modelCommand) {
			modelCommand.getArgumentCompletions = (prefix: string): AutocompleteItem[] | null => {
				// Get available models (scoped or from registry)
				const models =
					this.session.scopedModels.length > 0
						? this.session.scopedModels.map((s) => s.model)
						: this.session.modelRegistry.getAvailable();

				if (models.length === 0) return null;

				// Create items with provider/id format
				const items = models.map((m) => ({
					id: m.id,
					provider: m.provider,
					label: `${m.provider}/${m.id}`,
				}));

				// Fuzzy filter by model ID and provider
				const filtered = fuzzyFilter(items, prefix, (item) => `${item.id} ${item.provider}`);

				if (filtered.length === 0) return null;

				return filtered.map((item) => ({
					value: item.label,
					label: item.id,
					description: item.provider,
				}));
			};
		}

		// Convert prompt templates to SlashCommand format for autocomplete
		const templateCommands: SlashCommand[] = this.session.promptTemplates.map((cmd) => ({
			name: cmd.name,
			description: this.prefixAutocompleteDescription(cmd.description, cmd.sourceInfo),
			...(cmd.argumentHint && { argumentHint: cmd.argumentHint }),
		}));

		// Convert extension commands to SlashCommand format
		const builtinCommandNames = new Set(slashCommands.map((c) => c.name));
		const extensionCommands: SlashCommand[] = this.session.extensionRunner
			.getRegisteredCommands()
			.filter((cmd) => !builtinCommandNames.has(cmd.name))
			.map((cmd) => ({
				name: cmd.invocationName,
				description: this.prefixAutocompleteDescription(cmd.description, cmd.sourceInfo),
				getArgumentCompletions: cmd.getArgumentCompletions,
			}));

		// Build skill commands from session.skills (if enabled)
		this.skillCommands.clear();
		const skillCommandList: SlashCommand[] = [];
		if (this.settingsManager.getEnableSkillCommands()) {
			for (const skill of this.session.resourceLoader.getSkills().skills) {
				const commandName = `skill:${skill.name}`;
				this.skillCommands.set(commandName, skill.filePath);
				skillCommandList.push({
					name: commandName,
					description: this.prefixAutocompleteDescription(getSkillDescription(skill), skill.sourceInfo),
				});
			}
		}

		return new CombinedAutocompleteProvider(
			[...slashCommands, ...templateCommands, ...extensionCommands, ...skillCommandList],
			this.sessionManager.getCwd(),
			this.fdPath,
		);
	}

	private setupAutocompleteProvider(): void {
		let provider = this.createBaseAutocompleteProvider();
		for (const wrapProvider of this.autocompleteProviderWrappers) {
			provider = wrapProvider(provider);
		}

		this.autocompleteProvider = provider;
		this.defaultEditor.setAutocompleteProvider(provider);
		if (this.editor !== this.defaultEditor) {
			this.editor.setAutocompleteProvider?.(provider);
		}
	}

	private showStartupNoticesIfNeeded(): void {
		if (this.startupNoticesShown) {
			return;
		}
		this.startupNoticesShown = true;

		if (!this.changelogMarkdown) {
			return;
		}

		if (this.isStartupChangelogVisibleInWelcome()) {
			return;
		}

		if (this.chatContainer.children.length > 0) {
			this.chatContainer.addChild(new Spacer(1));
		}
		this.chatContainer.addChild(new DynamicBorder());
		if (this.settingsManager.getCollapseChangelog()) {
			const versionMatch = this.changelogMarkdown.match(/##\s+\[?(\d+\.\d+\.\d+)\]?/);
			const latestVersion = versionMatch ? versionMatch[1] : this.version;
			const condensedText = `Updated to v${latestVersion}. Use ${theme.bold("/changelog")} to view full changelog.`;
			this.chatContainer.addChild(new Text(condensedText, 1, 0));
		} else {
			this.chatContainer.addChild(new Text(theme.bold(theme.fg("accent", "What's New")), 1, 0));
			this.chatContainer.addChild(new Spacer(1));
			this.chatContainer.addChild(
				new Markdown(this.changelogMarkdown.trim(), 1, 0, this.getMarkdownThemeWithSettings()),
			);
			this.chatContainer.addChild(new Spacer(1));
		}
		this.chatContainer.addChild(new DynamicBorder());
	}

	private isStartupChangelogVisibleInWelcome(): boolean {
		if (this.customHeader) {
			return false;
		}
		return this.builtInHeader instanceof WelcomeScreenComponent && this.builtInHeader.hasChangelogHeadline();
	}

	async init(): Promise<void> {
		if (this.isInitialized) return;

		this.registerSignalHandlers();

		// Load changelog (only show new entries, skip for resumed sessions)
		this.changelogMarkdown = this.getChangelogForDisplay();

		// Ensure fd and rg are available (downloads if missing, adds to PATH via getBinDir)
		// Both are needed: fd for autocomplete, rg for grep tool and bash commands
		const [fdPath] = await Promise.all([ensureTool("fd"), ensureTool("rg")]);
		this.fdPath = fdPath;

		// Add header container as first child
		this.ui.addChild(this.headerContainer);

		// Add header with keybindings from config (unless silenced)
		if (this.options.verbose || !this.settingsManager.getQuietStartup()) {
			const model = this.session.model;
			const modelLabel = model
				? `${this.session.modelRegistry.getProviderDisplayName(model.provider)}/${model.name || model.id}`
				: "model not selected";
			const cwd = this.sessionManager.getCwd();
			const cwdLabel = this.formatCompactDisplayPath(cwd);

			// Build startup instructions using keybinding hint helpers
			const hint = (keybinding: AppKeybinding, description: string) => keyHint(keybinding, description);

			const expandedInstructions = [
				hint("app.interrupt", "interrupt"),
				hint("app.clear", "clear screen"),
				rawKeyHint(`${keyText("app.clear")} twice`, "exit"),
				hint("app.exit", "exit on empty prompt"),
				hint("app.mode.cycle", "cycle mode"),
				hint("app.thinking.cycle", "cycle thinking level"),
				rawKeyHint(`${keyText("app.model.cycleForward")}/${keyText("app.model.cycleBackward")}`, "cycle models"),
				hint("app.model.select", "select model"),
				hint("app.tools.expand", "expand tools and startup help"),
				hint("app.thinking.toggle", "expand thinking"),
				hint("app.editor.external", "external editor"),
				rawKeyHint("/", "commands"),
				rawKeyHint("!", "run bash"),
				rawKeyHint("!!", "run bash without context"),
				hint("app.message.followUp", "queue follow-up"),
				hint("app.message.dequeue", "edit queued messages"),
				hint("app.clipboard.pasteImage", "paste image"),
				rawKeyHint("drop files", "attach"),
			].join("\n");
			const compactInstructions = [
				hint("app.mode.cycle", "mode"),
				rawKeyHint("/", "commands"),
				rawKeyHint("!", "bash"),
				hint("app.interrupt", "interrupt"),
			].join(theme.fg("muted", " · "));
			const compactOnboarding = theme.fg(
				"dim",
				`Press ${keyText("app.tools.expand")} to expand startup help and raw tool output.`,
			);
			this.builtInHeader = new WelcomeScreenComponent({
				version: this.version,
				modelLabel,
				cwdLabel,
				modeLabel: this.session.getAgentModeLabel(),
				compactHints: compactInstructions,
				expandedHints: expandedInstructions,
				expandHint: compactOnboarding,
				changelogMarkdown: this.changelogMarkdown,
				projectWarning: getHomeDirectoryWarning(cwd, os.homedir()),
				recentActivity: this.getStartupRecentActivity(),
				expanded: this.getStartupExpansionState(),
			});

			// Setup UI layout
			this.headerContainer.addChild(new Spacer(1));
			this.headerContainer.addChild(this.builtInHeader);
			this.headerContainer.addChild(new Spacer(1));
		} else {
			// Minimal header when silenced
			this.builtInHeader = new Text("", 0, 0);
			this.headerContainer.addChild(this.builtInHeader);
		}

		this.ui.addChild(this.chatContainer);
		this.ui.addChild(this.pendingMessagesContainer);
		this.ui.addChild(this.statusContainer);
		this.renderWidgets(); // Initialize with default spacer
		this.ui.addChild(this.widgetContainerAbove);
		this.ui.addChild(this.approvalContainer);
		this.ui.addChild(this.editorContainer);
		this.ui.addChild(this.widgetContainerBelow);
		this.ui.addChild(this.footer);
		this.ui.setFocus(this.editor);

		this.setupKeyHandlers();
		this.setupEditorSubmitHandler();

		// Start the UI before initializing extensions so session_start handlers can use interactive dialogs
		this.ui.start();
		this.isInitialized = true;

		// Initialize extensions first so resources are shown before messages
		await this.rebindCurrentSession();

		// Render initial messages AFTER showing loaded resources
		this.renderInitialMessages();

		// Set up theme file watcher
		onThemeChange(() => {
			this.ui.invalidate();
			this.updateEditorBorderColor();
			this.ui.requestRender();
		});

		// Set up git branch watcher (uses provider instead of footer)
		this.footerDataProvider.onBranchChange(() => {
			this.ui.requestRender();
		});

		// Initialize available provider count for footer display
		await this.updateAvailableProviderCount();
	}

	/**
	 * Update terminal title with session name and cwd.
	 */
	private updateTerminalTitle(): void {
		const cwdBasename = path.basename(this.sessionManager.getCwd());
		const sessionName = this.sessionManager.getSessionName();
		if (sessionName) {
			this.ui.terminal.setTitle(`${APP_TITLE} - ${sessionName} - ${cwdBasename}`);
		} else {
			this.ui.terminal.setTitle(`${APP_TITLE} - ${cwdBasename}`);
		}
	}

	/**
	 * Run the interactive mode. This is the main entry point.
	 * Initializes the UI, shows warnings, processes initial messages, and starts the interactive loop.
	 */
	async run(): Promise<void> {
		// Bump the persisted startup counter once per interactive session.
		// This drives the spinner-tip cooldown logic in `pickTipForTurn` and
		// is intentionally NOT bumped in `init()` so startup-benchmark mode
		// (which calls `init()` and exits) does not inflate the counter.
		this.numStartups = this.tipHistory.bumpNumStartups();

		await this.init();

		// Start version check asynchronously
		checkForNewPiVersion(this.version).then((newVersion) => {
			if (newVersion) {
				this.showNewVersionNotification(newVersion);
			}
		});

		// Start package update check asynchronously
		this.checkForPackageUpdates().then((updates) => {
			if (updates.length > 0) {
				this.showPackageUpdateNotification(updates);
			}
		});

		// Check tmux keyboard setup asynchronously
		this.checkTmuxKeyboardSetup().then((warning) => {
			if (warning) {
				this.showWarning(warning);
			}
		});

		// Show startup warnings
		const { migratedProviders, modelFallbackMessage, initialMessage, initialImages, initialMessages } = this.options;

		if (migratedProviders && migratedProviders.length > 0) {
			this.showWarning(`Migrated credentials to auth.json: ${migratedProviders.join(", ")}`);
		}

		const modelsJsonError = this.session.modelRegistry.getError();
		if (modelsJsonError) {
			this.showError(`models.json error: ${modelsJsonError}`);
		}

		if (modelFallbackMessage) {
			this.showWarning(modelFallbackMessage);
		}

		// Process initial messages
		if (initialMessage) {
			try {
				await this.session.prompt(initialMessage, { images: initialImages });
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
				this.showError(errorMessage);
			}
		}

		if (initialMessages) {
			for (const message of initialMessages) {
				try {
					await this.session.prompt(message);
				} catch (error: unknown) {
					const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
					this.showError(errorMessage);
				}
			}
		}

		// Main interactive loop
		while (true) {
			const userInput = await this.getUserInput();
			try {
				await this.session.prompt(userInput);
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
				this.showError(errorMessage);
			}
		}
	}

	private async checkForPackageUpdates(): Promise<string[]> {
		if (process.env.NEO_CODE_OFFLINE) {
			return [];
		}

		try {
			const packageManager = new DefaultPackageManager({
				cwd: this.sessionManager.getCwd(),
				agentDir: getAgentDir(),
				settingsManager: this.settingsManager,
			});
			const updates = await packageManager.checkForAvailableUpdates();
			return updates.map((update) => update.displayName);
		} catch {
			return [];
		}
	}

	private async checkTmuxKeyboardSetup(): Promise<string | undefined> {
		if (!process.env.TMUX) return undefined;

		const runTmuxShow = (option: string): Promise<string | undefined> => {
			return new Promise((resolve) => {
				const proc = spawn("tmux", ["show", "-gv", option], {
					stdio: ["ignore", "pipe", "ignore"],
				});
				let stdout = "";
				const timer = setTimeout(() => {
					proc.kill();
					resolve(undefined);
				}, 2000);

				proc.stdout?.on("data", (data) => {
					stdout += data.toString();
				});
				proc.on("error", () => {
					clearTimeout(timer);
					resolve(undefined);
				});
				proc.on("close", (code) => {
					clearTimeout(timer);
					resolve(code === 0 ? stdout.trim() : undefined);
				});
			});
		};

		const [extendedKeys, extendedKeysFormat] = await Promise.all([
			runTmuxShow("extended-keys"),
			runTmuxShow("extended-keys-format"),
		]);

		// If we couldn't query tmux (timeout, sandbox, etc.), don't warn
		if (extendedKeys === undefined) return undefined;

		if (extendedKeys !== "on" && extendedKeys !== "always") {
			return "tmux extended-keys is off. Modified Enter keys may not work. Add `set -g extended-keys on` to ~/.tmux.conf and restart tmux.";
		}

		if (extendedKeysFormat === "xterm") {
			return "tmux extended-keys-format is xterm. Neo Code works best with csi-u. Add `set -g extended-keys-format csi-u` to ~/.tmux.conf and restart tmux.";
		}

		return undefined;
	}

	/**
	 * Get changelog entries to display on startup.
	 * Only shows new entries since last seen version, skips for resumed sessions.
	 */
	private getChangelogForDisplay(): string | undefined {
		// Skip changelog for resumed/continued sessions (already have messages)
		if (this.session.state.messages.length > 0) {
			return undefined;
		}

		const lastVersion = this.settingsManager.getLastChangelogVersion();
		const entries = getAllChangelogEntries();

		if (!lastVersion) {
			// Fresh install - record the version, send telemetry, don't show changelog
			this.settingsManager.setLastChangelogVersion(VERSION);
			this.reportInstallTelemetry(VERSION, "fresh_install");
			return undefined;
		}

		const newEntries = getNewEntries(entries, lastVersion);
		if (newEntries.length > 0) {
			this.settingsManager.setLastChangelogVersion(VERSION);
			this.reportInstallTelemetry(VERSION, "update");
			return formatChangelogEntries(newEntries);
		}

		return undefined;
	}

	private reportInstallTelemetry(version: string, event: InstallTelemetryEvent): void {
		if (process.env.NEO_CODE_OFFLINE) {
			return;
		}

		if (!isInstallTelemetryEnabled(this.settingsManager)) {
			return;
		}

		const payload = buildInstallTelemetryPayload(version, event, detectInstallMethod());
		void fetch("https://api.neosantara.xyz/api/report-install", {
			method: "POST",
			headers: {
				"User-Agent": getNeosantaraUserAgent(version),
				"Content-Type": "application/json",
				accept: "application/json",
			},
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(5000),
		})
			.then(() => undefined)
			.catch(() => undefined);
	}

	private getMarkdownThemeWithSettings(): MarkdownTheme {
		return {
			...getMarkdownTheme(),
			codeBlockIndent: this.settingsManager.getCodeBlockIndent(),
		};
	}

	// =========================================================================
	// Extension System
	// =========================================================================

	private formatDisplayPath(p: string): string {
		const home = os.homedir();
		let result = p;

		// Replace home directory with ~
		if (result.startsWith(home)) {
			result = `~${result.slice(home.length)}`;
		}

		return result;
	}

	private formatCompactDisplayPath(p: string, maxLength = 76): string {
		const display = this.formatDisplayPath(p).replace(/\\/g, "/");
		if (display.length <= maxLength) return display;

		const parts = display.split("/").filter(Boolean);
		const prefix = display.startsWith("~/") ? "~/" : display.startsWith("/") ? "/" : "";
		const tail = parts.slice(-2).join("/");
		const compact = `${prefix}…/${tail}`;
		if (compact.length <= maxLength) return compact;
		const basename = parts.at(-1) || display;
		return basename.length <= maxLength ? `…/${basename}` : `…${basename.slice(-(maxLength - 1))}`;
	}

	private formatExtensionDisplayPath(path: string): string {
		let result = this.formatDisplayPath(path);
		result = result.replace(/\/index\.ts$/, "").replace(/\/index\.js$/, "");
		return result;
	}

	private formatContextPath(p: string): string {
		const cwd = path.resolve(this.sessionManager.getCwd());
		const absolutePath = path.isAbsolute(p) ? path.resolve(p) : path.resolve(cwd, p);
		const relativePath = getCwdRelativePath(absolutePath, cwd);
		if (relativePath !== undefined) {
			return relativePath;
		}

		return this.formatDisplayPath(absolutePath);
	}

	private formatContextFileScope(p: string): string {
		const cwd = path.resolve(this.sessionManager.getCwd());
		const absolutePath = path.isAbsolute(p) ? path.resolve(p) : path.resolve(cwd, p);
		const contextDir = path.dirname(absolutePath);
		const homeDir = path.resolve(os.homedir());

		if (contextDir === cwd) {
			return "project";
		}

		if (contextDir === homeDir) {
			return "user";
		}

		const relativeFromContextDir = path.relative(contextDir, cwd);
		if (
			relativeFromContextDir &&
			!relativeFromContextDir.startsWith("..") &&
			!path.isAbsolute(relativeFromContextDir)
		) {
			return "parent";
		}

		return "global";
	}

	private formatContextFileTree(files: Array<{ path: string }>, compact = true): string {
		return files
			.map((file, index) => {
				const branch = index === files.length - 1 ? "└─" : "├─";
				const scope = this.formatContextFileScope(file.path);
				const displayPath = compact ? this.formatContextPath(file.path) : this.formatDisplayPath(file.path);
				return theme.fg("dim", `  ${branch} ${scope}: ${displayPath}`);
			})
			.join("\n");
	}

	private getStartupRecentActivity(): string[] {
		const stats = this.session.getSessionStats();
		if (stats.totalMessages <= 0) return [];

		const lines = [
			theme.fg(
				"muted",
				`Resumed session · ${stats.totalMessages.toLocaleString()} messages · ${stats.toolCalls.toLocaleString()} tool calls`,
			),
		];
		const usage = stats.contextUsage;
		if (typeof usage?.percent === "number") {
			lines.push(theme.fg("muted", `Context ${usage.percent.toFixed(1)}% used · /context for details`));
		}
		return lines;
	}

	private getStartupExpansionState(): boolean {
		return this.options.verbose || this.toolOutputExpanded;
	}

	/**
	 * Get a short path relative to the package root for display.
	 */
	private getShortPath(fullPath: string, sourceInfo?: SourceInfo): string {
		const baseDir = sourceInfo?.baseDir;
		if (baseDir && this.isPackageSource(sourceInfo)) {
			const relativePath = path.relative(path.resolve(baseDir), path.resolve(fullPath));
			if (
				relativePath &&
				relativePath !== "." &&
				!relativePath.startsWith("..") &&
				!relativePath.startsWith(`..${path.sep}`) &&
				!path.isAbsolute(relativePath)
			) {
				return relativePath.replace(/\\/g, "/");
			}
		}

		const source = sourceInfo?.source ?? "";
		const npmMatch = fullPath.match(/node_modules\/(@?[^/]+(?:\/[^/]+)?)\/(.*)/);
		if (npmMatch && source.startsWith("npm:")) {
			return npmMatch[2];
		}

		const gitMatch = fullPath.match(/git\/[^/]+\/[^/]+\/(.*)/);
		if (gitMatch && source.startsWith("git:")) {
			return gitMatch[1];
		}

		return this.formatDisplayPath(fullPath);
	}

	private getCompactPathLabel(resourcePath: string, sourceInfo?: SourceInfo): string {
		const shortPath = this.getShortPath(resourcePath, sourceInfo);
		const normalizedPath = shortPath.replace(/\\/g, "/");
		const segments = normalizedPath.split("/").filter((segment) => segment.length > 0 && segment !== "~");
		if (segments.length > 0) {
			return segments[segments.length - 1]!;
		}
		return shortPath;
	}

	private getCompactPackageSourceLabel(sourceInfo?: SourceInfo): string {
		const source = sourceInfo?.source ?? "";
		if (source.startsWith("npm:")) {
			return source.slice("npm:".length) || source;
		}

		const gitSource = parseGitUrl(source);
		if (gitSource) {
			return gitSource.path || source;
		}

		return source;
	}

	private getCompactExtensionLabel(resourcePath: string, sourceInfo?: SourceInfo): string {
		if (!this.isPackageSource(sourceInfo)) {
			return this.getCompactPathLabel(resourcePath, sourceInfo);
		}

		const sourceLabel = this.getCompactPackageSourceLabel(sourceInfo);
		if (!sourceLabel) {
			return this.getCompactPathLabel(resourcePath, sourceInfo);
		}

		const shortPath = this.getShortPath(resourcePath, sourceInfo).replace(/\\/g, "/");
		const packagePath = shortPath.startsWith("extensions/") ? shortPath.slice("extensions/".length) : shortPath;
		const parsedPath = path.posix.parse(packagePath);

		if (parsedPath.name === "index") {
			return !parsedPath.dir || parsedPath.dir === "." ? sourceLabel : `${sourceLabel}:${parsedPath.dir}`;
		}

		return `${sourceLabel}:${packagePath}`;
	}

	private getCompactDisplayPathSegments(resourcePath: string): string[] {
		return this.formatDisplayPath(resourcePath)
			.replace(/\\/g, "/")
			.split("/")
			.filter((segment) => segment.length > 0 && segment !== "~");
	}

	private getCompactNonPackageExtensionLabel(
		resourcePath: string,
		index: number,
		allPaths: Array<{ path: string; segments: string[] }>,
	): string {
		const segments = allPaths[index]?.segments;
		if (!segments || segments.length === 0) {
			return this.getCompactPathLabel(resourcePath);
		}

		for (let segmentCount = 1; segmentCount <= segments.length; segmentCount += 1) {
			const candidate = segments.slice(-segmentCount).join("/");
			const isUnique = allPaths.every((item, itemIndex) => {
				if (itemIndex === index) {
					return true;
				}
				return item.segments.slice(-segmentCount).join("/") !== candidate;
			});

			if (isUnique) {
				return candidate;
			}
		}

		return segments.join("/");
	}

	private getCompactExtensionLabels(extensions: Array<{ path: string; sourceInfo?: SourceInfo }>): string[] {
		const nonPackageExtensions = extensions
			.map((extension) => {
				const segments = this.getCompactDisplayPathSegments(extension.path);
				const lastSegment = segments[segments.length - 1];
				if (segments.length > 1 && (lastSegment === "index.ts" || lastSegment === "index.js")) {
					segments.pop();
				}
				return {
					path: extension.path,
					sourceInfo: extension.sourceInfo,
					segments,
				};
			})
			.filter((extension) => !this.isPackageSource(extension.sourceInfo));

		return extensions.map((extension) => {
			if (this.isPackageSource(extension.sourceInfo)) {
				return this.getCompactExtensionLabel(extension.path, extension.sourceInfo);
			}

			const nonPackageIndex = nonPackageExtensions.findIndex((item) => item.path === extension.path);
			if (nonPackageIndex === -1) {
				return this.getCompactPathLabel(extension.path, extension.sourceInfo);
			}

			return this.getCompactNonPackageExtensionLabel(extension.path, nonPackageIndex, nonPackageExtensions);
		});
	}

	private getDisplaySourceInfo(sourceInfo?: SourceInfo): {
		label: string;
		scopeLabel?: string;
		color: "accent" | "muted";
	} {
		const source = sourceInfo?.source ?? "local";
		const scope = sourceInfo?.scope ?? "project";
		if (source === "local") {
			if (scope === "user") {
				return { label: "user", color: "muted" };
			}
			if (scope === "project") {
				return { label: "project", color: "muted" };
			}
			if (scope === "temporary") {
				return { label: "path", scopeLabel: "temp", color: "muted" };
			}
			return { label: "path", color: "muted" };
		}

		if (source === "cli") {
			return {
				label: "path",
				scopeLabel: scope === "temporary" ? "temp" : undefined,
				color: "muted",
			};
		}

		const scopeLabel =
			scope === "user" ? "user" : scope === "project" ? "project" : scope === "temporary" ? "temp" : undefined;
		return { label: source, scopeLabel, color: "accent" };
	}

	private getScopeGroup(sourceInfo?: SourceInfo): "user" | "project" | "path" {
		const source = sourceInfo?.source ?? "local";
		const scope = sourceInfo?.scope ?? "project";
		if (source === "cli" || scope === "temporary") return "path";
		if (scope === "user") return "user";
		if (scope === "project") return "project";
		return "path";
	}

	private isPackageSource(sourceInfo?: SourceInfo): boolean {
		const source = sourceInfo?.source ?? "";
		return source.startsWith("npm:") || source.startsWith("git:");
	}

	private buildScopeGroups(items: Array<{ path: string; sourceInfo?: SourceInfo }>): Array<{
		scope: "user" | "project" | "path";
		paths: Array<{ path: string; sourceInfo?: SourceInfo }>;
		packages: Map<string, Array<{ path: string; sourceInfo?: SourceInfo }>>;
	}> {
		const groups: Record<
			"user" | "project" | "path",
			{
				scope: "user" | "project" | "path";
				paths: Array<{ path: string; sourceInfo?: SourceInfo }>;
				packages: Map<string, Array<{ path: string; sourceInfo?: SourceInfo }>>;
			}
		> = {
			user: { scope: "user", paths: [], packages: new Map() },
			project: { scope: "project", paths: [], packages: new Map() },
			path: { scope: "path", paths: [], packages: new Map() },
		};

		for (const item of items) {
			const groupKey = this.getScopeGroup(item.sourceInfo);
			const group = groups[groupKey];
			const source = item.sourceInfo?.source ?? "local";

			if (this.isPackageSource(item.sourceInfo)) {
				const list = group.packages.get(source) ?? [];
				list.push(item);
				group.packages.set(source, list);
			} else {
				group.paths.push(item);
			}
		}

		return [groups.project, groups.user, groups.path].filter(
			(group) => group.paths.length > 0 || group.packages.size > 0,
		);
	}

	private formatScopeGroups(
		groups: Array<{
			scope: "user" | "project" | "path";
			paths: Array<{ path: string; sourceInfo?: SourceInfo }>;
			packages: Map<string, Array<{ path: string; sourceInfo?: SourceInfo }>>;
		}>,
		options: {
			formatPath: (item: { path: string; sourceInfo?: SourceInfo }) => string;
			formatPackagePath: (item: { path: string; sourceInfo?: SourceInfo }, source: string) => string;
		},
	): string {
		const lines: string[] = [];

		for (const group of groups) {
			lines.push(`  ${theme.fg("accent", group.scope)}`);

			const sortedPaths = [...group.paths].sort((a, b) => a.path.localeCompare(b.path));
			for (const item of sortedPaths) {
				lines.push(theme.fg("dim", `    ${options.formatPath(item)}`));
			}

			const sortedPackages = Array.from(group.packages.entries()).sort(([a], [b]) => a.localeCompare(b));
			for (const [source, items] of sortedPackages) {
				lines.push(`    ${theme.fg("mdLink", source)}`);
				const sortedPackagePaths = [...items].sort((a, b) => a.path.localeCompare(b.path));
				for (const item of sortedPackagePaths) {
					lines.push(theme.fg("dim", `      ${options.formatPackagePath(item, source)}`));
				}
			}
		}

		return lines.join("\n");
	}

	private findSourceInfoForPath(p: string, sourceInfos: Map<string, SourceInfo>): SourceInfo | undefined {
		const exact = sourceInfos.get(p);
		if (exact) return exact;

		let current = p;
		while (current.includes("/")) {
			current = current.substring(0, current.lastIndexOf("/"));
			const parent = sourceInfos.get(current);
			if (parent) return parent;
		}

		return undefined;
	}

	private formatPathWithSource(p: string, sourceInfo?: SourceInfo): string {
		if (sourceInfo) {
			const shortPath = this.getShortPath(p, sourceInfo);
			const { label, scopeLabel } = this.getDisplaySourceInfo(sourceInfo);
			const labelText = scopeLabel ? `${label} (${scopeLabel})` : label;
			return `${labelText} ${shortPath}`;
		}
		return this.formatDisplayPath(p);
	}

	private formatDiagnostics(diagnostics: readonly ResourceDiagnostic[], sourceInfos: Map<string, SourceInfo>): string {
		const lines: string[] = [];

		// Group collision diagnostics by name
		const collisions = new Map<string, ResourceDiagnostic[]>();
		const otherDiagnostics: ResourceDiagnostic[] = [];

		for (const d of diagnostics) {
			if (d.type === "collision" && d.collision) {
				const list = collisions.get(d.collision.name) ?? [];
				list.push(d);
				collisions.set(d.collision.name, list);
			} else {
				otherDiagnostics.push(d);
			}
		}

		// Format collision diagnostics grouped by name
		for (const [name, collisionList] of collisions) {
			const first = collisionList[0]?.collision;
			if (!first) continue;
			lines.push(theme.fg("warning", `  "${name}" collision:`));
			lines.push(
				theme.fg(
					"dim",
					`    ${theme.fg("success", "✓")} ${this.formatPathWithSource(first.winnerPath, this.findSourceInfoForPath(first.winnerPath, sourceInfos))}`,
				),
			);
			for (const d of collisionList) {
				if (d.collision) {
					lines.push(
						theme.fg(
							"dim",
							`    ${theme.fg("warning", "✗")} ${this.formatPathWithSource(d.collision.loserPath, this.findSourceInfoForPath(d.collision.loserPath, sourceInfos))} (skipped)`,
						),
					);
				}
			}
		}

		for (const d of otherDiagnostics) {
			if (d.path) {
				const formattedPath = this.formatPathWithSource(d.path, this.findSourceInfoForPath(d.path, sourceInfos));
				lines.push(theme.fg(d.type === "error" ? "error" : "warning", `  ${formattedPath}`));
				lines.push(theme.fg(d.type === "error" ? "error" : "warning", `    ${d.message}`));
			} else {
				lines.push(theme.fg(d.type === "error" ? "error" : "warning", `  ${d.message}`));
			}
		}

		return lines.join("\n");
	}

	private showLoadedResources(options?: {
		extensions?: Array<{ path: string; sourceInfo?: SourceInfo }>;
		force?: boolean;
		showDiagnosticsWhenQuiet?: boolean;
	}): void {
		const showListing = options?.force || this.options.verbose || !this.settingsManager.getQuietStartup();
		const showDiagnostics = showListing || options?.showDiagnosticsWhenQuiet === true;
		if (!showListing && !showDiagnostics) {
			return;
		}

		const sectionHeader = (name: string, color: ThemeColor = "mdHeading") => theme.fg(color, `[${name}]`);
		const formatCompactList = (items: string[], options?: { sort?: boolean }): string => {
			const labels = items.map((item) => item.trim()).filter((item) => item.length > 0);
			if (options?.sort !== false) {
				labels.sort((a, b) => a.localeCompare(b));
			}
			return theme.fg("dim", `  ${labels.join(", ")}`);
		};
		const addLoadedSection = (
			name: string,
			collapsedBody: string,
			expandedBody = collapsedBody,
			color: ThemeColor = "mdHeading",
		): void => {
			const section = new ExpandableText(
				() => `${sectionHeader(name, color)}\n${collapsedBody}`,
				() => `${sectionHeader(name, color)}\n${expandedBody}`,
				this.getStartupExpansionState(),
				0,
				0,
			);
			this.chatContainer.addChild(section);
			this.chatContainer.addChild(new Spacer(1));
		};

		const skillsResult = this.session.resourceLoader.getSkills();
		const promptsResult = this.session.resourceLoader.getPrompts();
		const themesResult = this.session.resourceLoader.getThemes();
		const extensions =
			options?.extensions ??
			this.session.resourceLoader.getExtensions().extensions.map((extension) => ({
				path: extension.path,
				sourceInfo: extension.sourceInfo,
			}));
		const sourceInfos = new Map<string, SourceInfo>();
		for (const extension of extensions) {
			if (extension.sourceInfo) {
				sourceInfos.set(extension.path, extension.sourceInfo);
			}
		}
		for (const skill of skillsResult.skills) {
			if (skill.sourceInfo) {
				sourceInfos.set(skill.filePath, skill.sourceInfo);
			}
		}
		for (const prompt of promptsResult.prompts) {
			if (prompt.sourceInfo) {
				sourceInfos.set(prompt.filePath, prompt.sourceInfo);
			}
		}
		for (const loadedTheme of themesResult.themes) {
			if (loadedTheme.sourcePath && loadedTheme.sourceInfo) {
				sourceInfos.set(loadedTheme.sourcePath, loadedTheme.sourceInfo);
			}
		}

		if (showListing) {
			const contextFiles = this.session.resourceLoader.getAgentsFiles().agentsFiles;
			if (contextFiles.length > 0) {
				this.chatContainer.addChild(new Spacer(1));
				const contextCompactList = this.formatContextFileTree(contextFiles, true);
				const contextList = `${this.formatContextFileTree(contextFiles, false)}\n${theme.fg(
					"muted",
					"  Loaded in this order; later project files can narrow broader parent/user instructions.",
				)}`;
				addLoadedSection("Context", contextCompactList, contextList);
			}

			const skills = skillsResult.skills;
			if (skills.length > 0) {
				const groups = this.buildScopeGroups(
					skills.map((skill) => ({
						path: skill.filePath,
						sourceInfo: skill.sourceInfo,
					})),
				);
				const skillList = this.formatScopeGroups(groups, {
					formatPath: (item) => this.formatDisplayPath(item.path),
					formatPackagePath: (item) => this.getShortPath(item.path, item.sourceInfo),
				});
				const skillCompactList = formatCompactList(skills.map((skill) => skill.name));
				addLoadedSection("Skills", skillCompactList, skillList);
			}

			const templates = this.session.promptTemplates;
			if (templates.length > 0) {
				const groups = this.buildScopeGroups(
					templates.map((template) => ({
						path: template.filePath,
						sourceInfo: template.sourceInfo,
					})),
				);
				const templateByPath = new Map(templates.map((t) => [t.filePath, t]));
				const templateList = this.formatScopeGroups(groups, {
					formatPath: (item) => {
						const template = templateByPath.get(item.path);
						return template ? `/${template.name}` : this.formatDisplayPath(item.path);
					},
					formatPackagePath: (item) => {
						const template = templateByPath.get(item.path);
						return template ? `/${template.name}` : this.formatDisplayPath(item.path);
					},
				});
				const promptCompactList = formatCompactList(templates.map((template) => `/${template.name}`));
				addLoadedSection("Prompts", promptCompactList, templateList);
			}

			if (extensions.length > 0) {
				const groups = this.buildScopeGroups(extensions);
				const extList = this.formatScopeGroups(groups, {
					formatPath: (item) => this.formatExtensionDisplayPath(item.path),
					formatPackagePath: (item) =>
						this.formatExtensionDisplayPath(this.getShortPath(item.path, item.sourceInfo)),
				});
				const extensionCompactList = formatCompactList(this.getCompactExtensionLabels(extensions));
				addLoadedSection("Extensions", extensionCompactList, extList, "mdHeading");
			}

			// Show loaded themes (excluding built-in)
			const loadedThemes = themesResult.themes;
			const customThemes = loadedThemes.filter((t) => t.sourcePath);
			if (customThemes.length > 0) {
				const groups = this.buildScopeGroups(
					customThemes.map((loadedTheme) => ({
						path: loadedTheme.sourcePath!,
						sourceInfo: loadedTheme.sourceInfo,
					})),
				);
				const themeList = this.formatScopeGroups(groups, {
					formatPath: (item) => this.formatDisplayPath(item.path),
					formatPackagePath: (item) => this.getShortPath(item.path, item.sourceInfo),
				});
				const themeCompactList = formatCompactList(
					customThemes.map(
						(loadedTheme) =>
							loadedTheme.name ?? this.getCompactPathLabel(loadedTheme.sourcePath!, loadedTheme.sourceInfo),
					),
				);
				addLoadedSection("Themes", themeCompactList, themeList);
			}
		}

		if (showDiagnostics) {
			const skillDiagnostics = skillsResult.diagnostics;
			if (skillDiagnostics.length > 0) {
				const warningLines = this.formatDiagnostics(skillDiagnostics, sourceInfos);
				this.chatContainer.addChild(new Text(`${theme.fg("warning", "[Skill conflicts]")}\n${warningLines}`, 0, 0));
				this.chatContainer.addChild(new Spacer(1));
			}

			const promptDiagnostics = promptsResult.diagnostics;
			if (promptDiagnostics.length > 0) {
				const warningLines = this.formatDiagnostics(promptDiagnostics, sourceInfos);
				this.chatContainer.addChild(
					new Text(`${theme.fg("warning", "[Prompt conflicts]")}\n${warningLines}`, 0, 0),
				);
				this.chatContainer.addChild(new Spacer(1));
			}

			const extensionDiagnostics: ResourceDiagnostic[] = [];
			const extensionErrors = this.session.resourceLoader.getExtensions().errors;
			if (extensionErrors.length > 0) {
				for (const error of extensionErrors) {
					extensionDiagnostics.push({
						type: "error",
						message: error.error,
						path: error.path,
					});
				}
			}

			const commandDiagnostics = this.session.extensionRunner.getCommandDiagnostics();
			extensionDiagnostics.push(...commandDiagnostics);
			extensionDiagnostics.push(...this.getBuiltInCommandConflictDiagnostics(this.session.extensionRunner));

			const shortcutDiagnostics = this.session.extensionRunner.getShortcutDiagnostics();
			extensionDiagnostics.push(...shortcutDiagnostics);

			if (extensionDiagnostics.length > 0) {
				const warningLines = this.formatDiagnostics(extensionDiagnostics, sourceInfos);
				this.chatContainer.addChild(
					new Text(`${theme.fg("warning", "[Extension issues]")}\n${warningLines}`, 0, 0),
				);
				this.chatContainer.addChild(new Spacer(1));
			}

			const themeDiagnostics = themesResult.diagnostics;
			if (themeDiagnostics.length > 0) {
				const warningLines = this.formatDiagnostics(themeDiagnostics, sourceInfos);
				this.chatContainer.addChild(new Text(`${theme.fg("warning", "[Theme conflicts]")}\n${warningLines}`, 0, 0));
				this.chatContainer.addChild(new Spacer(1));
			}
		}
	}

	/**
	 * Initialize the extension system with TUI-based UI context.
	 */
	private async bindCurrentSessionExtensions(): Promise<void> {
		const uiContext = this.createExtensionUIContext();
		await this.session.bindExtensions({
			uiContext,
			commandContextActions: {
				waitForIdle: () => this.session.agent.waitForIdle(),
				newSession: async (options) => {
					if (this.loadingAnimation) {
						this.loadingAnimation.stop();
						this.loadingAnimation = undefined;
					}
					this.statusContainer.clear();
					try {
						const result = await this.runtimeHost.newSession(options);
						if (!result.cancelled) {
							this.renderCurrentSessionState();
							this.ui.requestRender();
						}
						return result;
					} catch (error: unknown) {
						return this.handleFatalRuntimeError("Failed to create session", error);
					}
				},
				fork: async (entryId, options) => {
					try {
						const result = await this.runtimeHost.fork(entryId, options);
						if (!result.cancelled) {
							this.renderCurrentSessionState();
							this.editor.setText(result.selectedText ?? "");
							this.showStatus("Forked to new session");
						}
						return { cancelled: result.cancelled };
					} catch (error: unknown) {
						return this.handleFatalRuntimeError("Failed to fork session", error);
					}
				},
				navigateTree: async (targetId, options) => {
					const result = await this.session.navigateTree(targetId, {
						summarize: options?.summarize,
						customInstructions: options?.customInstructions,
						replaceInstructions: options?.replaceInstructions,
						label: options?.label,
					});
					if (result.cancelled) {
						return { cancelled: true };
					}

					this.chatContainer.clear();
					this.renderInitialMessages();
					if (result.editorText && !this.editor.getText().trim()) {
						this.editor.setText(result.editorText);
					}
					this.showStatus("Navigated to selected point");
					void this.flushCompactionQueue({ willRetry: false });
					return { cancelled: false };
				},
				switchSession: async (sessionPath, options) => {
					return this.handleResumeSession(sessionPath, options);
				},
				reload: async () => {
					await this.handleReloadCommand();
				},
			},
			shutdownHandler: () => {
				this.shutdownRequested = true;
				if (!this.session.isStreaming) {
					void this.shutdown();
				}
			},
			onError: (error) => {
				this.showExtensionError(error.extensionPath, error.error, error.stack);
			},
		});

		setRegisteredThemes(this.session.resourceLoader.getThemes().themes);
		this.setupAutocompleteProvider();

		const extensionRunner = this.session.extensionRunner;
		this.setupExtensionShortcuts(extensionRunner);
		this.showLoadedResources({ force: false, showDiagnosticsWhenQuiet: true });
		this.showStartupNoticesIfNeeded();
	}

	private applyRuntimeSettings(): void {
		this.footer.setSession(this.session);
		this.footer.setAutoCompactEnabled(this.session.autoCompactionEnabled);
		this.footerDataProvider.setCwd(this.sessionManager.getCwd());
		this.hideThinkingBlock = this.settingsManager.getHideThinkingBlock();
		this.ui.setShowHardwareCursor(this.settingsManager.getShowHardwareCursor());
		this.ui.setClearOnShrink(this.settingsManager.getClearOnShrink());
		const editorPaddingX = this.settingsManager.getEditorPaddingX();
		const autocompleteMaxVisible = this.settingsManager.getAutocompleteMaxVisible();
		this.defaultEditor.setPaddingX(editorPaddingX);
		this.defaultEditor.setAutocompleteMaxVisible(autocompleteMaxVisible);
		if (this.editor !== this.defaultEditor) {
			this.editor.setPaddingX?.(editorPaddingX);
			this.editor.setAutocompleteMaxVisible?.(autocompleteMaxVisible);
		}
	}

	private async rebindCurrentSession(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.session.setToolApprovalHandler((request) => this.requestToolApproval(request));
		this.applyRuntimeSettings();
		await this.bindCurrentSessionExtensions();
		this.subscribeToAgent();
		await this.updateAvailableProviderCount();
		this.updateEditorBorderColor();
		this.updateTerminalTitle();
	}

	private async handleFatalRuntimeError(prefix: string, error: unknown): Promise<never> {
		const message = error instanceof Error ? error.message : String(error);
		this.showError(`${prefix}: ${message}`);
		stopThemeWatcher();
		this.stop();
		exitAfterCleanup(1);
	}

	private renderCurrentSessionState(): void {
		this.chatContainer.clear();
		this.pendingMessagesContainer.clear();
		this.approvalContainer.clear();
		this.restorePromptEditorFocus();
		this.compactionQueuedMessages = [];
		this.streamingComponent = undefined;
		this.streamingMessage = undefined;
		this.pendingTools.clear();
		this.setToolActivityAnimationPaused(false);
		this.pendingToolApproval = undefined;
		this.renderInitialMessages();
	}

	/**
	 * Get a registered tool definition by name (for custom rendering).
	 */
	private getRegisteredToolDefinition(toolName: string) {
		return this.session.getToolDefinition(toolName);
	}

	/**
	 * Set up keyboard shortcuts registered by extensions.
	 */
	private setupExtensionShortcuts(extensionRunner: ExtensionRunner): void {
		const shortcuts = extensionRunner.getShortcuts(this.keybindings.getEffectiveConfig());
		if (shortcuts.size === 0) return;

		// Create a context for shortcut handlers
		const createContext = (): ExtensionContext => ({
			ui: this.createExtensionUIContext(),
			hasUI: true,
			cwd: this.sessionManager.getCwd(),
			sessionManager: this.sessionManager,
			modelRegistry: this.session.modelRegistry,
			model: this.session.model,
			isIdle: () => !this.session.isStreaming,
			signal: this.session.agent.signal,
			abort: () => this.session.abort(),
			hasPendingMessages: () => this.session.pendingMessageCount > 0,
			shutdown: () => {
				this.shutdownRequested = true;
			},
			getContextUsage: () => this.session.getContextUsage(),
			compact: (options) => {
				void (async () => {
					try {
						const result = await this.session.compact(options?.customInstructions);
						options?.onComplete?.(result);
					} catch (error) {
						const err = error instanceof Error ? error : new Error(String(error));
						options?.onError?.(err);
					}
				})();
			},
			getSystemPrompt: () => this.session.systemPrompt,
		});

		// Set up the extension shortcut handler on the default editor
		this.defaultEditor.onExtensionShortcut = (data: string) => {
			for (const [shortcutStr, shortcut] of shortcuts) {
				// Cast to KeyId - extension shortcuts use the same format
				if (matchesKey(data, shortcutStr as KeyId)) {
					// Run handler async, don't block input
					Promise.resolve(shortcut.handler(createContext())).catch((err) => {
						this.showError(`Shortcut handler error: ${err instanceof Error ? err.message : String(err)}`);
					});
					return true;
				}
			}
			return false;
		};
	}

	/**
	 * Set extension status text in the footer.
	 */
	private setExtensionStatus(key: string, text: string | undefined): void {
		this.footerDataProvider.setExtensionStatus(key, text);
		this.ui.requestRender();
	}

	private getWorkingLoaderMessage(): string {
		return this.workingMessage ?? this.getDefaultWorkingMessageText();
	}

	private getDefaultWorkingMessageText(): string {
		return formatDefaultWorkingMessage(this.defaultWorkingMessages, this.defaultWorkingMessageIndex);
	}

	private getDefaultWorkingIndicatorOptions(mode: WorkingLoaderMode = "responding"): LoaderIndicatorOptions {
		return {
			frames: CLAUDE_STYLE_SPINNER_FRAMES.map((frame) => theme.fg("accent", frame)),
			intervalMs: 120,
			mode,
			shimmer: true,
			shimmerDirection: mode === "tool-input" ? "left-to-right" : "right-to-left",
			shimmerIntervalMs: 200,
			maxMessageWidth: 44,
			shimmerColorFn: (text) => theme.fg("accent", text),
			showStatus: true,
			elapsedAfterMs: 30_000,
			tokensAfterMs: 30_000,
			statusColorFn: (text) => theme.fg("dim", text),
			stalledDetection: true,
			stalledWarningColorFn: (text) => theme.fg("warning", text),
			stalledColorFn: (text) => theme.fg("error", text),
		};
	}

	private getWorkingIndicatorOptions(mode: WorkingLoaderMode = "responding"): LoaderIndicatorOptions {
		const defaults = this.getDefaultWorkingIndicatorOptions(mode);
		if (!this.workingIndicatorOptions) return defaults;

		return {
			...defaults,
			...this.workingIndicatorOptions,
			mode: this.workingIndicatorOptions.mode ?? mode,
			shimmer: this.workingIndicatorOptions.shimmer ?? defaults.shimmer,
			shimmerDirection: this.workingIndicatorOptions.shimmerDirection ?? defaults.shimmerDirection,
		};
	}

	private createWorkingLoader(): Loader {
		this.currentWorkingLoaderMode = "responding";
		return new Loader(
			this.ui,
			(spinner) => theme.fg("accent", spinner),
			(text) => theme.fg("muted", text),
			this.getWorkingLoaderMessage(),
			this.getWorkingIndicatorOptions(),
		);
	}

	/**
	 * Build a TipContext snapshot from current runtime state. Used both when
	 * picking a fresh tip on `agent_start` and when re-evaluating relevance
	 * during the same session (currently we only pick once per turn).
	 */
	private buildTipContext(): TipContext {
		const contextUsage = this.session.getContextUsage();
		const contextPercent =
			typeof contextUsage?.percent === "number" && Number.isFinite(contextUsage.percent)
				? contextUsage.percent
				: undefined;
		return {
			settings: this.settingsManager.getSettings(),
			platform: process.platform,
			isTermux: isTermuxEnvironment(),
			termuxApiAvailable: getTermuxApiCapabilities().available,
			isSshSession: Boolean(process.env.SSH_CONNECTION || process.env.SSH_CLIENT || process.env.MOSH_CONNECTION),
			numStartups: Math.max(1, this.numStartups),
			contextPercent,
		};
	}

	/**
	 * Pick a tip for the current turn (once per `agent_start`) and append a
	 * `└─ tip: ...` line to `statusContainer`. No-op when tips are disabled,
	 * the catalog has no eligible entries, or the working loader is hidden.
	 *
	 * Pick order:
	 *  1. Render-time overrides (e.g. high-context `/compact` reminder).
	 *     Override tips are not recorded, so they re-fire every turn until
	 *     the underlying condition clears.
	 *  2. Cooldown-based catalog pick. Recorded so the per-id cooldown
	 *     counter advances even if the line is later torn down (e.g. by an
	 *     extension UI takeover).
	 */
	private pickAndAttachTipLine(): void {
		if (this.tipPickedThisTurn) {
			this.attachExistingTipLine();
			return;
		}
		this.tipPickedThisTurn = true;
		if (
			!shouldAttachSpinnerTipForMode(this.currentWorkingLoaderMode) ||
			this.spinnerTipDismissedThisTurn ||
			this.workingMessage !== undefined
		) {
			return;
		}
		if (!this.workingVisible || !this.loadingAnimation) return;
		if (!this.settingsManager.getSpinnerTipsEnabled()) {
			this.currentTip = undefined;
			this.currentTipText = undefined;
			return;
		}
		const ctx = this.buildTipContext();
		const override = pickContextOverrideTip(ctx);
		if (override) {
			// Render-time override: do NOT record. The tip should keep firing
			// until the user reduces context (e.g. via /compact).
			this.currentTip = override;
			this.currentTipText = this.createTipLineComponent(override);
			this.statusContainer.addChild(this.currentTipText);
			return;
		}
		const tip = pickTipForTurn(ctx, this.tipHistory);
		if (!tip) {
			this.currentTip = undefined;
			this.currentTipText = undefined;
			return;
		}
		recordShownTip(tip, this.tipHistory);
		this.currentTip = tip;
		this.currentTipText = this.createTipLineComponent(tip);
		this.statusContainer.addChild(this.currentTipText);
	}

	/**
	 * Re-attach the tip line for the current turn after the loader was
	 * recreated (retry success, working-visibility toggle). Skips when no
	 * tip was picked this turn or when the line is already attached.
	 */
	private attachExistingTipLine(): void {
		if (
			!shouldAttachSpinnerTipForMode(this.currentWorkingLoaderMode) ||
			this.spinnerTipDismissedThisTurn ||
			this.workingMessage !== undefined
		) {
			return;
		}
		if (!this.currentTip || !this.workingVisible || !this.loadingAnimation) return;
		if (this.currentTipText && this.statusContainer.children.includes(this.currentTipText)) {
			return;
		}
		this.currentTipText = this.createTipLineComponent(this.currentTip);
		this.statusContainer.addChild(this.currentTipText);
	}

	private createTipLineComponent(tip: Tip): TruncatedText {
		// `TruncatedText` truncates to the current viewport width on render
		// so very narrow terminals (Termux portrait, split panes) never
		// wrap the tip line and break the 2-row spinner footprint.
		const prefix = theme.fg("dim", "└─ tip:");
		const body = theme.fg("dim", ` ${tip.content}`);
		return new TruncatedText(`${prefix}${body}`, 1, 0);
	}

	private detachCurrentTipLine(options: { dismissForTurn?: boolean } = {}): void {
		if (options.dismissForTurn) {
			this.spinnerTipDismissedThisTurn = true;
		}
		if (this.currentTipText && this.statusContainer.children.includes(this.currentTipText)) {
			this.statusContainer.removeChild(this.currentTipText);
		}
		this.currentTipText = undefined;
	}

	/** Reset per-turn tip state. Called at `agent_end` and on hard resets. */
	private clearSpinnerTipState(): void {
		this.tipPickedThisTurn = false;
		this.spinnerTipDismissedThisTurn = false;
		this.currentTip = undefined;
		this.currentTipText = undefined;
	}

	private getStreamingProgressValue(message: AssistantMessage | undefined = this.streamingMessage): number {
		if (!message) return 0;
		return message.content.reduce((total, content) => {
			if (content.type === "text") return total + content.text.length;
			if (content.type === "thinking") return total + content.thinking.length;
			return total;
		}, 0);
	}

	private updateWorkingStalledState(message: AssistantMessage | undefined = this.streamingMessage): void {
		this.loadingAnimation?.setStalledDetectionState(
			this.getStreamingProgressValue(message),
			this.activeToolExecutionIds.size > 0,
		);
	}

	private setToolInputWorkingMessage(toolName: string, args: any): void {
		if (this.workingMessage !== undefined || !this.loadingAnimation) return;
		this.currentWorkingLoaderMode = "tool-input";
		this.detachCurrentTipLine({ dismissForTurn: true });
		this.loadingAnimation.setMessage(
			`${formatToolInputLoadingMessage(toolName, args)} (${keyText("app.interrupt")} to interrupt)`,
			this.getWorkingIndicatorOptions("tool-input"),
		);
		this.updateWorkingStalledState();
	}

	private setToolUseWorkingMessage(toolName: string, args: any): void {
		if (this.workingMessage !== undefined || !this.loadingAnimation) return;
		this.currentWorkingLoaderMode = "tool-use";
		this.detachCurrentTipLine({ dismissForTurn: true });
		this.loadingAnimation.setMessage(
			`${formatToolLoadingMessage(toolName, args)} (${keyText("app.interrupt")} to interrupt)`,
			this.getWorkingIndicatorOptions("tool-use"),
		);
		this.updateWorkingStalledState();
	}

	private restoreDefaultWorkingMessage(): void {
		if (this.workingMessage !== undefined || !this.loadingAnimation) return;
		this.currentWorkingLoaderMode = "responding";
		this.loadingAnimation.setMessage(
			`${this.getDefaultWorkingMessageText()} (${keyText("app.interrupt")} to interrupt)`,
			this.getWorkingIndicatorOptions(),
		);
		this.updateWorkingStalledState();
	}

	private stopWorkingLoader(): void {
		if (this.loadingAnimation) {
			this.loadingAnimation.stop();
			this.loadingAnimation = undefined;
		}
		this.statusContainer.clear();
	}

	private setWorkingVisible(visible: boolean): void {
		this.workingVisible = visible;
		if (!visible) {
			this.stopWorkingLoader();
			this.ui.requestRender();
			return;
		}
		if (this.session.isStreaming && !this.loadingAnimation) {
			this.statusContainer.clear();
			this.loadingAnimation = this.createWorkingLoader();
			this.statusContainer.addChild(this.loadingAnimation);
			this.attachExistingTipLine();
		}
		this.ui.requestRender();
	}

	private setWorkingIndicator(options?: LoaderIndicatorOptions): void {
		this.workingIndicatorOptions = options;
		this.loadingAnimation?.setIndicator(this.getWorkingIndicatorOptions());
		this.ui.requestRender();
	}

	private setHiddenThinkingLabel(label?: string): void {
		this.hiddenThinkingLabel = label ?? this.defaultHiddenThinkingLabel;
		for (const child of this.chatContainer.children) {
			if (child instanceof AssistantMessageComponent) {
				child.setHiddenThinkingLabel(this.hiddenThinkingLabel);
			}
		}
		if (this.streamingComponent) {
			this.streamingComponent.setHiddenThinkingLabel(this.hiddenThinkingLabel);
		}
		this.ui.requestRender();
	}

	/**
	 * Set an extension widget (string array or custom component).
	 */
	private setExtensionWidget(
		key: string,
		content: string[] | ((tui: TUI, thm: Theme) => Component & { dispose?(): void }) | undefined,
		options?: ExtensionWidgetOptions,
	): void {
		const placement = options?.placement ?? "aboveEditor";
		const removeExisting = (map: Map<string, Component & { dispose?(): void }>) => {
			const existing = map.get(key);
			if (existing?.dispose) existing.dispose();
			map.delete(key);
		};

		removeExisting(this.extensionWidgetsAbove);
		removeExisting(this.extensionWidgetsBelow);

		if (content === undefined) {
			this.renderWidgets();
			return;
		}

		let component: Component & { dispose?(): void };

		if (Array.isArray(content)) {
			// Wrap string array in a Container with Text components
			const container = new Container();
			for (const line of content.slice(0, InteractiveMode.MAX_WIDGET_LINES)) {
				container.addChild(new Text(line, 1, 0));
			}
			if (content.length > InteractiveMode.MAX_WIDGET_LINES) {
				container.addChild(new Text(theme.fg("muted", "... (widget truncated)"), 1, 0));
			}
			component = container;
		} else {
			// Factory function - create component
			component = content(this.ui, theme);
		}

		const targetMap = placement === "belowEditor" ? this.extensionWidgetsBelow : this.extensionWidgetsAbove;
		targetMap.set(key, component);
		this.renderWidgets();
	}

	private clearExtensionWidgets(): void {
		for (const widget of this.extensionWidgetsAbove.values()) {
			widget.dispose?.();
		}
		for (const widget of this.extensionWidgetsBelow.values()) {
			widget.dispose?.();
		}
		this.extensionWidgetsAbove.clear();
		this.extensionWidgetsBelow.clear();
		this.renderWidgets();
	}

	private resetExtensionUI(): void {
		if (this.extensionSelector) {
			this.hideExtensionSelector();
		}
		if (this.extensionInput) {
			this.hideExtensionInput();
		}
		if (this.extensionEditor) {
			this.hideExtensionEditor();
		}
		this.ui.hideOverlay();
		this.clearExtensionTerminalInputListeners();
		this.setExtensionFooter(undefined);
		this.setExtensionHeader(undefined);
		this.clearExtensionWidgets();
		this.footerDataProvider.clearExtensionStatuses();
		this.footer.invalidate();
		this.autocompleteProviderWrappers = [];
		this.setCustomEditorComponent(undefined);
		this.setupAutocompleteProvider();
		this.defaultEditor.onExtensionShortcut = undefined;
		this.updateTerminalTitle();
		this.workingMessage = undefined;
		this.workingVisible = true;
		this.setWorkingIndicator();
		if (this.loadingAnimation) {
			this.loadingAnimation.setMessage(
				`${this.getDefaultWorkingMessageText()} (${keyText("app.interrupt")} to interrupt)`,
				this.getWorkingIndicatorOptions(),
			);
		}
		this.setHiddenThinkingLabel();
	}

	// Maximum total widget lines to prevent viewport overflow
	private static readonly MAX_WIDGET_LINES = 10;

	/**
	 * Render all extension widgets to the widget container.
	 */
	private renderWidgets(): void {
		if (!this.widgetContainerAbove || !this.widgetContainerBelow) return;
		this.renderWidgetContainer(this.widgetContainerAbove, this.extensionWidgetsAbove, true, true);
		this.renderWidgetContainer(this.widgetContainerBelow, this.extensionWidgetsBelow, false, false);
		this.ui.requestRender();
	}

	private renderWidgetContainer(
		container: Container,
		widgets: Map<string, Component & { dispose?(): void }>,
		spacerWhenEmpty: boolean,
		leadingSpacer: boolean,
	): void {
		container.clear();

		if (widgets.size === 0) {
			if (spacerWhenEmpty) {
				container.addChild(new Spacer(1));
			}
			return;
		}

		if (leadingSpacer) {
			container.addChild(new Spacer(1));
		}
		for (const component of widgets.values()) {
			container.addChild(component);
		}
	}

	/**
	 * Set a custom footer component, or restore the built-in footer.
	 */
	private setExtensionFooter(
		factory:
			| ((tui: TUI, thm: Theme, footerData: ReadonlyFooterDataProvider) => Component & { dispose?(): void })
			| undefined,
	): void {
		// Dispose existing custom footer
		if (this.customFooter?.dispose) {
			this.customFooter.dispose();
		}

		// Remove current footer from UI
		if (this.customFooter) {
			this.ui.removeChild(this.customFooter);
		} else {
			this.ui.removeChild(this.footer);
		}

		if (factory) {
			// Create and add custom footer, passing the data provider
			this.customFooter = factory(this.ui, theme, this.footerDataProvider);
			this.ui.addChild(this.customFooter);
		} else {
			// Restore built-in footer
			this.customFooter = undefined;
			this.ui.addChild(this.footer);
		}

		this.ui.requestRender();
	}

	/**
	 * Set a custom header component, or restore the built-in header.
	 */
	private setExtensionHeader(factory: ((tui: TUI, thm: Theme) => Component & { dispose?(): void }) | undefined): void {
		// Header may not be initialized yet if called during early initialization
		if (!this.builtInHeader) {
			return;
		}

		// Dispose existing custom header
		if (this.customHeader?.dispose) {
			this.customHeader.dispose();
		}

		// Find the index of the current header in the header container
		const currentHeader = this.customHeader || this.builtInHeader;
		const index = this.headerContainer.children.indexOf(currentHeader);

		if (factory) {
			// Create and add custom header
			this.customHeader = factory(this.ui, theme);
			if (isExpandable(this.customHeader)) {
				this.customHeader.setExpanded(this.toolOutputExpanded);
			}
			if (index !== -1) {
				this.headerContainer.children[index] = this.customHeader;
			} else {
				// If not found (e.g. builtInHeader was never added), add at the top
				this.headerContainer.children.unshift(this.customHeader);
			}
		} else {
			// Restore built-in header
			this.customHeader = undefined;
			if (isExpandable(this.builtInHeader)) {
				this.builtInHeader.setExpanded(this.toolOutputExpanded);
			}
			if (index !== -1) {
				this.headerContainer.children[index] = this.builtInHeader;
			}
		}

		this.ui.requestRender();
	}

	private addExtensionTerminalInputListener(
		handler: (data: string) => { consume?: boolean; data?: string } | undefined,
	): () => void {
		const unsubscribe = this.ui.addInputListener(handler);
		this.extensionTerminalInputUnsubscribers.add(unsubscribe);
		return () => {
			unsubscribe();
			this.extensionTerminalInputUnsubscribers.delete(unsubscribe);
		};
	}

	private clearExtensionTerminalInputListeners(): void {
		for (const unsubscribe of this.extensionTerminalInputUnsubscribers) {
			unsubscribe();
		}
		this.extensionTerminalInputUnsubscribers.clear();
	}

	/**
	 * Create the ExtensionUIContext for extensions.
	 */
	private createExtensionUIContext(): ExtensionUIContext {
		return {
			select: (title, options, opts) => this.showExtensionSelector(title, options, opts),
			confirm: (title, message, opts) => this.showExtensionConfirm(title, message, opts),
			input: (title, placeholder, opts) => this.showExtensionInput(title, placeholder, opts),
			notify: (message, type) => this.showExtensionNotify(message, type),
			onTerminalInput: (handler) => this.addExtensionTerminalInputListener(handler),
			setStatus: (key, text) => this.setExtensionStatus(key, text),
			setWorkingMessage: (message) => {
				this.workingMessage = message;
				if (message !== undefined) {
					this.detachCurrentTipLine({ dismissForTurn: true });
				}
				if (this.loadingAnimation) {
					this.loadingAnimation.setMessage(
						message ?? this.getDefaultWorkingMessageText(),
						this.getWorkingIndicatorOptions(),
					);
				}
			},
			setWorkingVisible: (visible) => this.setWorkingVisible(visible),
			setWorkingIndicator: (options) => this.setWorkingIndicator(options),
			setHiddenThinkingLabel: (label) => this.setHiddenThinkingLabel(label),
			setWidget: (key, content, options) => this.setExtensionWidget(key, content, options),
			setFooter: (factory) => this.setExtensionFooter(factory),
			setHeader: (factory) => this.setExtensionHeader(factory),
			setTitle: (title) => this.ui.terminal.setTitle(title),
			custom: (factory, options) => this.showExtensionCustom(factory, options),
			pasteToEditor: (text) => this.editor.handleInput(`\x1b[200~${text}\x1b[201~`),
			setEditorText: (text) => this.editor.setText(text),
			getEditorText: () => this.editor.getExpandedText?.() ?? this.editor.getText(),
			editor: (title, prefill) => this.showExtensionEditor(title, prefill),
			addAutocompleteProvider: (factory) => {
				this.autocompleteProviderWrappers.push(factory);
				this.setupAutocompleteProvider();
			},
			setEditorComponent: (factory) => this.setCustomEditorComponent(factory),
			getEditorComponent: () => this.editorComponentFactory,
			get theme() {
				return theme;
			},
			getAllThemes: () => getAvailableThemesWithPaths(),
			getTheme: (name) => getThemeByName(name),
			setTheme: (themeOrName) => {
				if (themeOrName instanceof Theme) {
					setThemeInstance(themeOrName);
					this.ui.requestRender();
					return { success: true };
				}
				const result = setTheme(themeOrName, true);
				if (result.success) {
					if (this.settingsManager.getTheme() !== themeOrName) {
						this.settingsManager.setTheme(themeOrName);
					}
					this.ui.requestRender();
				}
				return result;
			},
			getToolsExpanded: () => this.toolOutputExpanded,
			setToolsExpanded: (expanded) => this.setToolsExpanded(expanded),
		};
	}

	/**
	 * Show a selector for extensions.
	 */
	private showExtensionSelector(
		title: string,
		options: string[],
		opts?: ExtensionUIDialogOptions,
	): Promise<string | undefined> {
		return new Promise((resolve) => {
			if (opts?.signal?.aborted) {
				resolve(undefined);
				return;
			}

			const onAbort = () => {
				this.hideExtensionSelector();
				resolve(undefined);
			};
			opts?.signal?.addEventListener("abort", onAbort, { once: true });

			this.extensionSelector = new ExtensionSelectorComponent(
				title,
				options,
				(option) => {
					opts?.signal?.removeEventListener("abort", onAbort);
					this.hideExtensionSelector();
					resolve(option);
				},
				() => {
					opts?.signal?.removeEventListener("abort", onAbort);
					this.hideExtensionSelector();
					resolve(undefined);
				},
				{
					tui: this.ui,
					timeout: opts?.timeout,
					onToggleToolsExpanded: () => this.toggleToolOutputExpansion(),
				},
			);

			this.editorContainer.clear();
			this.editorContainer.addChild(this.extensionSelector);
			this.ui.setFocus(this.extensionSelector);
			this.ui.requestRender();
		});
	}

	/**
	 * Hide the extension selector.
	 */
	private hideExtensionSelector(): void {
		this.extensionSelector?.dispose();
		this.editorContainer.clear();
		this.editorContainer.addChild(this.editor);
		this.extensionSelector = undefined;
		this.ui.setFocus(this.editor);
		this.ui.requestRender();
	}

	/**
	 * Show a confirmation dialog for extensions.
	 */
	private async showExtensionConfirm(
		title: string,
		message: string,
		opts?: ExtensionUIDialogOptions,
	): Promise<boolean> {
		const result = await this.showExtensionSelector(`${title}\n${message}`, ["Yes", "No"], opts);
		return result === "Yes";
	}

	private async promptForMissingSessionCwd(error: MissingSessionCwdError): Promise<string | undefined> {
		const confirmed = await this.showExtensionConfirm(
			"Session cwd not found",
			formatMissingSessionCwdPrompt(error.issue),
		);
		return confirmed ? error.issue.fallbackCwd : undefined;
	}

	/**
	 * Show a text input for extensions.
	 */
	private showExtensionInput(
		title: string,
		placeholder?: string,
		opts?: ExtensionUIDialogOptions,
	): Promise<string | undefined> {
		return new Promise((resolve) => {
			if (opts?.signal?.aborted) {
				resolve(undefined);
				return;
			}

			const onAbort = () => {
				this.hideExtensionInput();
				resolve(undefined);
			};
			opts?.signal?.addEventListener("abort", onAbort, { once: true });

			this.extensionInput = new ExtensionInputComponent(
				title,
				placeholder,
				(value) => {
					opts?.signal?.removeEventListener("abort", onAbort);
					this.hideExtensionInput();
					resolve(value);
				},
				() => {
					opts?.signal?.removeEventListener("abort", onAbort);
					this.hideExtensionInput();
					resolve(undefined);
				},
				{ tui: this.ui, timeout: opts?.timeout },
			);

			this.editorContainer.clear();
			this.editorContainer.addChild(this.extensionInput);
			this.ui.setFocus(this.extensionInput);
			this.ui.requestRender();
		});
	}

	/**
	 * Hide the extension input.
	 */
	private hideExtensionInput(): void {
		this.extensionInput?.dispose();
		this.editorContainer.clear();
		this.editorContainer.addChild(this.editor);
		this.extensionInput = undefined;
		this.ui.setFocus(this.editor);
		this.ui.requestRender();
	}

	/**
	 * Show a multi-line editor for extensions (with Ctrl+G support).
	 */
	private showExtensionEditor(title: string, prefill?: string): Promise<string | undefined> {
		return new Promise((resolve) => {
			this.extensionEditor = new ExtensionEditorComponent(
				this.ui,
				this.keybindings,
				title,
				prefill,
				(value) => {
					this.hideExtensionEditor();
					resolve(value);
				},
				() => {
					this.hideExtensionEditor();
					resolve(undefined);
				},
			);

			this.editorContainer.clear();
			this.editorContainer.addChild(this.extensionEditor);
			this.ui.setFocus(this.extensionEditor);
			this.ui.requestRender();
		});
	}

	/**
	 * Hide the extension editor.
	 */
	private hideExtensionEditor(): void {
		this.editorContainer.clear();
		this.editorContainer.addChild(this.editor);
		this.extensionEditor = undefined;
		this.ui.setFocus(this.editor);
		this.ui.requestRender();
	}

	/**
	 * Set a custom editor component from an extension.
	 * Pass undefined to restore the default editor.
	 */
	private setCustomEditorComponent(factory: EditorFactory | undefined): void {
		this.editorComponentFactory = factory;

		// Save text from current editor before switching
		const currentText = this.editor.getText();

		this.editorContainer.clear();

		if (factory) {
			// Create the custom editor with tui, theme, and keybindings
			const newEditor = factory(this.ui, getEditorTheme(), this.keybindings);

			// Wire up callbacks from the default editor
			newEditor.onSubmit = this.defaultEditor.onSubmit;
			newEditor.onChange = this.defaultEditor.onChange;

			// Copy text from previous editor
			newEditor.setText(currentText);

			// Copy appearance settings if supported
			if (newEditor.borderColor !== undefined) {
				newEditor.borderColor = this.defaultEditor.borderColor;
			}
			if (newEditor.setPaddingX !== undefined) {
				newEditor.setPaddingX(this.defaultEditor.getPaddingX());
			}

			// Set autocomplete if supported
			if (newEditor.setAutocompleteProvider && this.autocompleteProvider) {
				newEditor.setAutocompleteProvider(this.autocompleteProvider);
			}

			// If extending CustomEditor, copy app-level handlers
			// Use duck typing since instanceof fails across jiti module boundaries
			const customEditor = newEditor as unknown as Record<string, unknown>;
			if ("actionHandlers" in customEditor && customEditor.actionHandlers instanceof Map) {
				if (!customEditor.onEscape) {
					customEditor.onEscape = () => this.defaultEditor.onEscape?.();
				}
				if (!customEditor.onCtrlD) {
					customEditor.onCtrlD = () => this.defaultEditor.onCtrlD?.();
				}
				if (!customEditor.onPasteImage) {
					customEditor.onPasteImage = () => this.defaultEditor.onPasteImage?.();
				}
				if (!customEditor.onExtensionShortcut) {
					customEditor.onExtensionShortcut = (data: string) => this.defaultEditor.onExtensionShortcut?.(data);
				}
				// Copy action handlers (clear, suspend, model switching, etc.)
				for (const [action, handler] of this.defaultEditor.actionHandlers) {
					(customEditor.actionHandlers as Map<string, () => void>).set(action, handler);
				}
			}

			this.editor = newEditor;
		} else {
			// Restore default editor with text from custom editor
			this.defaultEditor.setText(currentText);
			this.editor = this.defaultEditor;
		}

		this.editorContainer.addChild(this.editor as Component);
		this.ui.setFocus(this.editor as Component);
		this.ui.requestRender();
	}

	/**
	 * Show a notification for extensions.
	 */
	private showExtensionNotify(message: string, type?: "info" | "warning" | "error"): void {
		if (type === "error") {
			this.showError(message);
		} else if (type === "warning") {
			this.showWarning(message);
		} else {
			this.showStatus(message);
		}
	}

	/** Show a custom component with keyboard focus. Overlay mode renders on top of existing content. */
	private async showExtensionCustom<T>(
		factory: (
			tui: TUI,
			theme: Theme,
			keybindings: KeybindingsManager,
			done: (result: T) => void,
		) => (Component & { dispose?(): void }) | Promise<Component & { dispose?(): void }>,
		options?: {
			overlay?: boolean;
			overlayOptions?: OverlayOptions | (() => OverlayOptions);
			onHandle?: (handle: OverlayHandle) => void;
		},
	): Promise<T> {
		const savedText = this.editor.getText();
		const isOverlay = options?.overlay ?? false;

		const restoreEditor = () => {
			this.editorContainer.clear();
			this.editorContainer.addChild(this.editor);
			this.editor.setText(savedText);
			this.ui.setFocus(this.editor);
			this.ui.requestRender();
		};

		return new Promise((resolve, reject) => {
			let component: Component & { dispose?(): void };
			let closed = false;

			const close = (result: T) => {
				if (closed) return;
				closed = true;
				if (isOverlay) this.ui.hideOverlay();
				else restoreEditor();
				// Note: both branches above already call requestRender
				resolve(result);
				try {
					component?.dispose?.();
				} catch {
					/* ignore dispose errors */
				}
			};

			Promise.resolve(factory(this.ui, theme, this.keybindings, close))
				.then((c) => {
					if (closed) return;
					component = c;
					if (isOverlay) {
						// Resolve overlay options - can be static or dynamic function
						const resolveOptions = (): OverlayOptions | undefined => {
							if (options?.overlayOptions) {
								const opts =
									typeof options.overlayOptions === "function"
										? options.overlayOptions()
										: options.overlayOptions;
								return opts;
							}
							// Fallback: use component's width property if available
							const w = (component as { width?: number }).width;
							return w ? { width: w } : undefined;
						};
						const handle = this.ui.showOverlay(component, resolveOptions());
						// Expose handle to caller for visibility control
						options?.onHandle?.(handle);
					} else {
						this.editorContainer.clear();
						this.editorContainer.addChild(component);
						this.ui.setFocus(component);
						this.ui.requestRender();
					}
				})
				.catch((err) => {
					if (closed) return;
					if (!isOverlay) restoreEditor();
					reject(err);
				});
		});
	}

	/**
	 * Show an extension error in the UI.
	 */
	private showExtensionError(extensionPath: string, error: string, stack?: string): void {
		const errorMsg = `Extension "${extensionPath}" error: ${error}`;
		const errorText = new Text(theme.fg("error", errorMsg), 1, 0);
		this.chatContainer.addChild(errorText);
		if (stack) {
			// Show stack trace in dim color, indented
			const stackLines = stack
				.split("\n")
				.slice(1) // Skip first line (duplicates error message)
				.map((line) => theme.fg("dim", `  ${line.trim()}`))
				.join("\n");
			if (stackLines) {
				this.chatContainer.addChild(new Text(stackLines, 1, 0));
			}
		}
		this.ui.requestRender();
	}

	// =========================================================================
	// Key Handlers
	// =========================================================================

	private setupKeyHandlers(): void {
		// Set up handlers on defaultEditor - they use this.editor for text access
		// so they work correctly regardless of which editor is active
		this.defaultEditor.onEscape = () => {
			if (this.shortcutOverlayVisible) {
				this.shortcutOverlayVisible = false;
				this.footer.shortcutOverlayVisible = false;
				this.ui.requestRender();
			} else if (this.pendingToolApproval) {
				this.resolveToolApproval({
					behavior: "deny",
					reason: "User cancelled permission prompt",
				});
			} else if (this.session.isStreaming || this.session.retryAttempt > 0) {
				this.restoreQueuedMessagesToEditor({ abort: true });
			} else if (this.session.isBashRunning) {
				this.session.abortBash();
			} else if (this.isBashMode) {
				this.editor.setText("");
				this.isBashMode = false;
				this.updateEditorBorderColor();
			} else if (!this.editor.getText().trim()) {
				// Double-escape with empty editor triggers /tree, /fork, or nothing based on setting
				const action = this.settingsManager.getDoubleEscapeAction();
				if (action !== "none") {
					const now = Date.now();
					if (now - this.lastEscapeTime < 500) {
						if (action === "tree") {
							this.showTreeSelector();
						} else {
							this.showUserMessageSelector();
						}
						this.lastEscapeTime = 0;
					} else {
						this.lastEscapeTime = now;
					}
				}
			}
		};

		// Register app action handlers
		this.defaultEditor.onAction("app.clear", () => this.handleCtrlC());
		this.defaultEditor.onCtrlD = () => this.handleCtrlD();
		this.defaultEditor.onAction("app.suspend", () => this.handleCtrlZ());
		this.defaultEditor.onAction("app.mode.cycle", () => this.cycleAgentMode());
		this.defaultEditor.onAction("app.thinking.cycle", () => this.cycleThinkingLevel());
		this.defaultEditor.onAction("app.model.cycleForward", () => this.cycleModel("forward"));
		this.defaultEditor.onAction("app.model.cycleBackward", () => this.cycleModel("backward"));

		// Global debug handler on TUI (works regardless of focus)
		this.ui.onDebug = () => this.handleDebugCommand();
		this.ui.onFocusLost = () => this.handleTerminalBlur();
		this.ui.onFocusGained = () => this.handleTerminalFocus();
		this.defaultEditor.onAction("app.model.select", () => this.showModelSelector());
		this.defaultEditor.onAction("app.transcript.view", () => this.toggleToolOutputExpansion());
		this.defaultEditor.onAction("app.tools.expand", () => this.toggleToolOutputExpansion());
		this.defaultEditor.onAction("app.task.background", () => this.handleBackgroundCurrentTask());
		this.defaultEditor.onAction("app.tasks.open", () => this.handleTasksCommand("/tasks"));
		this.defaultEditor.onAction("app.thinking.toggle", () => this.toggleThinkingBlockVisibility());
		this.defaultEditor.onAction("app.editor.external", () => this.openExternalEditor());
		this.defaultEditor.onAction("app.message.followUp", () => this.handleFollowUp());
		this.defaultEditor.onAction("app.message.dequeue", () => this.handleDequeue());
		this.defaultEditor.onAction("app.session.new", () => this.handleClearCommand());
		this.defaultEditor.onAction("app.session.tree", () => this.showTreeSelector());
		this.defaultEditor.onAction("app.session.fork", () => this.showUserMessageSelector());
		this.defaultEditor.onAction("app.session.resume", () => this.showSessionSelector());

		this.defaultEditor.onChange = (text: string) => {
			const wasBashMode = this.isBashMode;
			this.isBashMode = text.trimStart().startsWith("!");
			if (wasBashMode !== this.isBashMode) {
				this.updateEditorBorderColor();
			}
			// Dismiss shortcut overlay when user starts typing
			if (this.shortcutOverlayVisible && text.length > 0) {
				this.shortcutOverlayVisible = false;
				this.ui.requestRender();
			}
		};

		this.defaultEditor.onQuestionMark = () => {
			this.shortcutOverlayVisible = !this.shortcutOverlayVisible;
			this.footer.shortcutOverlayVisible = this.shortcutOverlayVisible;
			this.ui.requestRender();
			return true;
		};

		// Handle clipboard image paste (triggered on Ctrl+V)
		this.defaultEditor.onPasteImage = () => {
			this.handleClipboardImagePaste();
		};
	}

	private async handleClipboardImagePaste(): Promise<void> {
		try {
			const image = await readClipboardImage();
			if (!image) {
				return;
			}

			// Write to temp file
			const tmpDir = os.tmpdir();
			const ext = extensionForImageMimeType(image.mimeType) ?? "png";
			const fileName = `neo-clipboard-${crypto.randomUUID()}.${ext}`;
			const filePath = path.join(tmpDir, fileName);
			fs.writeFileSync(filePath, Buffer.from(image.bytes));

			// Insert file path directly
			this.editor.insertTextAtCursor?.(filePath);
			this.ui.requestRender();
		} catch {
			// Silently ignore clipboard errors (may not have permission, etc.)
		}
	}

	private setupEditorSubmitHandler(): void {
		this.defaultEditor.onSubmit = async (text: string) => {
			text = text.trim();
			if (!text) return;

			if (this.pendingToolApproval) {
				this.handleToolApprovalInput(text);
				this.editor.addToHistory?.(text);
				this.editor.setText("");
				return;
			}

			// Handle commands
			if (text === "/settings") {
				this.showSettingsSelector();
				this.editor.setText("");
				return;
			}
			if (text === "/status") {
				this.handleStatusCommand();
				this.editor.setText("");
				return;
			}
			if (text === "/usage") {
				this.editor.setText("");
				await this.handleUsageCommand();
				return;
			}
			if (text === "/context") {
				this.handleContextCommand();
				this.editor.setText("");
				return;
			}
			if (text === "/doctor") {
				this.handleDoctorCommand();
				this.editor.setText("");
				return;
			}
			if (text === "/config" || text.startsWith("/config ")) {
				this.handleConfigSlashCommand(text);
				this.editor.setText("");
				return;
			}
			if (text === "/memory" || text.startsWith("/memory ")) {
				await this.handleMemoryCommand(text);
				this.editor.setText("");
				return;
			}
			if (text === "/mcp" || text.startsWith("/mcp ")) {
				this.handleMcpCommand();
				this.editor.setText("");
				return;
			}
			if (text === "/todo" || text.startsWith("/todo ")) {
				this.handleTodoCommand();
				this.editor.setText("");
				return;
			}
			if (text === "/termux-keys" || text.startsWith("/termux-keys ")) {
				this.handleTermuxKeysCommand(text);
				this.editor.setText("");
				return;
			}
			if (text === "/lsp" || text.startsWith("/lsp ")) {
				await this.handleLspCommand(text);
				this.editor.setText("");
				return;
			}
			if (text === "/termux-status") {
				this.handleTermuxStatusCommand();
				this.editor.setText("");
				return;
			}
			if (text === "/mode" || text.startsWith("/mode ")) {
				this.editor.setText("");
				await this.handleModeCommand(text);
				return;
			}
			if (text === "/ask" || text.startsWith("/ask ")) {
				this.editor.setText("");
				await this.handleModeShortcutCommand("ask", text.slice("/ask".length).trim(), text);
				return;
			}
			if (text === "/plan" || text.startsWith("/plan ")) {
				this.editor.setText("");
				await this.handleModeShortcutCommand("plan", text.slice("/plan".length).trim(), text);
				return;
			}
			if (
				text === "/read-only" ||
				text.startsWith("/read-only ") ||
				text === "/readonly" ||
				text.startsWith("/readonly ")
			) {
				this.editor.setText("");
				const prompt = text.startsWith("/readonly")
					? text.slice("/readonly".length).trim()
					: text.slice("/read-only".length).trim();
				await this.handleModeShortcutCommand("read-only", prompt, text);
				return;
			}
			if (text === "/default" || text.startsWith("/default ") || text === "/agent" || text.startsWith("/agent ")) {
				this.editor.setText("");
				const prompt = text.startsWith("/agent")
					? text.slice("/agent".length).trim()
					: text.slice("/default".length).trim();
				await this.handleModeShortcutCommand("default", prompt, text);
				return;
			}
			if (
				text === "/accept-edits" ||
				text.startsWith("/accept-edits ") ||
				text === "/acceptedits" ||
				text.startsWith("/acceptedits ")
			) {
				this.editor.setText("");
				const prompt = text.startsWith("/acceptedits")
					? text.slice("/acceptedits".length).trim()
					: text.slice("/accept-edits".length).trim();
				await this.handleModeShortcutCommand("accept-edits", prompt, text);
				return;
			}
			if (text === "/permissions" || text.startsWith("/permissions ")) {
				this.handlePermissionsCommand(text);
				this.editor.setText("");
				return;
			}
			if (text === "/tasks" || text.startsWith("/tasks ")) {
				this.handleTasksCommand(text);
				this.editor.setText("");
				return;
			}
			if (text === "/diff" || text.startsWith("/diff ")) {
				this.handleDiffCommand(text);
				this.editor.setText("");
				return;
			}
			if (text === "/review" || text.startsWith("/review ")) {
				this.editor.setText("");
				await this.handleReviewCommand(text);
				return;
			}
			if (text === "/init") {
				this.editor.addToHistory?.(text);
				this.editor.setText("");
				await this.handleInitCommand();
				return;
			}
			if (text === "/agents" || text.startsWith("/agents ")) {
				await this.handleAgentsCommand(text);
				this.editor.setText("");
				return;
			}
			if (text === "/skills" || text.startsWith("/skills ")) {
				await this.handleSkillsCommand(text);
				this.editor.setText("");
				return;
			}
			if (text === "/hooks") {
				this.handleHooksCommand();
				this.editor.setText("");
				return;
			}
			if (text === "/statusline" || text.startsWith("/statusline ")) {
				this.editor.setText("");
				this.handleStatuslineCommand(text);
				return;
			}
			if (text === "/scoped-models") {
				this.editor.setText("");
				await this.showModelsSelector();
				return;
			}
			if (text === "/model" || text.startsWith("/model ")) {
				const searchTerm = text.startsWith("/model ") ? text.slice(7).trim() : undefined;
				this.editor.setText("");
				await this.handleModelCommand(searchTerm);
				return;
			}
			if (text === "/export" || text.startsWith("/export ")) {
				await this.handleExportCommand(text);
				this.editor.setText("");
				return;
			}
			if (text === "/import" || text.startsWith("/import ")) {
				await this.handleImportCommand(text);
				this.editor.setText("");
				return;
			}
			if (text === "/share") {
				await this.handleShareCommand();
				this.editor.setText("");
				return;
			}
			if (text.startsWith("/share ")) {
				await this.handleShareCommand(text.slice("/share ".length).trim());
				this.editor.setText("");
				return;
			}
			if (text === "/copy") {
				await this.handleCopyCommand();
				this.editor.setText("");
				return;
			}
			if (text === "/name" || text.startsWith("/name ") || text === "/rename" || text.startsWith("/rename ")) {
				// `/rename` is an alias for `/name` so users coming from Codex
				// or Claude Code reach the same command.
				const normalized = text.startsWith("/rename") ? `/name${text.slice("/rename".length)}` : text;
				this.handleNameCommand(normalized);
				this.editor.setText("");
				return;
			}
			if (text === "/session") {
				this.handleSessionCommand();
				this.editor.setText("");
				return;
			}
			if (text === "/changelog") {
				this.handleChangelogCommand();
				this.editor.setText("");
				return;
			}
			if (text === "/hotkeys") {
				this.handleHotkeysCommand();
				this.editor.setText("");
				return;
			}
			if (text === "/fork") {
				this.showUserMessageSelector();
				this.editor.setText("");
				return;
			}
			if (text === "/clone") {
				this.editor.setText("");
				await this.handleCloneCommand();
				return;
			}
			if (text === "/tree") {
				this.showTreeSelector();
				this.editor.setText("");
				return;
			}
			if (text === "/login") {
				this.showOAuthSelector("login");
				this.editor.setText("");
				return;
			}
			if (text === "/logout") {
				this.showOAuthSelector("logout");
				this.editor.setText("");
				return;
			}
			if (text === "/new") {
				this.editor.setText("");
				await this.handleClearCommand();
				return;
			}
			if (text === "/fork") {
				this.editor.setText("");
				await this.handleForkCommand();
				return;
			}
			if (text === "/compact" || text.startsWith("/compact ")) {
				const customInstructions = text.startsWith("/compact ") ? text.slice(9).trim() : undefined;
				this.editor.setText("");
				await this.handleCompactCommand(customInstructions);
				return;
			}
			if (text === "/reload") {
				this.editor.setText("");
				await this.handleReloadCommand();
				return;
			}
			if (text === "/debug") {
				this.handleDebugCommand();
				this.editor.setText("");
				return;
			}
			if (text === "/arminsayshi") {
				this.handleArminSaysHi();
				this.editor.setText("");
				return;
			}
			if (text === "/dementedelves") {
				this.handleDementedDelves();
				this.editor.setText("");
				return;
			}
			if (text === "/resume") {
				this.showSessionSelector();
				this.editor.setText("");
				return;
			}
			if (text === "/quit") {
				this.editor.setText("");
				await this.shutdown();
				return;
			}

			// Handle bash command (! for normal, !! for excluded from context)
			if (text.startsWith("!")) {
				const isExcluded = text.startsWith("!!");
				const command = isExcluded ? text.slice(2).trim() : text.slice(1).trim();
				if (command) {
					if (this.session.isBashRunning) {
						this.showWarning("A bash command is already running. Press Esc to cancel it first.");
						this.editor.setText(text);
						return;
					}
					this.editor.addToHistory?.(text);
					await this.handleBashCommand(command, isExcluded);
					this.isBashMode = false;
					this.updateEditorBorderColor();
					return;
				}
			}

			// Queue input during compaction (extension commands execute immediately)
			if (this.session.isCompacting) {
				if (this.isExtensionCommand(text)) {
					this.editor.addToHistory?.(text);
					this.editor.setText("");
					await this.session.prompt(text);
				} else {
					this.queueCompactionMessage(text, "steer");
				}
				return;
			}

			// If streaming, use prompt() with steer behavior
			// This handles extension commands (execute immediately), prompt template expansion, and queueing
			if (this.session.isStreaming) {
				this.editor.addToHistory?.(text);
				this.editor.setText("");
				await this.session.prompt(text, { streamingBehavior: "steer" });
				this.updatePendingMessagesDisplay();
				this.ui.requestRender();
				return;
			}

			// Normal message submission
			// First, move any pending bash components to chat
			this.flushPendingBashComponents();

			if (this.onInputCallback) {
				this.onInputCallback(text);
			}
			this.editor.addToHistory?.(text);
		};
	}

	private hidePromptEditorForApproval(component: ToolApprovalRequestComponent): void {
		this.approvalContainer.clear();
		this.approvalContainer.addChild(new Spacer(1));
		this.approvalContainer.addChild(component);
		this.editorContainer.clear();
		this.ui.setFocus(component);
	}

	private restorePromptEditorFocus(): void {
		this.approvalContainer.clear();
		if (!this.editorContainer.children.includes(this.editor as Component)) {
			this.editorContainer.clear();
			this.editorContainer.addChild(this.editor as Component);
		}
		this.ui.setFocus(this.editor as Component);
	}

	private appendResolvedToolApproval(request: ToolApprovalRequest, decision: ToolApprovalDecision): void {
		if (decision.behavior === "allow") return;

		const feedback = decision.feedback?.trim() || decision.reason?.trim();
		const suffix = feedback ? ` — ${truncateToWidth(feedback, 64)}` : "";
		const label = request.toolName === "ExitPlanMode" ? "Plan not approved" : "Permission denied";
		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(
			new Text(
				`${theme.fg("error", "✕")} ${theme.bold(label)} ${theme.fg("dim", `· ${request.summary}${suffix}`)}`,
				1,
				0,
			),
		);
	}

	private setToolActivityAnimationPaused(paused: boolean): void {
		const groups = new Set<ToolActivityGroupComponent>();
		if (this.currentToolActivityGroup) groups.add(this.currentToolActivityGroup);
		for (const group of this.pendingToolGroups.values()) {
			groups.add(group);
		}
		for (const child of this.chatContainer.children) {
			if (child instanceof ToolActivityGroupComponent) {
				groups.add(child);
			}
		}
		for (const group of groups) {
			group.setAnimationPaused(paused);
		}
	}

	private requestToolApproval(request: ToolApprovalRequest): Promise<ToolApprovalDecision> {
		if (this.pendingToolApproval) {
			this.resolveToolApproval({
				behavior: "deny",
				reason: "Another permission prompt replaced this request",
			});
		}

		return new Promise((resolve) => {
			const component = new ToolApprovalRequestComponent(request, (decision) => {
				this.resolveToolApproval(decision);
			});
			this.pendingToolApproval = { request, component, resolve };
			this.setToolActivityAnimationPaused(true);
			this.stopWorkingLoader();
			this.hidePromptEditorForApproval(component);
			this.footer.invalidate();
			this.ui.requestRender();
		});
	}

	private resolveToolApproval(decision: ToolApprovalDecision): void {
		const pending = this.pendingToolApproval;
		if (!pending) return;

		// Capture the plan BEFORE resolving so we can re-submit it in the fresh
		// thread regardless of whether the underlying tool surfaces it later.
		const forkPlan =
			decision.forkAfterApproval && pending.request.toolName === "ExitPlanMode"
				? getExitPlanModePlan(pending.request.args)
				: undefined;

		this.pendingToolApproval = undefined;
		this.approvalContainer.clear();
		this.appendResolvedToolApproval(pending.request, decision);
		this.restorePromptEditorFocus();
		this.setToolActivityAnimationPaused(false);
		// Forward the decision to the agent. We do not strip `forkAfterApproval`
		// here — downstream callers ignore unknown fields and the original
		// behavior (`allow` / `nextMode`) remains correct so the agent's
		// existing exit-plan-mode flow can record the approval and update its
		// internal mode before we fork.
		pending.resolve(decision);
		this.setWorkingVisible(true);
		if (decision.behavior === "allow") {
			this.setToolUseWorkingMessage(pending.request.toolName, pending.request.args);
		} else {
			this.restoreDefaultWorkingMessage();
		}
		this.footer.invalidate();
		this.ui.requestRender();

		if (forkPlan && forkPlan.trim().length > 0) {
			void this.forkSessionWithPlan(forkPlan);
		}
	}

	private handleToolApprovalInput(text: string): void {
		const normalized = text.trim().toLowerCase();
		if (["1", "y", "yes", "allow", "ok", "approve"].includes(normalized)) {
			this.resolveToolApproval({ behavior: "allow", scope: "once" });
			return;
		}
		if (["2", "a", "always", "allow session", "allow-session", "session"].includes(normalized)) {
			this.resolveToolApproval({ behavior: "allow", scope: "session" });
			return;
		}
		if (["3", "n", "no", "deny", "reject"].includes(normalized)) {
			this.resolveToolApproval({ behavior: "deny" });
			return;
		}
		if (normalized === "4") {
			this.showStatus("Type: deny: <tell Neo what to do differently>");
			return;
		}
		const denyMatch = text.match(/^(?:deny|reject|no)\s*:?\s*(.+)$/i);
		if (denyMatch?.[1]?.trim()) {
			this.resolveToolApproval({
				behavior: "deny",
				feedback: denyMatch[1].trim(),
			});
			return;
		}
		const allowMatch = text.match(/^(?:allow|yes|approve)\s*:?\s*(.+)$/i);
		if (allowMatch?.[1]?.trim()) {
			this.resolveToolApproval({
				behavior: "allow",
				scope: "once",
				feedback: allowMatch[1].trim(),
			});
			return;
		}
		this.showWarning("Permission prompt expects 1/2/3/4, y/yes, a/always, n/no, or deny: <reason>.");
	}

	private subscribeToAgent(): void {
		this.unsubscribe = this.session.subscribe(async (event) => {
			await this.handleEvent(event);
		});
	}

	private createToolExecutionComponent(toolName: string, toolCallId: string, args: any): ToolExecutionComponent {
		const component = new ToolExecutionComponent(
			toolName,
			toolCallId,
			args,
			{
				showImages: this.settingsManager.getShowImages(),
				imageWidthCells: this.settingsManager.getImageWidthCells(),
			},
			this.getRegisteredToolDefinition(toolName),
			this.ui,
			this.sessionManager.getCwd(),
		);
		component.setExpanded(this.toolOutputExpanded);
		return component;
	}

	private createToolActivityGroup(): ToolActivityGroupComponent {
		const group = new ToolActivityGroupComponent(this.toolOutputExpanded, {
			gradualReveal: true,
			ui: this.ui,
		});
		if (this.pendingToolApproval) {
			group.setAnimationPaused(true);
		}
		this.chatContainer.addChild(group);
		return group;
	}

	private getOrCreateCurrentToolGroup(toolName: string, args: any): ToolActivityGroupComponent {
		if (!this.currentToolActivityGroup || !this.currentToolActivityGroup.canAcceptTool(toolName, args)) {
			this.currentToolActivityGroup = this.createToolActivityGroup();
		}
		return this.currentToolActivityGroup;
	}

	private attachToolToGroup(
		toolName: string,
		toolCallId: string,
		args: any,
		component: ToolExecutionComponent,
		group?: ToolActivityGroupComponent,
	): ToolActivityGroupComponent {
		const targetGroup = group ?? this.getOrCreateCurrentToolGroup(toolName, args);
		targetGroup.addTool(toolName, toolCallId, args, component);
		this.pendingToolGroups.set(toolCallId, targetGroup);
		return targetGroup;
	}

	private async handleEvent(event: AgentSessionEvent): Promise<void> {
		if (!this.isInitialized) {
			await this.init();
		}

		this.footer.invalidate();

		switch (event.type) {
			case "agent_start":
				this.setToolActivityAnimationPaused(false);
				this.pendingToolApproval = undefined;
				this.pendingTools.clear();
				this.pendingToolGroups.clear();
				this.activeToolExecutionIds.clear();
				this.currentToolActivityGroup = undefined;
				this.currentTurnStartedAt = Date.now();
				if (this.settingsManager.getShowTerminalProgress()) {
					this.ui.terminal.setProgress(true);
				}
				// Restore main escape handler if retry handler is still active
				// (retry success event fires later, but we need main handler now)
				if (this.retryEscapeHandler) {
					this.defaultEditor.onEscape = this.retryEscapeHandler;
					this.retryEscapeHandler = undefined;
				}
				if (this.retryCountdown) {
					this.retryCountdown.dispose();
					this.retryCountdown = undefined;
				}
				if (this.retryLoader) {
					this.retryLoader.stop();
					this.retryLoader = undefined;
				}
				this.stopWorkingLoader();
				if (this.workingVisible) {
					this.defaultWorkingMessageIndex = pickDefaultWorkingMessageIndex(this.defaultWorkingMessages.length);
					this.loadingAnimation = this.createWorkingLoader();
					this.statusContainer.addChild(this.loadingAnimation);
					this.pickAndAttachTipLine();
					this.updateWorkingStalledState();
				}
				this.ui.requestRender();
				break;

			case "queue_update":
				this.updatePendingMessagesDisplay();
				this.ui.requestRender();
				break;

			case "session_info_changed":
				this.updateTerminalTitle();
				this.footer.invalidate();
				this.ui.requestRender();
				break;

			case "background_task_update":
				this.footer.invalidate();
				if (event.event === "backgrounded") {
					this.showStatus(`Background task ${event.task.id} is running. Use /tasks to view.`);
				} else if (event.event === "completed" || event.event === "failed" || event.event === "killed") {
					const title = event.task.description?.trim() || event.task.command;
					this.showStatus(`Background task ${event.task.id} ${event.task.status}: ${title}`);
				}
				this.ui.requestRender();
				break;

			case "thinking_level_changed":
				this.footer.invalidate();
				this.updateEditorBorderColor();
				break;

			case "agent_mode_changed":
				this.footer.invalidate();
				this.ui.requestRender();
				break;

			case "message_start":
				if (event.message.role === "custom") {
					this.addMessageToChat(event.message);
					this.ui.requestRender();
				} else if (event.message.role === "user") {
					this.addMessageToChat(event.message);
					this.updatePendingMessagesDisplay();
					this.ui.requestRender();
				} else if (event.message.role === "assistant") {
					this.currentToolActivityGroup = undefined;
					this.streamingComponent = new AssistantMessageComponent(
						undefined,
						this.hideThinkingBlock,
						this.getMarkdownThemeWithSettings(),
						this.hiddenThinkingLabel,
					);
					const streamingMessage = event.message;
					this.streamingMessage = streamingMessage;
					this.chatContainer.addChild(this.streamingComponent);
					this.streamingComponent.updateContent(streamingMessage);
					this.ui.requestRender();
				}
				break;

			case "message_update":
				if (this.streamingComponent && event.message.role === "assistant") {
					const streamingMessage = event.message;
					this.streamingMessage = streamingMessage;
					this.streamingComponent.updateContent(streamingMessage);
					this.updateWorkingStalledState(streamingMessage);

					for (const content of streamingMessage.content) {
						if (content.type === "toolCall") {
							this.setToolInputWorkingMessage(content.name, content.arguments);
							const existing = this.pendingTools.get(content.id);
							if (!existing) {
								const component = this.createToolExecutionComponent(
									content.name,
									content.id,
									content.arguments,
								);
								this.pendingTools.set(content.id, component);
								this.attachToolToGroup(content.name, content.id, content.arguments, component);
							} else {
								const group = this.pendingToolGroups.get(content.id);
								if (group) group.updateToolArgs(content.id, content.arguments);
								else existing.updateArgs(content.arguments);
							}
						}
					}
					this.ui.requestRender();
				}
				break;

			case "message_end":
				if (event.message.role === "user") break;
				if (this.streamingComponent && event.message.role === "assistant") {
					const streamingMessage = event.message;
					this.streamingMessage = streamingMessage;
					let errorMessage: string | undefined;
					if (streamingMessage.stopReason === "aborted") {
						const retryAttempt = this.session.retryAttempt;
						errorMessage =
							retryAttempt > 0
								? `Aborted after ${retryAttempt} retry attempt${retryAttempt > 1 ? "s" : ""}`
								: "Operation aborted";
						streamingMessage.errorMessage = errorMessage;
					}
					this.streamingComponent.updateContent(streamingMessage);

					if (streamingMessage.stopReason === "aborted" || streamingMessage.stopReason === "error") {
						if (!errorMessage) {
							errorMessage = streamingMessage.errorMessage || "Error";
						}
						for (const [toolCallId, component] of this.pendingTools.entries()) {
							const result = {
								content: [{ type: "text", text: errorMessage }],
								isError: true,
							};
							const group = this.pendingToolGroups.get(toolCallId);
							if (group) group.updateToolResult(toolCallId, result);
							else component.updateResult(result);
						}
						this.pendingTools.clear();
						this.pendingToolGroups.clear();
					} else {
						// Args are now complete - trigger diff computation for edit tools
						for (const [, component] of this.pendingTools.entries()) {
							component.setArgsComplete();
						}
					}
					this.streamingComponent = undefined;
					this.streamingMessage = undefined;
					this.footer.invalidate();
				}
				this.ui.requestRender();
				break;

			case "tool_execution_start": {
				this.activeToolExecutionIds.add(event.toolCallId);
				this.setToolUseWorkingMessage(event.toolName, event.args);
				let component = this.pendingTools.get(event.toolCallId);
				if (!component) {
					component = this.createToolExecutionComponent(event.toolName, event.toolCallId, event.args);
					this.pendingTools.set(event.toolCallId, component);
					this.attachToolToGroup(event.toolName, event.toolCallId, event.args, component);
				}
				this.pendingToolGroups.get(event.toolCallId)?.markExecutionStarted(event.toolCallId);
				this.ui.requestRender();
				break;
			}

			case "tool_execution_update": {
				this.activeToolExecutionIds.add(event.toolCallId);
				this.updateWorkingStalledState();
				const component = this.pendingTools.get(event.toolCallId);
				if (component) {
					const result = { ...event.partialResult, isError: false };
					const group = this.pendingToolGroups.get(event.toolCallId);
					if (group) group.updateToolResult(event.toolCallId, result, true);
					else component.updateResult(result, true);
					this.ui.requestRender();
				}
				break;
			}

			case "tool_execution_end": {
				this.activeToolExecutionIds.delete(event.toolCallId);
				this.updateWorkingStalledState();
				const component = this.pendingTools.get(event.toolCallId);
				if (component) {
					const result = { ...event.result, isError: event.isError };
					const group = this.pendingToolGroups.get(event.toolCallId);
					if (group) group.updateToolResult(event.toolCallId, result);
					else component.updateResult(result);
					this.pendingTools.delete(event.toolCallId);
					this.pendingToolGroups.delete(event.toolCallId);
					if (this.pendingTools.size === 0) this.restoreDefaultWorkingMessage();
					this.updateWorkingStalledState();
					this.ui.requestRender();
				}
				break;
			}

			case "agent_end":
				if (this.pendingToolApproval) {
					this.resolveToolApproval({
						behavior: "deny",
						reason: "Agent stopped before permission was answered",
					});
				}
				this.setToolActivityAnimationPaused(false);
				this.activeToolExecutionIds.clear();
				if (this.terminalBlurredAt) {
					this.workCompletedWhileAway = true;
				}
				this.maybeSendTermuxCompletionNotification();
				this.currentTurnStartedAt = undefined;
				this.checkLowBalance();
				if (this.settingsManager.getShowTerminalProgress()) {
					this.ui.terminal.setProgress(false);
				}
				if (this.loadingAnimation) {
					this.loadingAnimation.stop();
					this.loadingAnimation = undefined;
					this.statusContainer.clear();
				}
				this.clearSpinnerTipState();
				if (this.streamingComponent) {
					this.chatContainer.removeChild(this.streamingComponent);
					this.streamingComponent = undefined;
					this.streamingMessage = undefined;
				}
				this.pendingTools.clear();
				this.pendingToolGroups.clear();
				this.currentToolActivityGroup = undefined;

				await this.checkShutdownRequested();

				this.ui.requestRender();
				break;

			case "compaction_start": {
				if (this.settingsManager.getShowTerminalProgress()) {
					this.ui.terminal.setProgress(true);
				}
				// Keep editor active; submissions are queued during compaction.
				this.autoCompactionEscapeHandler = this.defaultEditor.onEscape;
				this.defaultEditor.onEscape = () => {
					this.session.abortCompaction();
				};
				this.statusContainer.clear();
				const cancelHint = `(${keyText("app.interrupt")} to cancel)`;
				const label =
					event.reason === "manual"
						? `Compacting context... ${cancelHint}`
						: `${
								event.reason === "overflow"
									? "Context overflow detected, "
									: event.reason === "input_rate_limit"
										? "Input token limit hit, "
										: ""
							}Auto-compacting... ${cancelHint}`;
				this.autoCompactionLoader = new Loader(
					this.ui,
					(spinner) => theme.fg("accent", spinner),
					(text) => theme.fg("muted", text),
					label,
				);
				this.statusContainer.addChild(this.autoCompactionLoader);
				this.ui.requestRender();
				break;
			}

			case "compaction_end": {
				if (this.settingsManager.getShowTerminalProgress()) {
					this.ui.terminal.setProgress(false);
				}
				if (this.autoCompactionEscapeHandler) {
					this.defaultEditor.onEscape = this.autoCompactionEscapeHandler;
					this.autoCompactionEscapeHandler = undefined;
				}
				if (this.autoCompactionLoader) {
					this.autoCompactionLoader.stop();
					this.autoCompactionLoader = undefined;
					this.statusContainer.clear();
				}
				if (event.aborted) {
					if (event.reason === "manual") {
						this.showError("Compaction cancelled");
					} else {
						this.showStatus("Auto-compaction cancelled");
					}
				} else if (event.result) {
					this.rebuildChatFromMessages();
					this.footer.invalidate();
				} else if (event.errorMessage) {
					if (event.reason === "manual") {
						this.showError(event.errorMessage);
					} else {
						this.chatContainer.addChild(new Spacer(1));
						this.chatContainer.addChild(new Text(theme.fg("error", event.errorMessage), 1, 0));
					}
				}
				void this.flushCompactionQueue({ willRetry: event.willRetry });
				this.ui.requestRender();
				break;
			}

			case "auto_retry_start": {
				// Set up escape to abort retry
				this.retryEscapeHandler = this.defaultEditor.onEscape;
				this.defaultEditor.onEscape = () => {
					this.session.abortRetry();
				};
				// Show retry indicator
				this.statusContainer.clear();
				this.retryCountdown?.dispose();
				const retryMessage = (seconds: number) =>
					`Retrying (${event.attempt}/${event.maxAttempts}) in ${seconds}s... (${keyText("app.interrupt")} to cancel)`;
				this.retryLoader = new Loader(
					this.ui,
					(spinner) => theme.fg("warning", spinner),
					(text) => theme.fg("muted", text),
					retryMessage(Math.ceil(event.delayMs / 1000)),
				);
				this.retryCountdown = new CountdownTimer(
					event.delayMs,
					this.ui,
					(seconds) => {
						this.retryLoader?.setMessage(retryMessage(seconds));
					},
					() => {
						this.retryCountdown = undefined;
					},
				);
				this.statusContainer.addChild(this.retryLoader);
				this.ui.requestRender();
				break;
			}

			case "auto_retry_end": {
				// Restore escape handler
				if (this.retryEscapeHandler) {
					this.defaultEditor.onEscape = this.retryEscapeHandler;
					this.retryEscapeHandler = undefined;
				}
				if (this.retryCountdown) {
					this.retryCountdown.dispose();
					this.retryCountdown = undefined;
				}
				// Stop loader
				if (this.retryLoader) {
					this.retryLoader.stop();
					this.retryLoader = undefined;
					this.statusContainer.clear();
				}
				// Show error only on final failure (success shows normal response)
				if (!event.success) {
					this.showError(`Retry failed after ${event.attempt} attempts: ${event.finalError || "Unknown error"}`);
				}
				this.ui.requestRender();
				break;
			}

			case "rate_limit_action_required": {
				// Dismiss any previously active card before showing a new one
				if (this.rateLimitCard) {
					this.rateLimitCard = undefined;
				}

				const card = new RateLimitCardComponent(
					event,
					// onCompact
					() => {
						this.rateLimitCard = undefined;
						this.ui.setFocus(this.editor);
						void this.session.compact();
					},
					// onDismiss
					() => {
						this.rateLimitCard = undefined;
						this.ui.setFocus(this.editor);
						this.ui.requestRender();
					},
				);
				this.rateLimitCard = card;
				this.chatContainer.addChild(new Spacer(1));
				this.chatContainer.addChild(card);
				this.ui.setFocus(card);
				this.ui.requestRender();
				break;
			}
		}
	}

	/** Extract text content from a user message */
	private getUserMessageText(message: Message): string {
		if (message.role !== "user") return "";
		const textBlocks =
			typeof message.content === "string"
				? [{ type: "text", text: message.content }]
				: message.content.filter((c: { type: string }) => c.type === "text");
		return textBlocks.map((c) => (c as { text: string }).text).join("");
	}

	/**
	 * Show a status message in the chat.
	 *
	 * If multiple status messages are emitted back-to-back (without anything else being added to the chat),
	 * we update the previous status line instead of appending new ones to avoid log spam.
	 */
	private showStatus(message: string): void {
		const children = this.chatContainer.children;
		const last = children.length > 0 ? children[children.length - 1] : undefined;
		const secondLast = children.length > 1 ? children[children.length - 2] : undefined;

		if (last && secondLast && last === this.lastStatusText && secondLast === this.lastStatusSpacer) {
			this.lastStatusText.setText(theme.fg("dim", message));
			this.ui.requestRender();
			return;
		}

		const spacer = new Spacer(1);
		const text = new Text(theme.fg("dim", message), 1, 0);
		this.chatContainer.addChild(spacer);
		this.chatContainer.addChild(text);
		this.lastStatusSpacer = spacer;
		this.lastStatusText = text;
		this.ui.requestRender();
	}

	private addMessageToChat(message: AgentMessage, options?: { populateHistory?: boolean }): void {
		switch (message.role) {
			case "bashExecution": {
				const component = new BashExecutionComponent(message.command, this.ui, message.excludeFromContext);
				if (message.output) {
					component.appendOutput(message.output);
				}
				component.setComplete(
					message.exitCode,
					message.cancelled,
					message.truncated ? ({ truncated: true } as TruncationResult) : undefined,
					message.fullOutputPath,
				);
				this.chatContainer.addChild(component);
				break;
			}
			case "custom": {
				if (message.display) {
					const renderer = this.session.extensionRunner.getMessageRenderer(message.customType);
					const component = new CustomMessageComponent(message, renderer, this.getMarkdownThemeWithSettings());
					component.setExpanded(this.toolOutputExpanded);
					this.chatContainer.addChild(component);
				}
				break;
			}
			case "compactionSummary": {
				this.chatContainer.addChild(new Spacer(1));
				const component = new CompactionSummaryMessageComponent(message, this.getMarkdownThemeWithSettings());
				component.setExpanded(this.toolOutputExpanded);
				this.chatContainer.addChild(component);
				break;
			}
			case "branchSummary": {
				this.chatContainer.addChild(new Spacer(1));
				const component = new BranchSummaryMessageComponent(message, this.getMarkdownThemeWithSettings());
				component.setExpanded(this.toolOutputExpanded);
				this.chatContainer.addChild(component);
				break;
			}
			case "user": {
				const textContent = this.getUserMessageText(message);
				if (textContent) {
					if (this.chatContainer.children.length > 0) {
						this.chatContainer.addChild(new Spacer(1));
					}
					const skillBlock = parseSkillBlock(textContent);
					if (skillBlock) {
						// Render skill block (collapsible)
						const component = new SkillInvocationMessageComponent(
							skillBlock,
							this.getMarkdownThemeWithSettings(),
						);
						component.setExpanded(this.toolOutputExpanded);
						this.chatContainer.addChild(component);
						// Render user message separately if present
						if (skillBlock.userMessage) {
							const userComponent = new UserMessageComponent(
								skillBlock.userMessage,
								this.getMarkdownThemeWithSettings(),
							);
							this.chatContainer.addChild(userComponent);
						}
					} else {
						const userComponent = new UserMessageComponent(textContent, this.getMarkdownThemeWithSettings());
						this.chatContainer.addChild(userComponent);
					}
					if (options?.populateHistory) {
						this.editor.addToHistory?.(textContent);
					}
				}
				break;
			}
			case "assistant": {
				const assistantComponent = new AssistantMessageComponent(
					message,
					this.hideThinkingBlock,
					this.getMarkdownThemeWithSettings(),
					this.hiddenThinkingLabel,
				);
				this.chatContainer.addChild(assistantComponent);
				break;
			}
			case "toolResult": {
				// Tool results are rendered inline with tool calls, handled separately
				break;
			}
			default: {
				const _exhaustive: never = message;
			}
		}
	}

	/**
	 * Render session context to chat. Used for initial load and rebuild after compaction.
	 * @param sessionContext Session context to render
	 * @param options.updateFooter Update footer state
	 * @param options.populateHistory Add user messages to editor history
	 */
	private renderSessionContext(
		sessionContext: SessionContext,
		options: { updateFooter?: boolean; populateHistory?: boolean } = {},
	): void {
		this.pendingTools.clear();
		this.pendingToolGroups.clear();
		this.currentToolActivityGroup = undefined;
		const renderedPendingTools = new Map<string, ToolExecutionComponent>();
		const renderedPendingToolGroups = new Map<string, ToolActivityGroupComponent>();

		if (options.updateFooter) {
			this.footer.invalidate();
			this.updateEditorBorderColor();
		}

		for (const message of sessionContext.messages) {
			// Assistant messages need special handling for tool calls
			if (message.role === "assistant") {
				this.addMessageToChat(message);
				let group: ToolActivityGroupComponent | undefined;
				// Render tool call components in collapsed intent groups.
				for (const content of message.content) {
					if (content.type === "toolCall") {
						if (!group || !group.canAcceptTool(content.name, content.arguments)) {
							group = new ToolActivityGroupComponent(this.toolOutputExpanded);
							if (this.pendingToolApproval) {
								group.setAnimationPaused(true);
							}
							this.chatContainer.addChild(group);
						}
						const component = this.createToolExecutionComponent(content.name, content.id, content.arguments);
						group.addTool(content.name, content.id, content.arguments, component);

						if (message.stopReason === "aborted" || message.stopReason === "error") {
							let errorMessage: string;
							if (message.stopReason === "aborted") {
								const retryAttempt = this.session.retryAttempt;
								errorMessage =
									retryAttempt > 0
										? `Aborted after ${retryAttempt} retry attempt${retryAttempt > 1 ? "s" : ""}`
										: "Operation aborted";
							} else {
								errorMessage = message.errorMessage || "Error";
							}
							group.updateToolResult(content.id, {
								content: [{ type: "text", text: errorMessage }],
								isError: true,
							});
						} else {
							renderedPendingTools.set(content.id, component);
							renderedPendingToolGroups.set(content.id, group);
						}
					}
				}
			} else if (message.role === "toolResult") {
				// Match tool results to pending tool components
				const component = renderedPendingTools.get(message.toolCallId);
				if (component) {
					const group = renderedPendingToolGroups.get(message.toolCallId);
					if (group) group.updateToolResult(message.toolCallId, message);
					else component.updateResult(message);
					renderedPendingTools.delete(message.toolCallId);
					renderedPendingToolGroups.delete(message.toolCallId);
				}
			} else {
				// All other messages use standard rendering
				this.addMessageToChat(message, options);
			}
		}

		for (const [toolCallId, component] of renderedPendingTools) {
			this.pendingTools.set(toolCallId, component);
			const group = renderedPendingToolGroups.get(toolCallId);
			if (group) this.pendingToolGroups.set(toolCallId, group);
		}
		this.ui.requestRender();
	}

	renderInitialMessages(): void {
		// Get aligned messages and entries from session context
		const context = this.sessionManager.buildSessionContext();
		this.renderSessionContext(context, {
			updateFooter: true,
			populateHistory: true,
		});

		// Show compaction info if session was compacted
		const allEntries = this.sessionManager.getEntries();
		const compactionCount = allEntries.filter((e) => e.type === "compaction").length;
		if (compactionCount > 0) {
			const times = compactionCount === 1 ? "1 time" : `${compactionCount} times`;
			this.showStatus(`Session compacted ${times}`);
		}
	}

	async getUserInput(): Promise<string> {
		return new Promise((resolve) => {
			this.onInputCallback = (text: string) => {
				this.onInputCallback = undefined;
				resolve(text);
			};
		});
	}

	private rebuildChatFromMessages(): void {
		this.chatContainer.clear();
		const context = this.sessionManager.buildSessionContext();
		this.renderSessionContext(context);
	}

	// =========================================================================
	// Key handlers
	// =========================================================================

	private handleCtrlC(): void {
		const now = Date.now();
		if (now - this.lastSigintTime < 500) {
			void this.shutdown();
		} else {
			// First Ctrl+C: abort agent if running/retrying, otherwise clear editor
			if (this.pendingToolApproval) {
				this.resolveToolApproval({
					behavior: "deny",
					reason: "User interrupted with Ctrl+C",
				});
			}
			if (this.session.isStreaming || this.session.isBashRunning || this.session.retryAttempt > 0) {
				this.restoreQueuedMessagesToEditor({ abort: true });
			}
			this.clearEditor();
			this.showStatus("Press Ctrl+C again to exit.");
			this.lastSigintTime = now;
		}
	}

	private handleCtrlD(): void {
		// Only called when editor is empty (enforced by CustomEditor)
		void this.shutdown();
	}

	/**
	 * Gracefully shutdown the agent.
	 * Stops the TUI before emitting shutdown events so extension UI cleanup cannot
	 * repaint the final frame while the process is exiting.
	 */
	private isShuttingDown = false;

	private async shutdown(): Promise<void> {
		if (this.isShuttingDown) return;
		this.isShuttingDown = true;
		this.unregisterSignalHandlers();

		// Drain any in-flight Kitty key release events before stopping.
		// This prevents escape sequences from leaking to the parent shell over slow SSH.
		await this.ui.terminal.drainInput(1000);

		this.stop();
		await this.runtimeHost.dispose();
		exitAfterCleanup(0);
	}

	private emergencyTerminalExit(): never {
		this.isShuttingDown = true;
		this.unregisterSignalHandlers();
		killTrackedDetachedChildren();
		// The terminal is gone. Do not run normal shutdown because TUI and
		// extension cleanup can write restore sequences and re-trigger EIO.
		exitAfterCleanup(129);
	}

	/**
	 * Last-resort handler for uncaught exceptions. The TUI puts stdin into raw
	 * mode and hides the cursor; without this handler, an uncaught throw from
	 * anywhere (e.g. an extension's async `ChildProcess.on("exit")` callback)
	 * tears down the process while leaving the terminal in raw mode with no
	 * cursor, requiring `stty sane && reset` to recover.
	 *
	 * Unlike emergencyTerminalExit, the terminal is still alive here, so we
	 * call ui.stop() to restore cooked mode, the cursor, and disable bracketed
	 * paste / Kitty / modifyOtherKeys sequences.
	 */
	private uncaughtCrash(error: Error): never {
		if (this.isShuttingDown) {
			exitAfterCleanup(1);
		}
		this.isShuttingDown = true;
		try {
			this.unregisterSignalHandlers();
		} catch {}
		try {
			killTrackedDetachedChildren();
		} catch {}
		try {
			this.ui.stop();
		} catch {}
		console.error("Neo Code exiting due to uncaughtException:");
		console.error(error);
		exitAfterCleanup(1);
	}

	/**
	 * Check if shutdown was requested and perform shutdown if so.
	 */
	private async checkShutdownRequested(): Promise<void> {
		if (!this.shutdownRequested) return;
		await this.shutdown();
	}

	private registerSignalHandlers(): void {
		this.unregisterSignalHandlers();

		const signals: NodeJS.Signals[] = ["SIGTERM"];
		if (process.platform !== "win32") {
			signals.push("SIGHUP");
		}

		for (const signal of signals) {
			const handler = () => {
				if (signal === "SIGHUP") {
					this.emergencyTerminalExit();
				}
				killTrackedDetachedChildren();
				void this.shutdown();
			};
			process.prependListener(signal, handler);
			this.signalCleanupHandlers.push(() => process.off(signal, handler));
		}

		const terminalErrorHandler = (error: Error) => {
			if (isDeadTerminalError(error)) {
				this.emergencyTerminalExit();
			}
			throw error;
		};
		process.stdout.on("error", terminalErrorHandler);
		process.stderr.on("error", terminalErrorHandler);
		this.signalCleanupHandlers.push(() => process.stdout.off("error", terminalErrorHandler));
		this.signalCleanupHandlers.push(() => process.stderr.off("error", terminalErrorHandler));

		// Restore the terminal before the process dies on any uncaught throw.
		// Without this, an unhandled exception from extension code (or anywhere
		// in Neo Code) leaves the terminal in raw mode with no cursor.
		const uncaughtExceptionHandler = (error: Error) => this.uncaughtCrash(error);
		process.prependListener("uncaughtException", uncaughtExceptionHandler);
		this.signalCleanupHandlers.push(() => process.off("uncaughtException", uncaughtExceptionHandler));
	}

	private unregisterSignalHandlers(): void {
		for (const cleanup of this.signalCleanupHandlers) {
			cleanup();
		}
		this.signalCleanupHandlers = [];
	}

	private handleCtrlZ(): void {
		if (process.platform === "win32") {
			this.showStatus("Suspend to background is not supported on Windows");
			return;
		}

		// Keep the event loop alive while suspended. Without this, stopping the TUI
		// can leave Node with no ref'ed handles, causing the process to exit on fg
		// before the SIGCONT handler gets a chance to restore the terminal.
		const suspendKeepAlive = setInterval(() => {}, 2 ** 30);

		// Ignore SIGINT while suspended so Ctrl+C in the terminal does not
		// kill the backgrounded process. The handler is removed on resume.
		const ignoreSigint = () => {};
		process.on("SIGINT", ignoreSigint);

		// Set up handler to restore TUI when resumed
		process.once("SIGCONT", () => {
			clearInterval(suspendKeepAlive);
			process.removeListener("SIGINT", ignoreSigint);
			this.ui.start();
			this.ui.requestRender(true);
		});

		try {
			// Stop the TUI (restore terminal to normal mode)
			this.ui.stop();

			// Send SIGTSTP to process group (pid=0 means all processes in group)
			process.kill(0, "SIGTSTP");
		} catch (error) {
			clearInterval(suspendKeepAlive);
			process.removeListener("SIGINT", ignoreSigint);
			throw error;
		}
	}

	private async handleFollowUp(): Promise<void> {
		const text = (this.editor.getExpandedText?.() ?? this.editor.getText()).trim();
		if (!text) return;

		// Queue input during compaction (extension commands execute immediately)
		if (this.session.isCompacting) {
			if (this.isExtensionCommand(text)) {
				this.editor.addToHistory?.(text);
				this.editor.setText("");
				await this.session.prompt(text);
			} else {
				this.queueCompactionMessage(text, "followUp");
			}
			return;
		}

		// Alt+Enter queues a follow-up message (waits until agent finishes)
		// This handles extension commands (execute immediately), prompt template expansion, and queueing
		if (this.session.isStreaming) {
			this.editor.addToHistory?.(text);
			this.editor.setText("");
			await this.session.prompt(text, { streamingBehavior: "followUp" });
			this.updatePendingMessagesDisplay();
			this.ui.requestRender();
		}
		// If not streaming, Alt+Enter acts like regular Enter (trigger onSubmit)
		else if (this.editor.onSubmit) {
			this.editor.setText("");
			this.editor.onSubmit(text);
		}
	}

	private handleDequeue(): void {
		const restored = this.restoreQueuedMessagesToEditor();
		if (restored === 0) {
			this.showStatus("No queued messages to restore");
		} else {
			this.showStatus(`Restored ${restored} queued message${restored > 1 ? "s" : ""} to editor`);
		}
	}

	private updateEditorBorderColor(): void {
		if (this.isBashMode) {
			this.editor.borderColor = theme.getBashModeBorderColor();
		} else {
			const level = this.session.thinkingLevel || "off";
			this.editor.borderColor = theme.getThinkingBorderColor(level);
		}
		this.ui.requestRender();
	}

	private cycleAgentMode(): void {
		const nextMode = getNextAgentWorkMode(this.session.agentMode);
		this.applyAgentMode(nextMode);
		this.showStatus(`Mode: ${getAgentWorkModeLabel(nextMode)} (${formatAgentWorkModeCycleList()})`);
	}

	private cycleThinkingLevel(): void {
		const newLevel = this.session.cycleThinkingLevel();
		if (newLevel === undefined) {
			this.showStatus("Current model does not support thinking");
		} else {
			this.footer.invalidate();
			this.updateEditorBorderColor();
			this.showStatus(`Thinking level: ${newLevel}`);
		}
	}

	private async cycleModel(direction: "forward" | "backward"): Promise<void> {
		try {
			const result = await this.session.cycleModel(direction);
			if (result === undefined) {
				const msg = this.session.scopedModels.length > 0 ? "Only one model in scope" : "Only one model available";
				this.showStatus(msg);
			} else {
				this.footer.invalidate();
				this.updateEditorBorderColor();
				const thinkingStr =
					result.model.reasoning && result.thinkingLevel !== "off" ? ` (thinking: ${result.thinkingLevel})` : "";
				this.showStatus(`Switched to ${result.model.name || result.model.id}${thinkingStr}`);
			}
		} catch (error) {
			this.showError(error instanceof Error ? error.message : String(error));
		}
	}

	private toggleToolOutputExpansion(): void {
		this.setToolsExpanded(!this.toolOutputExpanded);
	}

	private setToolsExpanded(expanded: boolean): void {
		this.toolOutputExpanded = expanded;
		const activeHeader = this.customHeader ?? this.builtInHeader;
		if (isExpandable(activeHeader)) {
			activeHeader.setExpanded(expanded);
		}
		// When streaming: expand current/pending groups (live output).
		// When idle: expand only the LAST tool group (most recent result).
		if (this.session.isStreaming) {
			if (this.currentToolActivityGroup) {
				this.currentToolActivityGroup.setExpanded(expanded);
			}
			for (const group of this.pendingToolGroups.values()) {
				group.setExpanded(expanded);
			}
		} else {
			let lastGroup: ToolActivityGroupComponent | undefined;
			for (const child of this.chatContainer.children) {
				if (child instanceof ToolActivityGroupComponent) {
					lastGroup = child;
				}
			}
			if (lastGroup) {
				lastGroup.setExpanded(expanded);
			}
		}
		this.ui.requestRender();
	}

	private toggleThinkingBlockVisibility(): void {
		this.hideThinkingBlock = !this.hideThinkingBlock;
		this.settingsManager.setHideThinkingBlock(this.hideThinkingBlock);

		// Rebuild chat from session messages
		this.chatContainer.clear();
		this.rebuildChatFromMessages();

		// If streaming, re-add the streaming component with updated visibility and re-render
		if (this.streamingComponent && this.streamingMessage) {
			this.streamingComponent.setHideThinkingBlock(this.hideThinkingBlock);
			this.streamingComponent.updateContent(this.streamingMessage);
			this.chatContainer.addChild(this.streamingComponent);
		}

		this.showStatus(`Thinking blocks: ${this.hideThinkingBlock ? "hidden" : "visible"}`);
	}

	private openExternalEditor(): void {
		// Determine editor (respect $VISUAL, then $EDITOR)
		const editorCmd = process.env.VISUAL || process.env.EDITOR;
		if (!editorCmd) {
			this.showWarning("No editor configured. Set $VISUAL or $EDITOR environment variable.");
			return;
		}

		const currentText = this.editor.getExpandedText?.() ?? this.editor.getText();
		const tmpFile = path.join(os.tmpdir(), `neo-editor-${Date.now()}.neo.md`);

		try {
			// Write current content to temp file
			fs.writeFileSync(tmpFile, currentText, "utf-8");

			// Stop TUI to release terminal
			this.ui.stop();

			// Split by space to support editor arguments (e.g., "code --wait")
			const [editor, ...editorArgs] = editorCmd.split(" ");

			// Spawn editor synchronously with inherited stdio for interactive editing
			const result = spawnSync(editor, [...editorArgs, tmpFile], {
				stdio: "inherit",
				shell: process.platform === "win32",
			});

			// On successful exit (status 0), replace editor content
			if (result.status === 0) {
				const newContent = fs.readFileSync(tmpFile, "utf-8").replace(/\n$/, "");
				this.editor.setText(newContent);
			}
			// On non-zero exit, keep original text (no action needed)
		} finally {
			// Clean up temp file
			try {
				fs.unlinkSync(tmpFile);
			} catch {
				// Ignore cleanup errors
			}

			// Restart TUI
			this.ui.start();
			// Force full re-render since external editor uses alternate screen
			this.ui.requestRender(true);
		}
	}

	// =========================================================================
	// UI helpers
	// =========================================================================

	clearEditor(): void {
		this.editor.setText("");
		this.ui.requestRender();
	}

	showError(errorMessage: string): void {
		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new Text(theme.fg("error", `Error: ${errorMessage}`), 1, 0));
		this.ui.requestRender();
	}

	showWarning(warningMessage: string): void {
		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new Text(theme.fg("warning", `Warning: ${warningMessage}`), 1, 0));
		this.ui.requestRender();
	}

	showNewVersionNotification(newVersion: string): void {
		const action = theme.fg("accent", `${APP_NAME} update`);
		const updateInstruction = theme.fg("muted", `New version ${newVersion} is available. Run `) + action;
		const changelogLine = theme.fg("muted", "Changelog: Run ") + theme.fg("accent", "/changelog");

		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new DynamicBorder((text) => theme.fg("warning", text)));
		this.chatContainer.addChild(
			new Text(
				`${theme.bold(theme.fg("warning", "Update Available"))}\n${updateInstruction}\n${changelogLine}`,
				1,
				0,
			),
		);
		this.chatContainer.addChild(new DynamicBorder((text) => theme.fg("warning", text)));
		this.ui.requestRender();
	}

	showPackageUpdateNotification(packages: string[]): void {
		const action = theme.fg("accent", `${APP_NAME} update`);
		const updateInstruction = theme.fg("muted", "Package updates are available. Run ") + action;
		const packageLines = packages.map((pkg) => `- ${pkg}`).join("\n");

		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new DynamicBorder((text) => theme.fg("warning", text)));
		this.chatContainer.addChild(
			new Text(
				`${theme.bold(theme.fg("warning", "Package Updates Available"))}\n${updateInstruction}\n${theme.fg("muted", "Packages:")}\n${packageLines}`,
				1,
				0,
			),
		);
		this.chatContainer.addChild(new DynamicBorder((text) => theme.fg("warning", text)));
		this.ui.requestRender();
	}

	/**
	 * Get all queued messages (read-only).
	 * Combines session queue and compaction queue.
	 */
	private getAllQueuedMessages(): { steering: string[]; followUp: string[] } {
		return {
			steering: [
				...this.session.getSteeringMessages(),
				...this.compactionQueuedMessages.filter((msg) => msg.mode === "steer").map((msg) => msg.text),
			],
			followUp: [
				...this.session.getFollowUpMessages(),
				...this.compactionQueuedMessages.filter((msg) => msg.mode === "followUp").map((msg) => msg.text),
			],
		};
	}

	/**
	 * Clear all queued messages and return their contents.
	 * Clears both session queue and compaction queue.
	 */
	private clearAllQueues(): { steering: string[]; followUp: string[] } {
		const { steering, followUp } = this.session.clearQueue();
		const compactionSteering = this.compactionQueuedMessages
			.filter((msg) => msg.mode === "steer")
			.map((msg) => msg.text);
		const compactionFollowUp = this.compactionQueuedMessages
			.filter((msg) => msg.mode === "followUp")
			.map((msg) => msg.text);
		this.compactionQueuedMessages = [];
		return {
			steering: [...steering, ...compactionSteering],
			followUp: [...followUp, ...compactionFollowUp],
		};
	}

	private updatePendingMessagesDisplay(): void {
		this.pendingMessagesContainer.clear();
		const { steering: steeringMessages, followUp: followUpMessages } = this.getAllQueuedMessages();
		if (steeringMessages.length > 0 || followUpMessages.length > 0) {
			this.pendingMessagesContainer.addChild(new Spacer(1));
			for (const message of steeringMessages) {
				const text = theme.fg("dim", `Steering: ${message}`);
				this.pendingMessagesContainer.addChild(new TruncatedText(text, 1, 0));
			}
			for (const message of followUpMessages) {
				const text = theme.fg("dim", `Follow-up: ${message}`);
				this.pendingMessagesContainer.addChild(new TruncatedText(text, 1, 0));
			}
			const dequeueHint = this.getAppKeyDisplay("app.message.dequeue");
			const hintText = theme.fg("dim", `↳ ${dequeueHint} to edit all queued messages`);
			this.pendingMessagesContainer.addChild(new TruncatedText(hintText, 1, 0));
		}
	}

	private restoreQueuedMessagesToEditor(options?: { abort?: boolean; currentText?: string }): number {
		const { steering, followUp } = this.clearAllQueues();
		const allQueued = [...steering, ...followUp];
		if (allQueued.length === 0) {
			this.updatePendingMessagesDisplay();
			if (options?.abort) {
				this.session.abortRetry();
				this.agent.abort();
			}
			return 0;
		}
		const queuedText = allQueued.join("\n\n");
		const currentText = options?.currentText ?? this.editor.getText();
		const combinedText = [queuedText, currentText].filter((t) => t.trim()).join("\n\n");
		this.editor.setText(combinedText);
		this.updatePendingMessagesDisplay();
		if (options?.abort) {
			this.session.abortRetry();
			this.agent.abort();
		}
		return allQueued.length;
	}

	private queueCompactionMessage(text: string, mode: "steer" | "followUp"): void {
		this.compactionQueuedMessages.push({ text, mode });
		this.editor.addToHistory?.(text);
		this.editor.setText("");
		this.updatePendingMessagesDisplay();
		this.showStatus("Queued message for after compaction");
	}

	private isExtensionCommand(text: string): boolean {
		if (!text.startsWith("/")) return false;

		const extensionRunner = this.session.extensionRunner;

		const spaceIndex = text.indexOf(" ");
		const commandName = spaceIndex === -1 ? text.slice(1) : text.slice(1, spaceIndex);
		return !!extensionRunner.getCommand(commandName);
	}

	private async flushCompactionQueue(options?: { willRetry?: boolean }): Promise<void> {
		if (this.compactionQueuedMessages.length === 0) {
			return;
		}

		const queuedMessages = [...this.compactionQueuedMessages];
		this.compactionQueuedMessages = [];
		this.updatePendingMessagesDisplay();

		const restoreQueue = (error: unknown) => {
			this.session.clearQueue();
			this.compactionQueuedMessages = queuedMessages;
			this.updatePendingMessagesDisplay();
			this.showError(
				`Failed to send queued message${queuedMessages.length > 1 ? "s" : ""}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		};

		try {
			if (options?.willRetry) {
				// When retry is pending, queue messages for the retry turn
				for (const message of queuedMessages) {
					if (this.isExtensionCommand(message.text)) {
						await this.session.prompt(message.text);
					} else if (message.mode === "followUp") {
						await this.session.followUp(message.text);
					} else {
						await this.session.steer(message.text);
					}
				}
				this.updatePendingMessagesDisplay();
				return;
			}

			// Find first non-extension-command message to use as prompt
			const firstPromptIndex = queuedMessages.findIndex((message) => !this.isExtensionCommand(message.text));
			if (firstPromptIndex === -1) {
				// All extension commands - execute them all
				for (const message of queuedMessages) {
					await this.session.prompt(message.text);
				}
				return;
			}

			// Execute any extension commands before the first prompt
			const preCommands = queuedMessages.slice(0, firstPromptIndex);
			const firstPrompt = queuedMessages[firstPromptIndex];
			const rest = queuedMessages.slice(firstPromptIndex + 1);

			for (const message of preCommands) {
				await this.session.prompt(message.text);
			}

			// Send first prompt (starts streaming)
			const promptPromise = this.session.prompt(firstPrompt.text).catch((error) => {
				restoreQueue(error);
			});

			// Queue remaining messages
			for (const message of rest) {
				if (this.isExtensionCommand(message.text)) {
					await this.session.prompt(message.text);
				} else if (message.mode === "followUp") {
					await this.session.followUp(message.text);
				} else {
					await this.session.steer(message.text);
				}
			}
			this.updatePendingMessagesDisplay();
			void promptPromise;
		} catch (error) {
			restoreQueue(error);
		}
	}

	/** Move pending bash components from pending area to chat */
	private flushPendingBashComponents(): void {
		for (const component of this.pendingBashComponents) {
			this.pendingMessagesContainer.removeChild(component);
			this.chatContainer.addChild(component);
		}
		this.pendingBashComponents = [];
	}

	// =========================================================================
	// Selectors
	// =========================================================================

	/**
	 * Shows a selector component in place of the editor.
	 * @param create Factory that receives a `done` callback and returns the component and focus target
	 */
	private showSelector(create: (done: () => void) => { component: Component; focus: Component }): void {
		const done = () => {
			this.editorContainer.clear();
			this.editorContainer.addChild(this.editor);
			this.ui.setFocus(this.editor);
		};
		const { component, focus } = create(done);
		this.editorContainer.clear();
		this.editorContainer.addChild(component);
		this.ui.setFocus(focus);
		this.ui.requestRender();
	}

	private handleStatuslineCommand(text: string): void {
		const arg = text.slice("/statusline".length).trim().toLowerCase();
		if (arg === "reset") {
			this.settingsManager.setStatuslineItems(undefined);
			this.footer.invalidate();
			this.ui.requestRender();
			this.showStatus("Status line reset to defaults");
			return;
		}
		this.showStatuslineSelector();
	}

	private showStatuslineSelector(): void {
		this.showSelector((done) => {
			const current = this.settingsManager.getStatuslineItems();
			const selector = new StatuslineSelectorComponent(
				current,
				(items) => {
					this.settingsManager.setStatuslineItems(items);
					this.footer.invalidate();
					this.ui.requestRender();
					this.showStatus("Status line updated");
					done();
				},
				() => {
					this.showStatus("Status line unchanged");
					done();
				},
			);
			return { component: selector, focus: selector };
		});
	}

	private showSettingsSelector(): void {
		this.showSelector((done) => {
			const selector = new SettingsSelectorComponent(
				{
					autoCompact: this.session.autoCompactionEnabled,
					showImages: this.settingsManager.getShowImages(),
					imageWidthCells: this.settingsManager.getImageWidthCells(),
					autoResizeImages: this.settingsManager.getImageAutoResize(),
					blockImages: this.settingsManager.getBlockImages(),
					enableSkillCommands: this.settingsManager.getEnableSkillCommands(),
					steeringMode: this.session.steeringMode,
					followUpMode: this.session.followUpMode,
					transport: this.settingsManager.getTransport(),
					thinkingLevel: this.session.thinkingLevel,
					availableThinkingLevels: this.session.getAvailableThinkingLevels(),
					currentTheme: this.settingsManager.getTheme() || "dark",
					availableThemes: getAvailableThemes(),
					hideThinkingBlock: this.hideThinkingBlock,
					collapseChangelog: this.settingsManager.getCollapseChangelog(),
					enableInstallTelemetry: this.settingsManager.getEnableInstallTelemetry(),
					doubleEscapeAction: this.settingsManager.getDoubleEscapeAction(),
					treeFilterMode: this.settingsManager.getTreeFilterMode(),
					showHardwareCursor: this.settingsManager.getShowHardwareCursor(),
					editorPaddingX: this.settingsManager.getEditorPaddingX(),
					autocompleteMaxVisible: this.settingsManager.getAutocompleteMaxVisible(),
					quietStartup: this.settingsManager.getQuietStartup(),
					clearOnShrink: this.settingsManager.getClearOnShrink(),
					showTerminalProgress: this.settingsManager.getShowTerminalProgress(),
					warnings: this.settingsManager.getWarnings(),
				},
				{
					onAutoCompactChange: (enabled) => {
						this.session.setAutoCompactionEnabled(enabled);
						this.footer.setAutoCompactEnabled(enabled);
					},
					onShowImagesChange: (enabled) => {
						this.settingsManager.setShowImages(enabled);
						for (const child of this.chatContainer.children) {
							if (child instanceof ToolExecutionComponent || child instanceof ToolActivityGroupComponent) {
								child.setShowImages(enabled);
							}
						}
					},
					onImageWidthCellsChange: (width) => {
						this.settingsManager.setImageWidthCells(width);
						for (const child of this.chatContainer.children) {
							if (child instanceof ToolExecutionComponent || child instanceof ToolActivityGroupComponent) {
								child.setImageWidthCells(width);
							}
						}
					},
					onAutoResizeImagesChange: (enabled) => {
						this.settingsManager.setImageAutoResize(enabled);
					},
					onBlockImagesChange: (blocked) => {
						this.settingsManager.setBlockImages(blocked);
					},
					onEnableSkillCommandsChange: (enabled) => {
						this.settingsManager.setEnableSkillCommands(enabled);
						this.setupAutocompleteProvider();
					},
					onSteeringModeChange: (mode) => {
						this.session.setSteeringMode(mode);
					},
					onFollowUpModeChange: (mode) => {
						this.session.setFollowUpMode(mode);
					},
					onTransportChange: (transport) => {
						this.settingsManager.setTransport(transport);
						this.session.agent.transport = transport;
					},
					onThinkingLevelChange: (level) => {
						this.session.setThinkingLevel(level);
						this.footer.invalidate();
						this.updateEditorBorderColor();
					},
					onThemeChange: (themeName) => {
						const result = setTheme(themeName, true);
						this.settingsManager.setTheme(themeName);
						this.ui.invalidate();
						if (!result.success) {
							this.showError(`Failed to load theme "${themeName}": ${result.error}\nFell back to dark theme.`);
						}
					},
					onThemePreview: (themeName) => {
						const result = setTheme(themeName, true);
						if (result.success) {
							this.ui.invalidate();
							this.ui.requestRender();
						}
					},
					onHideThinkingBlockChange: (hidden) => {
						this.hideThinkingBlock = hidden;
						this.settingsManager.setHideThinkingBlock(hidden);
						for (const child of this.chatContainer.children) {
							if (child instanceof AssistantMessageComponent) {
								child.setHideThinkingBlock(hidden);
							}
						}
						this.chatContainer.clear();
						this.rebuildChatFromMessages();
					},
					onCollapseChangelogChange: (collapsed) => {
						this.settingsManager.setCollapseChangelog(collapsed);
					},
					onEnableInstallTelemetryChange: (enabled) => {
						this.settingsManager.setEnableInstallTelemetry(enabled);
					},
					onQuietStartupChange: (enabled) => {
						this.settingsManager.setQuietStartup(enabled);
					},
					onDoubleEscapeActionChange: (action) => {
						this.settingsManager.setDoubleEscapeAction(action);
					},
					onTreeFilterModeChange: (mode) => {
						this.settingsManager.setTreeFilterMode(mode);
					},
					onShowHardwareCursorChange: (enabled) => {
						this.settingsManager.setShowHardwareCursor(enabled);
						this.ui.setShowHardwareCursor(enabled);
					},
					onEditorPaddingXChange: (padding) => {
						this.settingsManager.setEditorPaddingX(padding);
						this.defaultEditor.setPaddingX(padding);
						if (this.editor !== this.defaultEditor && this.editor.setPaddingX !== undefined) {
							this.editor.setPaddingX(padding);
						}
					},
					onAutocompleteMaxVisibleChange: (maxVisible) => {
						this.settingsManager.setAutocompleteMaxVisible(maxVisible);
						this.defaultEditor.setAutocompleteMaxVisible(maxVisible);
						if (this.editor !== this.defaultEditor && this.editor.setAutocompleteMaxVisible !== undefined) {
							this.editor.setAutocompleteMaxVisible(maxVisible);
						}
					},
					onClearOnShrinkChange: (enabled) => {
						this.settingsManager.setClearOnShrink(enabled);
						this.ui.setClearOnShrink(enabled);
					},
					onShowTerminalProgressChange: (enabled) => {
						this.settingsManager.setShowTerminalProgress(enabled);
					},
					onWarningsChange: (warnings) => {
						this.settingsManager.setWarnings(warnings);
					},
					onCancel: () => {
						done();
						this.ui.requestRender();
					},
				},
			);
			return { component: selector, focus: selector.getSettingsList() };
		});
	}

	private async handleModelCommand(searchTerm?: string): Promise<void> {
		if (!searchTerm) {
			this.showModelSelector();
			return;
		}

		const model = await this.findExactModelMatch(searchTerm);
		if (model) {
			try {
				await this.session.setModel(model);
				this.footer.invalidate();
				this.updateEditorBorderColor();
				this.showStatus(`Model: ${model.id}`);
			} catch (error) {
				this.showError(error instanceof Error ? error.message : String(error));
			}
			return;
		}

		this.showModelSelector(searchTerm);
	}

	private async findExactModelMatch(searchTerm: string): Promise<Model<any> | undefined> {
		const models = await this.getModelCandidates();
		return findExactModelReferenceMatch(searchTerm, models);
	}

	private async getModelCandidates(): Promise<Model<any>[]> {
		if (this.session.scopedModels.length > 0) {
			return this.session.scopedModels.map((scoped) => scoped.model);
		}

		this.session.modelRegistry.refresh();
		try {
			return await this.session.modelRegistry.getAvailable();
		} catch {
			return [];
		}
	}

	/** Update the footer's available provider count from current model candidates */
	private async updateAvailableProviderCount(): Promise<void> {
		const models = await this.getModelCandidates();
		const uniqueProviders = new Set(models.map((m) => m.provider));
		this.footerDataProvider.setAvailableProviderCount(uniqueProviders.size);
	}

	private showModelSelector(initialSearchInput?: string): void {
		this.showSelector((done) => {
			const selector = new ModelSelectorComponent(
				this.ui,
				this.session.model,
				this.settingsManager,
				this.session.modelRegistry,
				this.session.scopedModels,
				async (model) => {
					try {
						await this.session.setModel(model);
						this.footer.invalidate();
						this.updateEditorBorderColor();
						done();
						this.showStatus(`Model: ${model.id}`);
					} catch (error) {
						done();
						this.showError(error instanceof Error ? error.message : String(error));
					}
				},
				() => {
					done();
					this.ui.requestRender();
				},
				initialSearchInput,
			);
			return { component: selector, focus: selector };
		});
	}

	private async showModelsSelector(): Promise<void> {
		// Get all available models
		this.session.modelRegistry.refresh();
		const allModels = this.session.modelRegistry.getAvailable();

		if (allModels.length === 0) {
			this.showStatus("No models available");
			return;
		}

		// Check if session has scoped models (from previous session-only changes or CLI --models)
		const sessionScopedModels = this.session.scopedModels;
		const hasSessionScope = sessionScopedModels.length > 0;

		// Build enabled model IDs from session state or settings
		let currentEnabledIds: string[] | null = null;

		if (hasSessionScope) {
			// Use current session's scoped models
			currentEnabledIds = sessionScopedModels.map((scoped) => `${scoped.model.provider}/${scoped.model.id}`);
		} else {
			// Fall back to settings
			const patterns = this.settingsManager.getEnabledModels();
			if (patterns !== undefined && patterns.length > 0) {
				const scopedModels = await resolveModelScope(patterns, this.session.modelRegistry);
				currentEnabledIds = scopedModels.map((scoped) => `${scoped.model.provider}/${scoped.model.id}`);
			}
		}

		// Helper to update session's scoped models (session-only, no persist)
		const updateSessionModels = async (enabledIds: string[] | null) => {
			currentEnabledIds = enabledIds === null ? null : [...enabledIds];
			if (enabledIds && enabledIds.length > 0 && enabledIds.length < allModels.length) {
				const newScopedModels = await resolveModelScope(enabledIds, this.session.modelRegistry);
				this.session.setScopedModels(
					newScopedModels.map((sm) => ({
						model: sm.model,
						thinkingLevel: sm.thinkingLevel,
					})),
				);
			} else {
				// All enabled or none enabled = no filter
				this.session.setScopedModels([]);
			}
			await this.updateAvailableProviderCount();
			this.ui.requestRender();
		};

		this.showSelector((done) => {
			const selector = new ScopedModelsSelectorComponent(
				{
					allModels,
					enabledModelIds: currentEnabledIds,
				},
				{
					onChange: async (enabledIds) => {
						await updateSessionModels(enabledIds);
					},
					onPersist: (enabledIds) => {
						// Persist to settings
						const newPatterns =
							enabledIds === null || enabledIds.length === allModels.length
								? undefined // All enabled = clear filter
								: enabledIds;
						this.settingsManager.setEnabledModels(newPatterns ? [...newPatterns] : undefined);
						this.showStatus("Model selection saved to settings");
					},
					onCancel: () => {
						done();
						this.ui.requestRender();
					},
				},
			);
			return { component: selector, focus: selector };
		});
	}

	private showUserMessageSelector(): void {
		const userMessages = this.session.getUserMessagesForForking();

		if (userMessages.length === 0) {
			this.showStatus("No messages to fork from");
			return;
		}

		const initialSelectedId = userMessages[userMessages.length - 1]?.entryId;

		this.showSelector((done) => {
			const selector = new UserMessageSelectorComponent(
				userMessages.map((m) => ({ id: m.entryId, text: m.text })),
				async (entryId) => {
					try {
						const result = await this.runtimeHost.fork(entryId);
						if (result.cancelled) {
							done();
							this.ui.requestRender();
							return;
						}

						this.renderCurrentSessionState();
						this.editor.setText(result.selectedText ?? "");
						done();
						this.showStatus("Forked to new session");
					} catch (error: unknown) {
						done();
						this.showError(error instanceof Error ? error.message : String(error));
					}
				},
				() => {
					done();
					this.ui.requestRender();
				},
				initialSelectedId,
			);
			return { component: selector, focus: selector.getMessageList() };
		});
	}

	private async handleCloneCommand(): Promise<void> {
		const leafId = this.sessionManager.getLeafId();
		if (!leafId) {
			this.showStatus("Nothing to clone yet");
			return;
		}

		try {
			const result = await this.runtimeHost.fork(leafId, { position: "at" });
			if (result.cancelled) {
				this.ui.requestRender();
				return;
			}

			this.renderCurrentSessionState();
			this.editor.setText("");
			this.showStatus("Cloned to new session");
		} catch (error: unknown) {
			this.showError(error instanceof Error ? error.message : String(error));
		}
	}

	private showTreeSelector(initialSelectedId?: string): void {
		const tree = this.sessionManager.getTree();
		const realLeafId = this.sessionManager.getLeafId();
		const initialFilterMode = this.settingsManager.getTreeFilterMode();

		if (tree.length === 0) {
			this.showStatus("No entries in session");
			return;
		}

		this.showSelector((done) => {
			const selector = new TreeSelectorComponent(
				tree,
				realLeafId,
				this.ui.terminal.rows,
				async (entryId) => {
					// Selecting the current leaf is a no-op (already there)
					if (entryId === realLeafId) {
						done();
						this.showStatus("Already at this point");
						return;
					}

					// Ask about summarization
					done(); // Close selector first

					// Loop until user makes a complete choice or cancels to tree
					let wantsSummary = false;
					let customInstructions: string | undefined;

					// Check if we should skip the prompt (user preference to always default to no summary)
					if (!this.settingsManager.getBranchSummarySkipPrompt()) {
						while (true) {
							const summaryChoice = await this.showExtensionSelector("Summarize branch?", [
								"No summary",
								"Summarize",
								"Summarize with custom prompt",
							]);

							if (summaryChoice === undefined) {
								// User pressed escape - re-show tree selector with same selection
								this.showTreeSelector(entryId);
								return;
							}

							wantsSummary = summaryChoice !== "No summary";

							if (summaryChoice === "Summarize with custom prompt") {
								customInstructions = await this.showExtensionEditor("Custom summarization instructions");
								if (customInstructions === undefined) {
									// User cancelled - loop back to summary selector
									continue;
								}
							}

							// User made a complete choice
							break;
						}
					}

					// Set up escape handler and loader if summarizing
					let summaryLoader: Loader | undefined;
					const originalOnEscape = this.defaultEditor.onEscape;

					if (wantsSummary) {
						this.defaultEditor.onEscape = () => {
							this.session.abortBranchSummary();
						};
						this.chatContainer.addChild(new Spacer(1));
						summaryLoader = new Loader(
							this.ui,
							(spinner) => theme.fg("accent", spinner),
							(text) => theme.fg("muted", text),
							`Summarizing branch... (${keyText("app.interrupt")} to cancel)`,
						);
						this.statusContainer.addChild(summaryLoader);
						this.ui.requestRender();
					}

					try {
						const result = await this.session.navigateTree(entryId, {
							summarize: wantsSummary,
							customInstructions,
						});

						if (result.aborted) {
							// Summarization aborted - re-show tree selector with same selection
							this.showStatus("Branch summarization cancelled");
							this.showTreeSelector(entryId);
							return;
						}
						if (result.cancelled) {
							this.showStatus("Navigation cancelled");
							return;
						}

						// Update UI
						this.chatContainer.clear();
						this.renderInitialMessages();
						if (result.editorText && !this.editor.getText().trim()) {
							this.editor.setText(result.editorText);
						}
						this.showStatus("Navigated to selected point");
						void this.flushCompactionQueue({ willRetry: false });
					} catch (error) {
						this.showError(error instanceof Error ? error.message : String(error));
					} finally {
						if (summaryLoader) {
							summaryLoader.stop();
							this.statusContainer.clear();
						}
						this.defaultEditor.onEscape = originalOnEscape;
					}
				},
				() => {
					done();
					this.ui.requestRender();
				},
				(entryId, label) => {
					this.sessionManager.appendLabelChange(entryId, label);
					this.ui.requestRender();
				},
				initialSelectedId,
				initialFilterMode,
			);
			return { component: selector, focus: selector };
		});
	}

	private showSessionSelector(): void {
		this.showSelector((done) => {
			const selector = new SessionSelectorComponent(
				(onProgress) =>
					SessionManager.list(this.sessionManager.getCwd(), this.sessionManager.getSessionDir(), onProgress),
				SessionManager.listAll,
				async (sessionPath) => {
					done();
					await this.handleResumeSession(sessionPath);
				},
				() => {
					done();
					this.ui.requestRender();
				},
				() => {
					void this.shutdown();
				},
				() => this.ui.requestRender(),
				{
					renameSession: async (sessionFilePath: string, nextName: string | undefined) => {
						const next = (nextName ?? "").trim();
						if (!next) return;
						const mgr = SessionManager.open(sessionFilePath);
						mgr.appendSessionInfo(next);
					},
					showRenameHint: true,
					keybindings: this.keybindings,
				},

				this.sessionManager.getSessionFile(),
			);
			return { component: selector, focus: selector };
		});
	}

	private async handleResumeSession(
		sessionPath: string,
		options?: Parameters<ExtensionCommandContext["switchSession"]>[1],
	): Promise<{ cancelled: boolean }> {
		if (this.loadingAnimation) {
			this.loadingAnimation.stop();
			this.loadingAnimation = undefined;
		}
		this.statusContainer.clear();
		try {
			const result = await this.runtimeHost.switchSession(sessionPath, {
				withSession: options?.withSession,
			});
			if (result.cancelled) {
				return result;
			}
			this.renderCurrentSessionState();
			this.showStatus("Resumed session");
			return result;
		} catch (error: unknown) {
			if (error instanceof MissingSessionCwdError) {
				const selectedCwd = await this.promptForMissingSessionCwd(error);
				if (!selectedCwd) {
					this.showStatus("Resume cancelled");
					return { cancelled: true };
				}
				const result = await this.runtimeHost.switchSession(sessionPath, {
					cwdOverride: selectedCwd,
					withSession: options?.withSession,
				});
				if (result.cancelled) {
					return result;
				}
				this.renderCurrentSessionState();
				this.showStatus("Resumed session in current cwd");
				return result;
			}
			return this.handleFatalRuntimeError("Failed to resume session", error);
		}
	}

	private getLoginProviderOptions(authType?: "oauth" | "api_key"): AuthSelectorProvider[] {
		const authStorage = this.session.modelRegistry.authStorage;
		const oauthProviders = authStorage.getOAuthProviders();
		const oauthProviderIds = new Set(oauthProviders.map((provider) => provider.id));
		const options: AuthSelectorProvider[] = oauthProviders.map((provider) => ({
			id: provider.id,
			name: provider.name,
			authType: "oauth",
		}));

		const modelProviders = new Set(this.session.modelRegistry.getAll().map((model) => model.provider));
		for (const providerId of modelProviders) {
			if (!isApiKeyLoginProvider(providerId, oauthProviderIds)) {
				continue;
			}
			options.push({
				id: providerId,
				name: this.session.modelRegistry.getProviderDisplayName(providerId),
				authType: "api_key",
			});
		}

		const filteredOptions = authType ? options.filter((option) => option.authType === authType) : options;
		return filteredOptions.sort((a, b) => a.name.localeCompare(b.name));
	}

	private getLogoutProviderOptions(): AuthSelectorProvider[] {
		const authStorage = this.session.modelRegistry.authStorage;
		const options: AuthSelectorProvider[] = [];

		for (const providerId of authStorage.list()) {
			const credential = authStorage.get(providerId);
			if (!credential) {
				continue;
			}
			options.push({
				id: providerId,
				name: this.session.modelRegistry.getProviderDisplayName(providerId),
				authType: credential.type,
			});
		}

		return options.sort((a, b) => a.name.localeCompare(b.name));
	}

	private showLoginAuthTypeSelector(): void {
		const neosantaraLabel = "Log in with Neosantara";
		const apiKeyLabel = "Use an API key";
		this.showSelector((done) => {
			const selector = new ExtensionSelectorComponent(
				"Select authentication method:",
				[neosantaraLabel, apiKeyLabel],
				async (option) => {
					done();
					if (option === neosantaraLabel) {
						await this.showNeosantaraDeviceLogin();
						return;
					}
					this.showLoginProviderSelector("api_key");
				},
				() => {
					done();
					this.ui.requestRender();
				},
			);
			return { component: selector, focus: selector };
		});
	}

	private async showNeosantaraDeviceLogin(): Promise<void> {
		const providerId = "neosantara";
		const providerName = this.session.modelRegistry.getProviderDisplayName(providerId);
		const previousModel = this.session.model;

		const dialog = new LoginDialogComponent(
			this.ui,
			providerId,
			(_success, _message) => {
				// Completion handled below
			},
			providerName,
			"Login to Neosantara",
		);

		this.editorContainer.clear();
		this.editorContainer.addChild(dialog);
		this.ui.setFocus(dialog);
		this.ui.requestRender();

		const restoreEditor = () => {
			this.editorContainer.clear();
			this.editorContainer.addChild(this.editor);
			this.ui.setFocus(this.editor);
			this.ui.requestRender();
		};

		try {
			await loginWithNeosantaraDeviceAuth({
				authStorage: this.session.modelRegistry.authStorage,
				signal: dialog.signal,
				stdout: {
					write: () => true,
				},
				onInitiated: (data) => {
					dialog.showDeviceAuth(data.verification_uri, data.user_code, data.expires_in);
				},
			});

			restoreEditor();
			await this.completeProviderAuthentication(providerId, providerName, "api_key", previousModel);
		} catch (error: unknown) {
			restoreEditor();
			const errorMsg = error instanceof Error ? error.message : String(error);
			if (errorMsg !== "Login cancelled") {
				this.showError(`Failed to login to ${providerName}: ${errorMsg}`);
			}
		}
	}

	private showLoginProviderSelector(authType: "oauth" | "api_key"): void {
		const providerOptions = this.getLoginProviderOptions(authType);
		if (providerOptions.length === 0) {
			this.showStatus(
				authType === "oauth" ? "No browser-login providers available." : "No API key providers available.",
			);
			return;
		}

		this.showSelector((done) => {
			const selector = new OAuthSelectorComponent(
				"login",
				this.session.modelRegistry.authStorage,
				providerOptions,
				async (providerId: string) => {
					done();

					const providerOption = providerOptions.find((provider) => provider.id === providerId);
					if (!providerOption) {
						return;
					}

					if (providerOption.authType === "oauth") {
						await this.showLoginDialog(providerOption.id, providerOption.name);
					} else {
						await this.showApiKeyLoginDialog(providerOption.id, providerOption.name);
					}
				},
				() => {
					done();
					this.showLoginAuthTypeSelector();
				},
				(providerId) => this.session.modelRegistry.getProviderAuthStatus(providerId),
			);
			return { component: selector, focus: selector };
		});
	}

	private async showOAuthSelector(mode: "login" | "logout"): Promise<void> {
		if (mode === "login") {
			this.showLoginAuthTypeSelector();
			return;
		}

		const providerOptions = this.getLogoutProviderOptions();
		if (providerOptions.length === 0) {
			this.showStatus(
				"No stored credentials to remove. /logout only removes credentials saved by /login; environment variables and models.json config are unchanged.",
			);
			return;
		}

		this.showSelector((done) => {
			const selector = new OAuthSelectorComponent(
				mode,
				this.session.modelRegistry.authStorage,
				providerOptions,
				async (providerId: string) => {
					done();

					const providerOption = providerOptions.find((provider) => provider.id === providerId);
					if (!providerOption) {
						return;
					}

					try {
						this.session.modelRegistry.authStorage.logout(providerOption.id);
						this.session.modelRegistry.refresh();
						await this.updateAvailableProviderCount();
						const message =
							providerOption.authType === "oauth"
								? `Logged out of ${providerOption.name}`
								: `Removed stored API key for ${providerOption.name}. Environment variables and models.json config are unchanged.`;
						this.showStatus(message);
					} catch (error: unknown) {
						this.showError(`Logout failed: ${error instanceof Error ? error.message : String(error)}`);
					}
				},
				() => {
					done();
					this.ui.requestRender();
				},
			);
			return { component: selector, focus: selector };
		});
	}

	private async completeProviderAuthentication(
		providerId: string,
		providerName: string,
		authType: "oauth" | "api_key",
		previousModel: Model<any> | undefined,
	): Promise<void> {
		this.session.modelRegistry.refresh();

		const actionLabel = authType === "oauth" ? `Logged in to ${providerName}` : `Saved API key for ${providerName}`;

		let selectedModel: Model<any> | undefined;
		let selectionError: string | undefined;
		if (isUnknownModel(previousModel)) {
			const availableModels = this.session.modelRegistry.getAvailable();
			const providerModels = availableModels.filter((model) => model.provider === providerId);
			if (!hasDefaultModelProvider(providerId)) {
				selectionError = `${actionLabel}, but no default model is configured for provider "${providerId}". Use /model to select a model.`;
			} else if (providerModels.length === 0) {
				selectionError = `${actionLabel}, but no models are available for that provider. Use /model to select a model.`;
			} else {
				const defaultModelId = defaultModelPerProvider[providerId];
				selectedModel = providerModels.find((model) => model.id === defaultModelId);
				if (!selectedModel) {
					selectionError = `${actionLabel}, but its default model "${defaultModelId}" is not available. Use /model to select a model.`;
				} else {
					try {
						await this.session.setModel(selectedModel);
					} catch (error: unknown) {
						selectedModel = undefined;
						const errorMessage = error instanceof Error ? error.message : String(error);
						selectionError = `${actionLabel}, but selecting its default model failed: ${errorMessage}. Use /model to select a model.`;
					}
				}
			}
		}

		await this.updateAvailableProviderCount();
		this.footer.invalidate();
		this.updateEditorBorderColor();
		if (selectedModel) {
			this.showStatus(`${actionLabel}. Selected ${selectedModel.id}. Credentials saved to ${getAuthPath()}`);
		} else {
			this.showStatus(`${actionLabel}. Credentials saved to ${getAuthPath()}`);
			if (selectionError) {
				this.showError(selectionError);
			} else {
			}
		}
	}

	private async showApiKeyLoginDialog(providerId: string, providerName: string): Promise<void> {
		const previousModel = this.session.model;

		const dialog = new LoginDialogComponent(
			this.ui,
			providerId,
			(_success, _message) => {
				// Completion handled below
			},
			providerName,
		);

		this.editorContainer.clear();
		this.editorContainer.addChild(dialog);
		this.ui.setFocus(dialog);
		this.ui.requestRender();

		const restoreEditor = () => {
			this.editorContainer.clear();
			this.editorContainer.addChild(this.editor);
			this.ui.setFocus(this.editor);
			this.ui.requestRender();
		};

		try {
			const apiKey = (await dialog.showPrompt("Enter API key:")).trim();
			if (!apiKey) {
				throw new Error("API key cannot be empty.");
			}

			this.session.modelRegistry.authStorage.set(providerId, {
				type: "api_key",
				key: apiKey,
			});

			restoreEditor();
			await this.completeProviderAuthentication(providerId, providerName, "api_key", previousModel);
		} catch (error: unknown) {
			restoreEditor();
			const errorMsg = error instanceof Error ? error.message : String(error);
			if (errorMsg !== "Login cancelled") {
				this.showError(`Failed to save API key for ${providerName}: ${errorMsg}`);
			}
		}
	}

	private showOAuthLoginSelect(dialog: LoginDialogComponent, prompt: OAuthSelectPrompt): Promise<string | undefined> {
		return new Promise((resolve) => {
			const restoreDialog = () => {
				this.editorContainer.clear();
				this.editorContainer.addChild(dialog);
				this.ui.setFocus(dialog);
				this.ui.requestRender();
			};
			const labels = prompt.options.map((option) => option.label);
			const selector = new ExtensionSelectorComponent(
				prompt.message,
				labels,
				(optionLabel) => {
					restoreDialog();
					resolve(prompt.options.find((option) => option.label === optionLabel)?.id);
				},
				() => {
					restoreDialog();
					resolve(undefined);
				},
			);
			this.editorContainer.clear();
			this.editorContainer.addChild(selector);
			this.ui.setFocus(selector);
			this.ui.requestRender();
		});
	}

	private async showLoginDialog(providerId: string, providerName: string): Promise<void> {
		const providerInfo = this.session.modelRegistry.authStorage
			.getOAuthProviders()
			.find((provider) => provider.id === providerId);
		const previousModel = this.session.model;

		// Providers that use callback servers (can paste redirect URL)
		const usesCallbackServer = providerInfo?.usesCallbackServer ?? false;

		// Create login dialog component
		const dialog = new LoginDialogComponent(
			this.ui,
			providerId,
			(_success, _message) => {
				// Completion handled below
			},
			providerName,
		);

		// Show dialog in editor container
		this.editorContainer.clear();
		this.editorContainer.addChild(dialog);
		this.ui.setFocus(dialog);
		this.ui.requestRender();

		// Promise for manual code input (racing with callback server)
		let manualCodeResolve: ((code: string) => void) | undefined;
		let manualCodeReject: ((err: Error) => void) | undefined;
		const manualCodePromise = new Promise<string>((resolve, reject) => {
			manualCodeResolve = resolve;
			manualCodeReject = reject;
		});

		// Restore editor helper
		const restoreEditor = () => {
			this.editorContainer.clear();
			this.editorContainer.addChild(this.editor);
			this.ui.setFocus(this.editor);
			this.ui.requestRender();
		};

		try {
			await this.session.modelRegistry.authStorage.login(providerId as OAuthProviderId, {
				onAuth: (info: { url: string; instructions?: string }) => {
					dialog.showAuth(info.url, info.instructions);

					if (usesCallbackServer) {
						// Show input for manual paste, racing with callback
						dialog
							.showManualInput("Paste redirect URL below, or complete login in browser:")
							.then((value) => {
								if (value && manualCodeResolve) {
									manualCodeResolve(value);
									manualCodeResolve = undefined;
								}
							})
							.catch(() => {
								if (manualCodeReject) {
									manualCodeReject(new Error("Login cancelled"));
									manualCodeReject = undefined;
								}
							});
					}
				},

				onPrompt: async (prompt: { message: string; placeholder?: string }) => {
					return dialog.showPrompt(prompt.message, prompt.placeholder);
				},

				onProgress: (message: string) => {
					dialog.showProgress(message);
				},

				onSelect: (prompt: OAuthSelectPrompt) => this.showOAuthLoginSelect(dialog, prompt),

				onManualCodeInput: () => manualCodePromise,

				signal: dialog.signal,
			});

			// Success
			restoreEditor();
			await this.completeProviderAuthentication(providerId, providerName, "oauth", previousModel);
		} catch (error: unknown) {
			restoreEditor();
			const errorMsg = error instanceof Error ? error.message : String(error);
			if (errorMsg !== "Login cancelled") {
				this.showError(`Failed to login to ${providerName}: ${errorMsg}`);
			}
		}
	}

	// =========================================================================
	// Command handlers
	// =========================================================================

	private async handleReloadCommand(): Promise<void> {
		if (this.session.isStreaming) {
			this.showWarning("Wait for the current response to finish before reloading.");
			return;
		}
		if (this.session.isCompacting) {
			this.showWarning("Wait for compaction to finish before reloading.");
			return;
		}

		this.resetExtensionUI();

		const reloadBox = new Container();
		const borderColor = (s: string) => theme.fg("border", s);
		reloadBox.addChild(new DynamicBorder(borderColor));
		reloadBox.addChild(new Spacer(1));
		reloadBox.addChild(
			new Text(theme.fg("muted", "Reloading keybindings, extensions, skills, prompts, themes..."), 1, 0),
		);
		reloadBox.addChild(new Spacer(1));
		reloadBox.addChild(new DynamicBorder(borderColor));

		const previousEditor = this.editor;
		this.editorContainer.clear();
		this.editorContainer.addChild(reloadBox);
		this.ui.setFocus(reloadBox);
		this.ui.requestRender(true);
		await new Promise((resolve) => process.nextTick(resolve));

		const dismissReloadBox = (editor: Component) => {
			this.editorContainer.clear();
			this.editorContainer.addChild(editor);
			this.ui.setFocus(editor);
			this.ui.requestRender();
		};

		try {
			await this.session.reload();
			this.keybindings.reload();
			const activeHeader = this.customHeader ?? this.builtInHeader;
			if (isExpandable(activeHeader)) {
				activeHeader.setExpanded(this.toolOutputExpanded);
			}
			setRegisteredThemes(this.session.resourceLoader.getThemes().themes);
			this.hideThinkingBlock = this.settingsManager.getHideThinkingBlock();
			const themeName = this.settingsManager.getTheme();
			const themeResult = themeName ? setTheme(themeName, true) : { success: true };
			if (!themeResult.success) {
				this.showError(`Failed to load theme "${themeName}": ${themeResult.error}\nFell back to dark theme.`);
			}
			const editorPaddingX = this.settingsManager.getEditorPaddingX();
			const autocompleteMaxVisible = this.settingsManager.getAutocompleteMaxVisible();
			this.defaultEditor.setPaddingX(editorPaddingX);
			this.defaultEditor.setAutocompleteMaxVisible(autocompleteMaxVisible);
			if (this.editor !== this.defaultEditor) {
				this.editor.setPaddingX?.(editorPaddingX);
				this.editor.setAutocompleteMaxVisible?.(autocompleteMaxVisible);
			}
			this.ui.setShowHardwareCursor(this.settingsManager.getShowHardwareCursor());
			this.ui.setClearOnShrink(this.settingsManager.getClearOnShrink());
			this.setupAutocompleteProvider();
			const runner = this.session.extensionRunner;
			this.setupExtensionShortcuts(runner);
			this.rebuildChatFromMessages();
			dismissReloadBox(this.editor as Component);
			this.showLoadedResources({
				force: false,
				showDiagnosticsWhenQuiet: true,
			});
			const modelsJsonError = this.session.modelRegistry.getError();
			if (modelsJsonError) {
				this.showError(`models.json error: ${modelsJsonError}`);
			}
			this.showStatus("Reloaded keybindings, extensions, skills, prompts, themes");
		} catch (error) {
			dismissReloadBox(previousEditor as Component);
			this.showError(`Reload failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async handleExportCommand(text: string): Promise<void> {
		const outputPath = this.getPathCommandArgument(text, "/export");

		try {
			if (outputPath?.endsWith(".jsonl")) {
				const filePath = this.session.exportToJsonl(outputPath);
				this.showStatus(`Session exported to: ${filePath}`);
			} else {
				const filePath = await this.session.exportToHtml(outputPath);
				this.showStatus(`Session exported to: ${filePath}`);
			}
		} catch (error: unknown) {
			this.showError(`Failed to export session: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	private getPathCommandArgument(text: string, command: "/export" | "/import"): string | undefined {
		if (text === command) {
			return undefined;
		}
		if (!text.startsWith(`${command} `)) {
			return undefined;
		}

		const argsString = text.slice(command.length + 1).trimStart();
		if (!argsString) {
			return undefined;
		}

		const firstChar = argsString[0];
		if (firstChar === '"' || firstChar === "'") {
			const closingQuoteIndex = argsString.indexOf(firstChar, 1);
			if (closingQuoteIndex < 0) {
				return undefined;
			}
			return argsString.slice(1, closingQuoteIndex);
		}

		const firstWhitespaceIndex = argsString.search(/\s/);
		if (firstWhitespaceIndex < 0) {
			return argsString;
		}
		return argsString.slice(0, firstWhitespaceIndex);
	}

	private async handleImportCommand(text: string): Promise<void> {
		const inputPath = this.getPathCommandArgument(text, "/import");
		if (!inputPath) {
			this.showError("Usage: /import <path.jsonl>");
			return;
		}

		const confirmed = await this.showExtensionConfirm("Import session", `Replace current session with ${inputPath}?`);
		if (!confirmed) {
			this.showStatus("Import cancelled");
			return;
		}

		try {
			if (this.loadingAnimation) {
				this.loadingAnimation.stop();
				this.loadingAnimation = undefined;
			}
			this.statusContainer.clear();
			const result = await this.runtimeHost.importFromJsonl(inputPath);
			if (result.cancelled) {
				this.showStatus("Import cancelled");
				return;
			}
			this.renderCurrentSessionState();
			this.showStatus(`Session imported from: ${inputPath}`);
		} catch (error: unknown) {
			if (error instanceof MissingSessionCwdError) {
				const selectedCwd = await this.promptForMissingSessionCwd(error);
				if (!selectedCwd) {
					this.showStatus("Import cancelled");
					return;
				}
				const result = await this.runtimeHost.importFromJsonl(inputPath, selectedCwd);
				if (result.cancelled) {
					this.showStatus("Import cancelled");
					return;
				}
				this.renderCurrentSessionState();
				this.showStatus(`Session imported from: ${inputPath}`);
				return;
			}
			if (error instanceof SessionImportFileNotFoundError) {
				this.showError(`Failed to import session: ${error.message}`);
				return;
			}
			await this.handleFatalRuntimeError("Failed to import session", error);
		}
	}

	private async handleShareCommand(arg?: string): Promise<void> {
		const subcommand = arg?.trim().toLowerCase();
		if (subcommand === "local" || subcommand === "open") {
			await this.handleShareLocal();
			return;
		}
		if (subcommand && subcommand !== "gist") {
			this.showError(`Unknown /share argument: ${subcommand}. Try /share, /share local, or /share gist.`);
			return;
		}

		// Check if gh is available and logged in
		try {
			const authResult = spawnSync("gh", ["auth", "status"], {
				encoding: "utf-8",
			});
			if (authResult.status !== 0) {
				this.showError("GitHub CLI is not logged in. Run 'gh auth login' first.");
				return;
			}
		} catch {
			this.showError("GitHub CLI (gh) is not installed. Install it from https://cli.github.com/");
			return;
		}

		// Export to a temp file
		const tmpFile = path.join(os.tmpdir(), "session.html");
		try {
			await this.session.exportToHtml(tmpFile);
		} catch (error: unknown) {
			this.showError(`Failed to export session: ${error instanceof Error ? error.message : "Unknown error"}`);
			return;
		}

		// Show cancellable loader, replacing the editor
		const loader = new BorderedLoader(this.ui, theme, "Creating gist...");
		this.editorContainer.clear();
		this.editorContainer.addChild(loader);
		this.ui.setFocus(loader);
		this.ui.requestRender();

		const restoreEditor = () => {
			loader.dispose();
			this.editorContainer.clear();
			this.editorContainer.addChild(this.editor);
			this.ui.setFocus(this.editor);
			try {
				fs.unlinkSync(tmpFile);
			} catch {
				// Ignore cleanup errors
			}
		};

		// Create a secret gist asynchronously
		let proc: ReturnType<typeof spawn> | null = null;

		loader.onAbort = () => {
			proc?.kill();
			restoreEditor();
			this.showStatus("Share cancelled");
		};

		try {
			const result = await new Promise<{
				stdout: string;
				stderr: string;
				code: number | null;
			}>((resolve) => {
				proc = spawn("gh", ["gist", "create", "--public=false", tmpFile]);
				let stdout = "";
				let stderr = "";
				proc.stdout?.on("data", (data) => {
					stdout += data.toString();
				});
				proc.stderr?.on("data", (data) => {
					stderr += data.toString();
				});
				proc.on("close", (code) => resolve({ stdout, stderr, code }));
			});

			if (loader.signal.aborted) return;

			restoreEditor();

			if (result.code !== 0) {
				const errorMsg = result.stderr?.trim() || "Unknown error";
				this.showError(`Failed to create gist: ${errorMsg}`);
				return;
			}

			// Extract gist ID from the URL returned by gh
			// gh returns something like: https://gist.github.com/username/GIST_ID
			const gistUrl = result.stdout?.trim();
			const gistId = gistUrl?.split("/").pop();
			if (!gistId) {
				this.showError("Failed to parse gist ID from gh output");
				return;
			}

			// Create the preview URL
			const previewUrl = getShareViewerUrl(gistId);
			this.showStatus(`Share URL: ${previewUrl}\nGist: ${gistUrl}`);
		} catch (error: unknown) {
			if (!loader.signal.aborted) {
				restoreEditor();
				this.showError(`Failed to create gist: ${error instanceof Error ? error.message : "Unknown error"}`);
			}
		}
	}

	/**
	 * Local share: export the session to HTML, then hand the file off to
	 * the OS share/open mechanism. On Termux that's `termux-share`
	 * (which opens the Android share sheet), on macOS `open`, on Linux
	 * `xdg-open`, on Windows `start`.
	 *
	 * Unlike `/share` (gist), this never uploads anything: the file
	 * stays in `~/.neo-code/exports/` so the user controls what leaves
	 * the device.
	 */
	private async handleShareLocal(): Promise<void> {
		const exportsDir = path.join(getAgentDir(), "exports");
		try {
			fs.mkdirSync(exportsDir, { recursive: true });
		} catch (error) {
			this.showError(
				`Failed to prepare export directory: ${error instanceof Error ? error.message : String(error)}`,
			);
			return;
		}
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const filePath = path.join(exportsDir, `session-${stamp}.html`);

		try {
			await this.session.exportToHtml(filePath);
		} catch (error: unknown) {
			this.showError(`Failed to export session: ${error instanceof Error ? error.message : "Unknown error"}`);
			return;
		}

		const result = openLocal(filePath);
		if (result.ok) {
			this.showStatus(`Shared via ${result.resolution.label}\n${filePath}`);
			return;
		}

		// Surface a useful fallback so the user can still pick the file up
		// manually if the OS opener was missing or denied.
		const detail = result.error ? ` (${result.error})` : "";
		this.addPlainInfoBlock(
			`${theme.bold("Local share")}

${theme.fg("warning", `Could not auto-open via ${result.resolution.label}${detail}.`)}
${theme.fg("dim", "File:")} ${filePath}
${theme.fg("dim", "Hint:")} on Termux run \`pkg install termux-api\` and grant the matching Android app's storage permission.`,
		);
	}

	private async handleCopyCommand(): Promise<void> {
		const text = this.session.getLastAssistantText();
		if (!text) {
			this.showError("No agent messages to copy yet.");
			return;
		}

		try {
			await copyToClipboard(text);
			this.showStatus("Copied last agent message to clipboard");
		} catch (error) {
			this.showError(error instanceof Error ? error.message : String(error));
		}
	}

	private handleNameCommand(text: string): void {
		const name = text.replace(/^\/name\s*/, "").trim();
		if (!name) {
			const currentName = this.sessionManager.getSessionName();
			if (currentName) {
				this.chatContainer.addChild(new Spacer(1));
				this.chatContainer.addChild(new Text(theme.fg("dim", `Session name: ${currentName}`), 1, 0));
			} else {
				this.showWarning("Usage: /name <name>");
			}
			this.ui.requestRender();
			return;
		}

		this.session.setSessionName(name);
		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new Text(theme.fg("dim", `Session name set: ${name}`), 1, 0));
		this.ui.requestRender();
	}

	private handleSessionCommand(): void {
		const stats = this.session.getSessionStats();
		const sessionName = this.sessionManager.getSessionName();
		const contextUsage = stats.contextUsage;
		const cumulative = this.getCumulativeUsageForContext();
		const contextLabel = contextUsage
			? `${contextUsage.tokens?.toLocaleString() ?? "unknown"} / ${contextUsage.contextWindow.toLocaleString()} tokens (${
					contextUsage.percent !== null ? `${contextUsage.percent.toFixed(1)}%` : "?"
				})`
			: "unknown";

		let info = `${theme.bold("Session Info")}\n\n`;
		if (sessionName) {
			info += `${theme.fg("dim", "Name:")} ${sessionName}\n`;
		}
		info += `${theme.fg("dim", "File:")} ${stats.sessionFile ?? "In-memory"}\n`;
		info += `${theme.fg("dim", "ID:")} ${stats.sessionId}\n\n`;
		info += `${theme.bold("Messages in current context")}\n`;
		info += `${theme.fg("dim", "User:")} ${stats.userMessages}\n`;
		info += `${theme.fg("dim", "Assistant:")} ${stats.assistantMessages}\n`;
		info += `${theme.fg("dim", "Tool Calls:")} ${stats.toolCalls}\n`;
		info += `${theme.fg("dim", "Tool Results:")} ${stats.toolResults}\n`;
		info += `${theme.fg("dim", "Total:")} ${stats.totalMessages}\n\n`;
		info += `${theme.bold("Current Context")} ${theme.fg("dim", "(what the next request sends)")}\n`;
		info += `${theme.fg("dim", "Window:")} ${contextLabel}\n`;
		info += `${theme.fg("dim", "Source:")} latest post-compact API usage + estimated trailing messages\n\n`;
		info += `${theme.bold("Session Billing Totals")} ${theme.fg("dim", "(not reset by compaction)")}\n`;
		info += `${theme.fg("dim", "Input:")} ${cumulative.input.toLocaleString()}\n`;
		info += `${theme.fg("dim", "Output:")} ${cumulative.output.toLocaleString()}\n`;
		if (cumulative.cacheRead > 0) {
			info += `${theme.fg("dim", "Cache Read:")} ${cumulative.cacheRead.toLocaleString()}\n`;
		}
		if (cumulative.cacheWrite > 0) {
			info += `${theme.fg("dim", "Cache Write:")} ${cumulative.cacheWrite.toLocaleString()}\n`;
		}
		info += `${theme.fg("dim", "Total:")} ${cumulative.total.toLocaleString()} tokens · ${formatIdrCurrency(
			cumulative.cost,
		)}`;

		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new Text(info, 1, 0));
		this.ui.requestRender();
	}

	private handleStatusCommand(): void {
		const stats = this.session.getSessionStats();
		const model = this.session.model;
		const providerId = model?.provider;
		const providerName = providerId ? this.session.modelRegistry.getProviderDisplayName(providerId) : "Not selected";
		const authStatus = providerId ? this.session.modelRegistry.getProviderAuthStatus(providerId) : undefined;
		const authLabel = authStatus?.configured
			? authStatus.source
				? `${authStatus.source}${authStatus.label ? ` (${authStatus.label})` : ""}`
				: "configured"
			: "not configured";
		const contextUsage = stats.contextUsage;
		const contextLabel = contextUsage
			? `${contextUsage.tokens?.toLocaleString() ?? "unknown"} / ${contextUsage.contextWindow.toLocaleString()} tokens (${contextUsage.percent !== null ? `${contextUsage.percent.toFixed(1)}%` : "?"})`
			: "unknown";
		const cumulative = this.getCumulativeUsageForContext();
		const sessionName = this.sessionManager.getSessionName();

		let info = `${theme.bold("Neo Code Status")}\n\n`;
		info += `${theme.fg("dim", "Version:")} ${this.version}\n`;
		info += `${theme.fg("dim", "Workspace:")} ${this.formatCompactDisplayPath(this.sessionManager.getCwd())}\n`;
		if (sessionName) {
			info += `${theme.fg("dim", "Session:")} ${sessionName}\n`;
		}
		info += `${theme.fg("dim", "Session ID:")} ${stats.sessionId}\n\n`;
		info += `${theme.bold("Model")}\n`;
		info += `${theme.fg("dim", "Provider:")} ${providerName}\n`;
		info += `${theme.fg("dim", "Model:")} ${model ? model.name || model.id : "not selected"}\n`;
		info += `${theme.fg("dim", "Auth:")} ${authLabel}\n`;
		info += `${theme.fg("dim", "Context:")} ${contextLabel}\n\n`;
		info += `${theme.bold("Session Billing Totals")} ${theme.fg("dim", "(not reset by compaction)")}\n`;
		info += `${theme.fg("dim", "Tokens:")} ${cumulative.total.toLocaleString()} total (${cumulative.input.toLocaleString()} input, ${cumulative.output.toLocaleString()} output)\n`;
		info += `${theme.fg("dim", "Cost:")} ${formatIdrCurrency(cumulative.cost)}\n`;
		info += `${theme.fg("dim", "Billing:")} Use /usage for account billing`;

		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new Text(info, 1, 0));
		this.ui.requestRender();
	}

	private formatSessionDuration(): string {
		const ms = Date.now() - this.sessionStartTime;
		const seconds = Math.floor(ms / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h ${minutes % 60}m`;
	}

	private async handleUsageCommand(): Promise<void> {
		const cumulative = this.getCumulativeUsageForContext();
		const backendUsage = await getNeosantaraBackendUsageSnapshot();
		const accountUsage = backendUsage.snapshot;
		const backendStatus = backendUsage.detail
			? `${backendUsage.status} (${backendUsage.detail})`
			: backendUsage.status;
		const currentModel = this.session.model;
		const authStatus = this.session.modelRegistry.getProviderAuthStatus("neosantara");
		const authLabel = authStatus.configured
			? authStatus.source
				? `Neosantara (${authStatus.source}${authStatus.label ? `: ${authStatus.label}` : ""})`
				: "Neosantara (configured)"
			: "Neosantara (login required)";
		const currentModelLabel = currentModel
			? `${currentModel.name || currentModel.id}${this.getThinkingUsageSuffix(currentModel.reasoning)}`
			: "model not selected";

		const data = {
			version: this.version,
			workspace: this.formatCompactDisplayPath(this.sessionManager.getCwd()),
			account: authLabel,
			currentModel: currentModelLabel,
			billingMode: "Neosantara PAYG · IDR",
			balance: formatOptionalIdrCurrency(accountUsage?.balanceIdr),
			periodSpend: formatOptionalIdrCurrency(accountUsage?.monthlySpendIdr),
			sessionTokens: `${cumulative.total.toLocaleString()} tokens`,
			sessionCost: formatIdrCurrency(cumulative.cost),
			sessionDuration: this.formatSessionDuration(),
			backendStatus,
			updatedAt: accountUsage?.updatedAt,
		};

		let overlay: OverlayHandle | undefined;
		const component = new UsageScreenComponent(
			data,
			() => this.ui.terminal.rows,
			() => overlay?.hide(),
		);
		overlay = this.ui.showOverlay(component, {
			anchor: "top-center",
			row: 0,
			width: Math.min(74, Math.max(50, this.ui.terminal.columns - 2)),
			maxHeight: "95%",
			margin: { top: 0, left: 1, right: 1, bottom: 1 },
		});
	}

	private getThinkingUsageSuffix(modelSupportsThinking: boolean): string {
		if (!modelSupportsThinking) return "";
		const level = this.session.thinkingLevel || "off";
		return level === "off" ? "" : ` (${level[0].toUpperCase()}${level.slice(1)})`;
	}

	private formatContextUsageBar(percent: number | null | undefined): string {
		const width = 20;
		if (typeof percent !== "number" || !Number.isFinite(percent)) {
			return "[????????????????????]";
		}
		const clamped = Math.max(0, Math.min(100, percent));
		const filled = Math.round((clamped / 100) * width);
		return `[${"█".repeat(filled)}${"░".repeat(width - filled)}]`;
	}

	private getContextHealthLabel(percent: number | null | undefined): string {
		if (typeof percent !== "number" || !Number.isFinite(percent)) return theme.fg("warning", "unknown");
		if (percent >= 90) return theme.fg("error", "critical");
		if (percent >= 75) return theme.fg("warning", "high");
		return theme.fg("success", "healthy");
	}

	private formatActiveToolsForContext(): string {
		const toolNames = this.session.getActiveToolNames();
		if (toolNames.length === 0) return "none";
		const builtinOrder = ["read", "ls", "find", "grep", "bash", "edit", "write", "ExitPlanMode"];
		const sorted = [...toolNames].sort((a, b) => {
			const ai = builtinOrder.indexOf(a);
			const bi = builtinOrder.indexOf(b);
			if (ai !== -1 || bi !== -1)
				return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi);
			return a.localeCompare(b);
		});
		const visible = sorted.slice(0, 8);
		const suffix = sorted.length > visible.length ? `, +${sorted.length - visible.length} more` : "";
		return `${visible.join(", ")}${suffix}`;
	}

	private estimateTextTokens(text: string): number {
		return Math.max(0, Math.ceil(text.length / 4));
	}

	private formatTokenBreakdownLine(
		label: string,
		tokens: number | null,
		contextWindow: number | null,
		options: { symbol?: string; dim?: boolean } = {},
	): string {
		const symbol = options.symbol ?? "⛁";
		const value = tokens === null ? "unknown" : `~${tokens.toLocaleString()} tokens`;
		const percent =
			tokens !== null && typeof contextWindow === "number" && contextWindow > 0
				? ` (${((tokens / contextWindow) * 100).toFixed(1)}%)`
				: "";
		const color = options.dim ? "dim" : "muted";
		return `${theme.fg(color, symbol)} ${theme.fg("dim", label.padEnd(22))} ${value}${percent}`;
	}

	private getContextVisualizationBreakdown(options: {
		contextWindow: number | null;
		tokens: number | null;
		compactAt: number | null;
		reserveTokens: number;
	}): string {
		const systemPromptTokens = this.estimateTextTokens(this.session.systemPrompt);
		const agentsTokens = this.session.resourceLoader
			.getAgentsFiles()
			.agentsFiles.reduce((sum, file) => sum + this.estimateTextTokens(file.content), 0);
		const activeToolNames = this.session.getActiveToolNames();
		const toolSchemaTokens = activeToolNames.length > 0 ? activeToolNames.length * 180 : 0;
		const messageTokens = this.session.state.messages.reduce((sum, message) => sum + estimateTokens(message), 0);
		const freeTokens =
			typeof options.contextWindow === "number" && typeof options.tokens === "number"
				? Math.max(0, options.contextWindow - options.tokens)
				: null;
		const compactBuffer =
			typeof options.contextWindow === "number" && typeof options.compactAt === "number"
				? Math.max(0, options.contextWindow - options.compactAt)
				: options.reserveTokens;

		return [
			this.formatTokenBreakdownLine("System prompt", systemPromptTokens, options.contextWindow),
			this.formatTokenBreakdownLine("Tools / schemas", toolSchemaTokens, options.contextWindow),
			this.formatTokenBreakdownLine("AGENTS.md", agentsTokens, options.contextWindow),
			this.formatTokenBreakdownLine("Messages", messageTokens, options.contextWindow),
			this.formatTokenBreakdownLine("Autocompact buffer", compactBuffer, options.contextWindow, { symbol: "⛝" }),
			this.formatTokenBreakdownLine("Free space", freeTokens, options.contextWindow, { symbol: "⛶", dim: true }),
		].join("\n");
	}

	private getContextAgentsLines(): string[] {
		const cwd = this.sessionManager.getCwd();
		const files = this.session.resourceLoader.getAgentsFiles().agentsFiles;
		if (files.length === 0) {
			return [`${theme.fg("warning", "No AGENTS.md loaded.")} Run /init or /agents init to create one.`];
		}
		return files.map((file, index) => {
			const isLast = index === files.length - 1;
			const scope = this.getContextFileScope(file.path, cwd);
			const tokenCount = this.estimateTextTokens(file.content);
			return `${isLast ? "└─" : "├─"} ${theme.fg("muted", scope.padEnd(7))} ${this.formatCompactDisplayPath(file.path)} ${theme.fg(
				"dim",
				`~${tokenCount.toLocaleString()} tokens`,
			)}`;
		});
	}

	private getContextFileScope(filePath: string, cwd: string): "user" | "parent" | "project" {
		const agentDir = getAgentDir();
		const resolvedFile = path.resolve(filePath);
		const resolvedCwd = path.resolve(cwd);
		if (resolvedFile.startsWith(path.resolve(agentDir))) return "user";
		if (path.dirname(resolvedFile) === resolvedCwd) return "project";
		return "parent";
	}

	private getCumulativeUsageForContext(): {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
		cost: number;
	} {
		let input = 0;
		let output = 0;
		let cacheRead = 0;
		let cacheWrite = 0;
		let cost = 0;

		for (const entry of this.sessionManager.getEntries()) {
			if (entry.type === "message" && entry.message.role === "assistant") {
				const assistant = entry.message as AssistantMessage;
				input += assistant.usage.input;
				output += assistant.usage.output;
				cacheRead += assistant.usage.cacheRead;
				cacheWrite += assistant.usage.cacheWrite;
				cost += assistant.usage.cost.total;
			}
		}

		return { input, output, cacheRead, cacheWrite, total: input + output + cacheRead + cacheWrite, cost };
	}

	private getCompactionContextDetails(): {
		count: number;
		latestTokensBefore: number | undefined;
		latestAt: string | undefined;
	} {
		const compactions = this.sessionManager.getEntries().filter((entry) => entry.type === "compaction");
		const latest = compactions[compactions.length - 1];
		return {
			count: compactions.length,
			latestTokensBefore: latest?.tokensBefore,
			latestAt: latest?.timestamp,
		};
	}

	private handleContextCommand(): void {
		const stats = this.session.getSessionStats();
		const contextUsage = stats.contextUsage;
		const compaction = this.settingsManager.getCompactionSettings();
		const model = this.session.model;
		const cumulative = this.getCumulativeUsageForContext();
		const compactionDetails = this.getCompactionContextDetails();
		const contextWindow = contextUsage?.contextWindow ?? model?.contextWindow ?? null;
		const tokens = contextUsage?.tokens ?? null;
		const available =
			typeof tokens === "number" && typeof contextWindow === "number" ? Math.max(0, contextWindow - tokens) : null;
		const compactAt =
			typeof contextWindow === "number"
				? getAutoCompactTriggerTokens(contextWindow, compaction, model?.maxTokens ?? 0)
				: null;
		const reservePercent =
			typeof contextWindow === "number" && contextWindow > 0
				? (compaction.reserveTokens / contextWindow) * 100
				: null;
		const latestCompactionText =
			compactionDetails.latestTokensBefore !== undefined
				? `${compactionDetails.latestTokensBefore.toLocaleString()} tokens${
						compactionDetails.latestAt ? ` at ${new Date(compactionDetails.latestAt).toLocaleString()}` : ""
					}`
				: "none yet";
		const tokensText = typeof tokens === "number" ? tokens.toLocaleString() : "unknown";
		const contextWindowText = typeof contextWindow === "number" ? contextWindow.toLocaleString() : "unknown";
		const suggestions: string[] = [];
		if (typeof contextUsage?.percent === "number" && contextUsage.percent >= 70) {
			suggestions.push(`${theme.fg("dim", "/compact [focus]")} summarize older turns before continuing`);
		}
		if (compactionDetails.count > 0) {
			suggestions.push(`${theme.fg("dim", "/usage")} compare billing totals vs active context`);
		}
		if (suggestions.length === 0) {
			suggestions.push(`${theme.fg("dim", "/compact [focus]")} manually compact when the session feels crowded`);
		}

		let info = `${theme.bold("Context Usage")}

`;
		info += `${this.formatContextUsageBar(contextUsage?.percent)} ${tokensText}/${contextWindowText} tokens (${formatPercent(
			contextUsage?.percent,
		)}) · ${this.getContextHealthLabel(contextUsage?.percent)}
`;
		info += `${theme.fg("dim", "Shows the API view after compact boundaries, not cumulative billing history.")}

`;
		info += `${theme.bold("Current model context")}
`;
		info += `├─ ${theme.fg("dim", "Model")} ${model ? `${model.provider}/${model.name || model.id}` : "not selected"}
`;
		info += `├─ ${theme.fg("dim", "Used")} ${tokensText} tokens
`;
		info += `├─ ${theme.fg("dim", "Remaining")} ${typeof available === "number" ? available.toLocaleString() : "unknown"} tokens
`;
		info += `└─ ${theme.fg("dim", "Source")} latest API usage; post-compact may be estimated until next response

`;
		info += `${theme.bold("Estimated usage by category")}
`;
		info += `${this.getContextVisualizationBreakdown({
			contextWindow,
			tokens,
			compactAt,
			reserveTokens: compaction.reserveTokens,
		})}

`;
		info += `${theme.bold("Loaded AGENTS.md")}
`;
		info += `${this.getContextAgentsLines().join("\n")}
`;
		info += `${theme.fg("dim", "Loaded in order; later project files can narrow broader user/parent instructions.")}

`;
		info += `${theme.bold("Compaction")}
`;
		info += `├─ ${theme.fg("dim", "Auto")} ${compaction.enabled ? "enabled" : "disabled"}
`;
		info += `├─ ${theme.fg("dim", "Reserve")} ${compaction.reserveTokens.toLocaleString()} tokens (${formatPercent(reservePercent)})
`;
		info += `├─ ${theme.fg("dim", "Keep recent")} ${compaction.keepRecentTokens.toLocaleString()} tokens
`;
		info += `├─ ${theme.fg("dim", "Trigger around")} ${typeof compactAt === "number" ? compactAt.toLocaleString() : "unknown"} used tokens
`;
		info += `├─ ${theme.fg("dim", "Compactions")} ${compactionDetails.count.toLocaleString()} total
`;
		info += `└─ ${theme.fg("dim", "Latest")} ${latestCompactionText}

`;
		info += `${theme.bold("Session totals")} ${theme.fg("dim", "(billing/history; not reset by compaction)")}
`;
		info += `├─ ${theme.fg("dim", "Input")} ${cumulative.input.toLocaleString()} tokens
`;
		info += `├─ ${theme.fg("dim", "Output")} ${cumulative.output.toLocaleString()} tokens
`;
		info += `├─ ${theme.fg("dim", "Cache")} read ${cumulative.cacheRead.toLocaleString()}, write ${cumulative.cacheWrite.toLocaleString()}
`;
		info += `└─ ${theme.fg("dim", "Total")} ${cumulative.total.toLocaleString()} tokens · ${formatIdrCurrency(cumulative.cost)}

`;
		info += `${theme.bold("Active session shape")}
`;
		info += `├─ ${theme.fg("dim", "Workspace")} ${this.formatCompactDisplayPath(this.sessionManager.getCwd())}
`;
		info += `├─ ${theme.fg("dim", "Mode")} ${this.session.getAgentModeLabel()}
`;
		info += `├─ ${theme.fg("dim", "Tools")} ${this.formatActiveToolsForContext()}
`;
		info += `├─ ${theme.fg("dim", "Messages")} ${stats.totalMessages.toLocaleString()} (${stats.userMessages} user, ${stats.assistantMessages} assistant)
`;
		info += `├─ ${theme.fg("dim", "Tool activity")} ${stats.toolCalls.toLocaleString()} calls, ${stats.toolResults.toLocaleString()} results
`;
		info += `└─ ${theme.fg("dim", "Session file")} ${stats.sessionFile ? this.formatCompactDisplayPath(stats.sessionFile) : "in-memory"}

`;
		info += `${theme.bold("Suggestions")}
`;
		info += suggestions
			.map((suggestion, index) => `${index === suggestions.length - 1 ? "└─" : "├─"} ${suggestion}`)
			.join("\n");

		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new Text(info, 1, 0));
		this.ui.requestRender();
	}

	private formatDoctorLine(label: string, status: "ok" | "warn" | "fail", detail: string): string {
		const marker =
			status === "ok"
				? theme.fg("success", "✓")
				: status === "warn"
					? theme.fg("warning", "!")
					: theme.fg("error", "✗");
		return `${marker} ${theme.fg("dim", label)} ${detail}`;
	}

	private getCommandCheck(command: string, args: string[] = ["--version"]): { ok: boolean; value: string } {
		try {
			const result = spawnSync(command, args, {
				cwd: this.sessionManager.getCwd(),
				encoding: "utf8",
				stdio: "pipe",
				timeout: 2000,
			});
			if (result.error) {
				return { ok: false, value: result.error.message };
			}
			const text = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split("\n")[0]?.trim();
			return {
				ok: result.status === 0,
				value: text || `exit ${result.status ?? "unknown"}`,
			};
		} catch (error) {
			return {
				ok: false,
				value: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private handleConfigSlashCommand(_text: string): void {
		const globalSettings = this.settingsManager.getGlobalSettings();
		const projectSettings = this.settingsManager.getProjectSettings();
		const mcpServers = this.settingsManager.getMcpServers();
		const activeTools = this.session.getActiveToolNames().sort((left, right) => left.localeCompare(right));
		let info = `${theme.bold("Neo Code Config")}

`;
		info += `${theme.fg("dim", "Provider:")} ${this.settingsManager.getDefaultProvider() ?? "auto"}
`;
		info += `${theme.fg("dim", "Model:")} ${this.settingsManager.getDefaultModel() ?? "auto"}
`;
		info += `${theme.fg("dim", "Mode:")} ${this.session.getAgentModeLabel()}
`;
		info += `${theme.fg("dim", "Transport:")} ${this.settingsManager.getTransport()}
`;
		info += `${theme.fg("dim", "Theme:")} ${this.settingsManager.getTheme() ?? "default"}
`;
		info += `${theme.fg("dim", "Session dir:")} ${this.settingsManager.getSessionDir() ?? "default"}
`;
		info += `${theme.fg("dim", "Active tools:")} ${activeTools.join(", ") || "none"}
`;
		info += `${theme.fg("dim", "MCP servers:")} ${Object.keys(mcpServers).length}

`;
		info += `${theme.bold("Scopes")}
`;
		info += `├─ ${theme.fg("dim", "Global fields")} ${Object.keys(globalSettings).sort().join(", ") || "none"}
`;
		info += `└─ ${theme.fg("dim", "Project fields")} ${Object.keys(projectSettings).sort().join(", ") || "none"}

`;
		info += `${theme.fg("dim", "Tip:")} edit ~/.neo-code/settings.json or .neo-code/settings.json, then run /reload.`;
		this.addPlainInfoBlock(info);
	}

	private async handleMemoryCommand(text: string): Promise<void> {
		const args = text.slice("/memory".length).trim();
		const subcommand = args.split(/\s+/)[0] ?? "";

		if (subcommand === "" || subcommand === "list") {
			this.handleMemoryList();
			return;
		}
		if (subcommand === "search") {
			const query = args.slice("search".length).trim();
			this.handleMemorySearch(query);
			return;
		}
		if (subcommand === "add") {
			const rest = args.slice("add".length).trim();
			this.handleMemoryAdd(rest);
			return;
		}
		if (subcommand === "delete" || subcommand === "rm") {
			const id = args.slice(subcommand.length).trim();
			this.handleMemoryDelete(id);
			return;
		}
		if (subcommand === "clear") {
			this.handleMemoryClear();
			return;
		}
		if (subcommand === "prune") {
			this.handleMemoryPrune();
			return;
		}
		if (subcommand === "help") {
			this.handleMemoryHelp();
			return;
		}
		// Unknown subcommand — show help
		this.handleMemoryHelp();
	}

	private handleMemoryList(): void {
		const { loadMemoryIndex } =
			require("../../core/memories/index.js") as typeof import("../../core/memories/index.js");
		const memories = loadMemoryIndex();
		if (memories.length === 0) {
			this.addPlainInfoBlock(`${theme.bold("Memories")}

${theme.fg("muted", "No memories stored yet.")}
${theme.fg("dim", "Memories are extracted automatically from completed sessions.")}`);
			return;
		}
		let info = `${theme.bold("Memories")} ${theme.fg("dim", `(${memories.length} total)`)}\n`;
		for (const mem of memories.slice(0, 20)) {
			const date = mem.createdAt.slice(0, 10);
			const tags = mem.tags.length > 0 ? theme.fg("dim", ` [${mem.tags.join(", ")}]`) : "";
			const usage = mem.usageCount > 0 ? theme.fg("dim", ` ×${mem.usageCount}`) : "";
			info += `\n${theme.fg("dim", date)} ${mem.title}${tags}${usage}`;
			info += `\n  ${theme.fg("dim", mem.id.slice(0, 8))} ${theme.fg("muted", mem.content.slice(0, 80).replace(/\n/g, " "))}`;
		}
		if (memories.length > 20) {
			info += `\n\n${theme.fg("dim", `… and ${memories.length - 20} more. Use /memory search <query> to filter.`)}`;
		}
		info += `\n\n${theme.fg("dim", "Commands: /memory list | search <query> | delete <id> | clear | help")}`;
		this.addPlainInfoBlock(info);
	}

	private handleMemorySearch(query: string): void {
		if (!query) {
			this.showError("Usage: /memory search <query>");
			return;
		}
		const { searchMemories } =
			require("../../core/memories/index.js") as typeof import("../../core/memories/index.js");
		const results = searchMemories({ query, limit: 15 });
		if (results.length === 0) {
			this.addPlainInfoBlock(`${theme.bold("Memory Search")}

${theme.fg("muted", `No memories matching "${query}".`)}`);
			return;
		}
		let info = `${theme.bold("Memory Search")} ${theme.fg("dim", `"${query}" — ${results.length} result${results.length !== 1 ? "s" : ""}`)}\n`;
		for (const mem of results) {
			const date = mem.createdAt.slice(0, 10);
			info += `\n${theme.fg("dim", date)} ${mem.title}`;
			info += `\n  ${theme.fg("dim", mem.id.slice(0, 8))} ${theme.fg("muted", mem.content.slice(0, 100).replace(/\n/g, " "))}`;
		}
		this.addPlainInfoBlock(info);
	}

	private handleMemoryDelete(id: string): void {
		if (!id) {
			this.showError("Usage: /memory delete <id-prefix>");
			return;
		}
		const { loadMemoryIndex, deleteMemory } =
			require("../../core/memories/index.js") as typeof import("../../core/memories/index.js");
		const memories = loadMemoryIndex();
		const match = memories.find((m) => m.id.startsWith(id));
		if (!match) {
			this.showError(`No memory found with ID prefix "${id}".`);
			return;
		}
		deleteMemory(match.id);
		this.addPlainInfoBlock(`${theme.fg("success", "✓")} Deleted memory: ${match.title}`);
	}

	private handleMemoryClear(): void {
		const { loadMemoryIndex, deleteMemory } =
			require("../../core/memories/index.js") as typeof import("../../core/memories/index.js");
		const memories = loadMemoryIndex();
		if (memories.length === 0) {
			this.addPlainInfoBlock(`${theme.fg("muted", "No memories to clear.")}`);
			return;
		}
		for (const mem of memories) {
			deleteMemory(mem.id);
		}
		this.addPlainInfoBlock(`${theme.fg("success", "✓")} Cleared ${memories.length} memories.`);
	}

	private handleMemoryHelp(): void {
		this.addPlainInfoBlock(`${theme.bold("Memory Commands")}

${theme.fg("dim", "/memory")}              List all stored memories
${theme.fg("dim", "/memory list")}         Same as above
${theme.fg("dim", "/memory search")} <q>   Search memories by keyword
${theme.fg("dim", "/memory add")} <t> <c>  Add a memory manually (title | content)
${theme.fg("dim", "/memory delete")} <id>  Delete a memory by ID prefix
${theme.fg("dim", "/memory clear")}        Delete all memories
${theme.fg("dim", "/memory prune")}        Remove stale unused memories
${theme.fg("dim", "/memory help")}         Show this help

Memories are automatically extracted from completed sessions and injected
into future sessions that work in the same workspace.

${theme.fg("dim", "Settings:")} memories.enabled, memories.autoExtract, memories.maxStored
${theme.fg("dim", "Storage:")} ~/.neo-code/memories/`);
	}

	private handleMemoryAdd(input: string): void {
		if (!input) {
			this.showError("Usage: /memory add title | content");
			return;
		}
		const { addMemory, redactSecrets, enforceMaxStored } =
			require("../../core/memories/index.js") as typeof import("../../core/memories/index.js");

		// Parse: title | content
		let title: string;
		let content: string;

		const pipeIdx = input.indexOf("|");
		if (pipeIdx !== -1) {
			title = input.slice(0, pipeIdx).trim();
			content = input.slice(pipeIdx + 1).trim();
		} else {
			// Single string = title, content same as title
			title = input.slice(0, 80);
			content = input;
		}

		if (!title || !content) {
			this.showError("Usage: /memory add title | content");
			return;
		}

		const memSettings = this.settingsManager.getMemorySettings();
		const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
		addMemory({
			id,
			createdAt: new Date().toISOString(),
			workspace: this.sessionManager.getCwd(),
			title: title.slice(0, 120),
			content: redactSecrets(content.slice(0, 2000)),
			tags: ["manual"],
			usageCount: 0,
			lastUsedAt: null,
			sourceSessionId: null,
		});
		enforceMaxStored(memSettings.maxStored);
		this.addPlainInfoBlock(`${theme.fg("success", "✓")} Added memory: ${title}`);
	}

	private handleMemoryPrune(): void {
		const { pruneStaleMemories, enforceMaxStored } =
			require("../../core/memories/index.js") as typeof import("../../core/memories/index.js");
		const memSettings = this.settingsManager.getMemorySettings();
		const stalePruned = pruneStaleMemories(memSettings.pruneAfterDays);
		const overflowPruned = enforceMaxStored(memSettings.maxStored);
		const total = stalePruned + overflowPruned;
		if (total === 0) {
			this.addPlainInfoBlock(`${theme.fg("muted", "No memories to prune. All are within limits.")}`);
		} else {
			this.addPlainInfoBlock(
				`${theme.fg("success", "✓")} Pruned ${total} memories (${stalePruned} stale, ${overflowPruned} over limit).`,
			);
		}
	}

	private handleMcpCommand(): void {
		const servers = this.settingsManager.getMcpServers();
		const entries = Object.entries(servers).sort(([left], [right]) => left.localeCompare(right));
		let info = `${theme.bold("MCP Servers")}
`;
		info += `${theme.fg("dim", "Config key:")} mcpServers
`;
		info += `${theme.fg("dim", "Tool:")} use the built-in mcp tool to list/call server tools
`;
		if (entries.length === 0) {
			info += `
${theme.fg("muted", "No MCP servers configured.")}
`;
			info += `${theme.fg("dim", "Example:")}
`;
			info += `"mcpServers": { "local": { "command": "node", "args": ["server.js"] } }`;
			this.addPlainInfoBlock(info);
			return;
		}
		for (const [name, config] of entries) {
			info += `
${theme.bold(name)}
`;
			info += `  ${theme.fg("dim", "command:")} ${config.command}${config.args?.length ? ` ${config.args.join(" ")}` : ""}
`;
			info += `  ${theme.fg("dim", "env:")} ${config.env ? Object.keys(config.env).sort().join(", ") : "none"}`;
		}
		this.addPlainInfoBlock(info);
	}

	private handleTodoCommand(): void {
		const todoPath = path.join(this.sessionManager.getCwd(), ".neo-code", "todos.json");
		if (!fs.existsSync(todoPath)) {
			this.addPlainInfoBlock(`${theme.bold("Todo Plan")}

${theme.fg("muted", "No todo plan stored yet.")}
${theme.fg("dim", "The agent can use the todo tool during multi-step work.")}`);
			return;
		}
		try {
			const raw = fs.readFileSync(todoPath, "utf8");
			const parsed = JSON.parse(raw) as {
				note?: string;
				items?: Array<{ id: string; content: string; status: string }>;
			};
			let info = `${theme.bold("Todo Plan")}
${theme.fg("dim", todoPath)}
`;
			if (parsed.note)
				info += `
${theme.fg("dim", "Note:")} ${parsed.note}
`;
			if (!parsed.items?.length) {
				info += `
${theme.fg("muted", "No todo items recorded.")}`;
			} else {
				for (const item of parsed.items) {
					const marker = item.status === "completed" ? "✓" : item.status === "in_progress" ? "→" : "•";
					info += `
${marker} ${theme.fg("dim", item.id)} ${item.content}`;
				}
			}
			this.addPlainInfoBlock(info);
		} catch (error) {
			this.showError(error instanceof Error ? error.message : String(error));
		}
	}

	private handleTermuxKeysCommand(text: string): void {
		const args = text.slice("/termux-keys".length).trim().split(/\s+/).filter(Boolean);
		const action = args[0]?.toLowerCase() ?? "status";
		if (action === "apply" || action === "install") {
			const result = applyNeoTermuxTouchKeyboard();
			let info = `${theme.bold("Termux touch keyboard")}

`;
			info += `${theme.fg("success", "✓ Applied Neo Code extra keys")}
`;
			info += `├─ ${theme.fg("dim", "File")} ${result.propertiesPath}
`;
			info += `├─ ${theme.fg("dim", "Backup")} ${result.backupPath ?? "none; file did not exist"}
`;
			info += `├─ ${theme.fg("dim", "Reload")} ${result.reloadAttempted ? (result.reloadOk ? "termux-reload-settings ok" : `termux-reload-settings failed: ${result.reloadMessage ?? "unknown"}`) : "termux-reload-settings not found; restart Termux to apply"}
`;
			info += `└─ ${theme.fg("dim", "Layout")} ${NEO_TERMUX_EXTRA_KEYS}

`;
			info += `${theme.fg("muted", "Tip: tap CTRL then B/O/C/D on the touch keyboard to use Neo shortcuts like background, expand tools, clear, and exit.")}`;
			this.addPlainInfoBlock(info);
			return;
		}

		if (action === "show" || action === "preview") {
			this.addPlainInfoBlock(
				`${theme.bold("Neo Code Termux extra keys")}

extra-keys = ${NEO_TERMUX_EXTRA_KEYS}

${theme.fg("dim", "Apply with /termux-keys apply. Neo will back up ~/.termux/termux.properties first.")}`,
			);
			return;
		}

		if (action === "restore") {
			const restored = restoreLatestTermuxTouchKeyboardBackup();
			if (!restored) {
				this.showWarning("No Neo Termux keyboard backup found.");
				return;
			}
			this.addPlainInfoBlock(
				`${theme.bold("Termux touch keyboard")}

${theme.fg("success", "✓ Restored latest backup")}
└─ ${restored}`,
			);
			return;
		}

		const status = getTermuxTouchKeyboardStatus();
		const latestBackup = findLatestTermuxPropertiesBackup();
		let info = `${theme.bold("Termux touch keyboard")}

`;
		info += `${this.formatDoctorLine("Termux:", status.isTermux ? "ok" : "warn", status.isTermux ? "detected" : "not detected; this command is intended for Termux")}
`;
		info += `${this.formatDoctorLine("Config:", status.exists ? "ok" : "warn", status.exists ? status.propertiesPath : `${status.propertiesPath} will be created`)}
`;
		info += `${this.formatDoctorLine("extra-keys:", status.hasExtraKeys ? "ok" : "warn", status.hasExtraKeys ? (status.usesNeoLayout ? "Neo layout active" : "custom layout present") : "not configured")}
`;
		info += `${this.formatDoctorLine("Reload:", status.reloadCommandAvailable ? "ok" : "warn", status.reloadCommandAvailable ? "termux-reload-settings available" : "restart Termux after applying")}
`;
		info += `${this.formatDoctorLine("Backup:", latestBackup ? "ok" : "warn", latestBackup ?? "none yet")}

`;
		info += `${theme.bold("Recommended layout")}
`;
		info += `extra-keys = ${NEO_TERMUX_EXTRA_KEYS}

`;
		info += `${theme.bold("Commands")}
`;
		info += `├─ /termux-keys show      preview layout
`;
		info += `├─ /termux-keys apply     write config, backup first, reload if possible
`;
		info += `└─ /termux-keys restore   restore latest Neo backup

`;
		info += `${theme.fg("dim", "Why this layout: ESC/TAB/CTRL/ALT for terminal shortcuts, arrows/Home/End/Page keys for editing, and / - ~ | for common CLI input.")}`;
		this.addPlainInfoBlock(info);
	}

	private async handleLspCommand(text: string): Promise<void> {
		const args = text.slice("/lsp".length).trim().split(/\s+/).filter(Boolean);
		const action = args[0]?.toLowerCase() ?? "status";
		const cwd = this.sessionManager.getCwd();
		const manager = getLspManager(cwd);

		if (action === "status" || action === "list") {
			const status = manager.getStatus();
			let info = `${theme.bold("LSP servers")}

`;
			info += `${theme.fg("dim", "Workspace:")} ${status.workspaceRoot}

`;
			for (const entry of status.servers) {
				const marker = entry.installed
					? entry.started
						? theme.fg("success", "●")
						: theme.fg("success", "○")
					: theme.fg("dim", "○");
				const label = entry.installed ? (entry.started ? "running" : "installed") : "not installed";
				const path = entry.resolvedPath ? ` ${theme.fg("dim", `(${entry.resolvedPath})`)}` : "";
				info += `${marker} ${entry.config.id} ${theme.fg("dim", `[${entry.config.languages.join(", ")}]`)} — ${label}${path}\n`;
			}
			info += `\n${theme.bold("Commands")}\n`;
			info += `├─ /lsp status            list installed/running servers\n`;
			info += `├─ /lsp init              eagerly start an installed server\n`;
			info += `├─ /lsp logs <server>     show recent server logs\n`;
			info += `├─ /lsp restart <server>  restart a running server\n`;
			info += `└─ /lsp stop              stop all running servers\n\n`;
			info += `${theme.fg("dim", "Tip: install the server you need, then run /lsp init <id> or just call the lsp tool. Examples: typescript-language-server, pyright, rust-analyzer, gopls, clangd, jdtls, solargraph.")}`;
			this.addPlainInfoBlock(info);
			return;
		}

		if (action === "init" || action === "start") {
			const target = args[1]?.toLowerCase();
			const installed = manager.listServerAvailability().filter((entry) => entry.installed);
			if (installed.length === 0) {
				this.showWarning("No LSP binaries detected on PATH. Install one and rerun /lsp init.");
				return;
			}
			const targets = target ? installed.filter((entry) => entry.config.id === target) : installed;
			if (targets.length === 0) {
				this.showWarning(`LSP server "${target}" is not installed. Run /lsp status to see available servers.`);
				return;
			}
			const results: string[] = [];
			for (const entry of targets) {
				const client = await manager.getClient(entry.config.id);
				results.push(
					`${client ? theme.fg("success", "✓") : theme.fg("error", "✗")} ${entry.config.id} ${client ? "started" : "failed to start (see /lsp logs)"}`,
				);
			}
			this.addPlainInfoBlock(`${theme.bold("LSP init")}\n\n${results.join("\n")}`);
			return;
		}

		if (action === "logs" || action === "log") {
			const target = args[1]?.toLowerCase();
			if (!target) {
				this.showWarning("Usage: /lsp logs <server-id> (e.g., /lsp logs typescript-language-server)");
				return;
			}
			const logs = manager.getLogs(target);
			if (logs.length === 0) {
				this.addPlainInfoBlock(
					`${theme.bold(`LSP logs · ${target}`)}\n\n${theme.fg("dim", "No log entries yet.")}`,
				);
				return;
			}
			const tail = logs.slice(-50).join("\n");
			this.addPlainInfoBlock(`${theme.bold(`LSP logs · ${target}`)}\n\n${tail}`);
			return;
		}

		if (action === "restart") {
			const target = args[1]?.toLowerCase();
			if (!target) {
				this.showWarning("Usage: /lsp restart <server-id>");
				return;
			}
			const ok = await manager.restart(target);
			this.addPlainInfoBlock(
				`${theme.bold("LSP restart")}\n\n${ok ? theme.fg("success", `✓ ${target} restarted`) : theme.fg("error", `✗ ${target} failed to restart (see /lsp logs ${target})`)}`,
			);
			return;
		}

		if (action === "stop" || action === "shutdown") {
			await manager.shutdown();
			this.addPlainInfoBlock(
				`${theme.bold("LSP shutdown")}\n\n${theme.fg("success", "✓ Stopped all LSP servers.")}`,
			);
			return;
		}

		this.showWarning(`Unknown /lsp subcommand "${action}". Try /lsp status.`);
	}

	private handleTermuxStatusCommand(): void {
		const snapshot = getTermuxStatusSnapshot();
		const keyboardStatus = getTermuxTouchKeyboardStatus();
		const tools = listTermuxApiTools();

		let info = `${theme.bold("Termux environment")}

`;
		info += `${this.formatDoctorLine("Termux app:", snapshot.isTermux ? "ok" : "warn", snapshot.isTermux ? `detected${snapshot.termuxVersion ? ` (TERMUX_VERSION=${snapshot.termuxVersion})` : ""}` : "not detected; this command is intended for Termux on Android")}
`;
		info += `${this.formatDoctorLine("Termux:API package:", snapshot.capabilities.available ? "ok" : "warn", snapshot.capabilities.available ? `installed (${snapshot.availableCount}/${snapshot.totalCount} tools)` : "missing — install with: pkg install termux-api")}
`;
		info += `${this.formatDoctorLine("PREFIX:", snapshot.prefix ? "ok" : "warn", snapshot.prefix ?? "not set")}

`;

		info += `${theme.bold("Touch keyboard")}
`;
		info += `${this.formatDoctorLine("~/.termux/termux.properties:", keyboardStatus.usesNeoLayout ? "ok" : keyboardStatus.exists ? "warn" : "warn", keyboardStatus.usesNeoLayout ? "Neo layout active" : keyboardStatus.exists ? "custom layout present; /termux-keys apply installs Neo layout" : "not configured; /termux-keys apply on Termux")}
`;
		info += `${this.formatDoctorLine("termux-reload-settings:", keyboardStatus.reloadCommandAvailable ? "ok" : "warn", keyboardStatus.reloadCommandAvailable ? "available" : "not found; restart Termux after applying")}

`;

		info += `${theme.bold("Clipboard")}
`;
		info += `${this.formatDoctorLine("text get:", snapshot.capabilities.clipboardGet ? "ok" : "warn", snapshot.capabilities.clipboardGet ? "termux-clipboard-get ok" : "termux-clipboard-get missing")}
`;
		info += `${this.formatDoctorLine("text set:", snapshot.capabilities.clipboardSet ? "ok" : "warn", snapshot.capabilities.clipboardSet ? "termux-clipboard-set ok" : "termux-clipboard-set missing")}
`;
		info += `${this.formatDoctorLine("image:", "warn", "not available on Termux (text-only clipboard)")}

`;

		info += `${theme.bold("Notifications")}
`;
		info += `${this.formatDoctorLine("termux-notification:", snapshot.capabilities.notification ? "ok" : "warn", snapshot.capabilities.notification ? "ok" : "missing")}
`;
		info += `${this.formatDoctorLine("termux-vibrate:", snapshot.capabilities.vibrate ? "ok" : "warn", snapshot.capabilities.vibrate ? "ok" : "missing")}
`;
		info += `${this.formatDoctorLine("termux-toast:", snapshot.capabilities.toast ? "ok" : "warn", snapshot.capabilities.toast ? "ok" : "missing")}

`;

		info += `${theme.bold("Sharing")}
`;
		info += `${this.formatDoctorLine("termux-share:", snapshot.capabilities.share ? "ok" : "warn", snapshot.capabilities.share ? "ok" : "missing")}

`;

		info += `${theme.bold("Tool catalog")}
`;
		for (let i = 0; i < tools.length; i++) {
			const [id, command] = tools[i]!;
			const branch = i === tools.length - 1 ? "└─" : "├─";
			const ok = snapshot.capabilities[id];
			const marker = ok ? theme.fg("success", "ok  ") : theme.fg("warning", "miss");
			info += `${branch} ${marker} ${theme.fg("dim", command)}
`;
		}

		if (!snapshot.capabilities.available) {
			info += `
${theme.fg("dim", "Tip: install Termux:API with `pkg install termux-api`, then install the matching Termux:API Android app from F-Droid.")}`;
		} else {
			info += `
${theme.fg("dim", "Tip: enable opt-in completion notifications via /settings (notifications.termux.enabled).")}`;
		}

		this.addPlainInfoBlock(info);
	}

	private handleDoctorCommand(): void {
		const stats = this.session.getSessionStats();
		const model = this.session.model;
		const providerId = model?.provider;
		const authStatus = providerId ? this.session.modelRegistry.getProviderAuthStatus(providerId) : undefined;
		const extensionErrors = this.session.resourceLoader.getExtensions().errors.map((error) => ({
			type: "error" as const,
			message: error.error,
			path: error.path,
		}));
		const resourceDiagnostics = [
			...this.runtimeHost.diagnostics,
			...extensionErrors,
			...this.session.resourceLoader.getSkills().diagnostics,
			...this.session.resourceLoader.getPrompts().diagnostics,
			...this.session.resourceLoader.getThemes().diagnostics,
		];
		const resourceErrors = resourceDiagnostics.filter((diagnostic) => diagnostic.type === "error");
		const resourceWarnings = resourceDiagnostics.filter(
			(diagnostic) => diagnostic.type === "warning" || diagnostic.type === "collision",
		);
		const git = this.getCommandCheck("git");
		const rgPath = getToolPath("rg");
		const fdPath = getToolPath("fd");
		const memory = process.memoryUsage();
		const termuxKeyboard = getTermuxTouchKeyboardStatus();
		const termuxApiCaps = getTermuxApiCapabilities();
		const lspStatus = getLspManager(this.sessionManager.getCwd()).getStatus();
		const installedLsps = lspStatus.servers.filter((entry) => entry.installed);
		const runningLsps = lspStatus.servers.filter((entry) => entry.started);
		const lspStatusLines: DoctorLine[] = [
			{
				label: "Servers",
				status: installedLsps.length > 0 ? "ok" : "warn",
				detail:
					installedLsps.length > 0
						? `${installedLsps.length} installed: ${installedLsps.map((entry) => entry.config.id).join(", ")}`
						: "no LSP binaries on PATH; lsp tool will return install hints",
			},
			{
				label: "Running",
				status: "ok",
				detail:
					runningLsps.length > 0
						? runningLsps.map((entry) => entry.config.id).join(", ")
						: "none active (lazy-spawn on first lsp tool call)",
			},
		];

		const sections: DoctorSection[] = [
			{
				title: "Runtime",
				lines: [
					{ label: "Node", status: "ok", detail: process.version },
					{ label: "Platform", status: "ok", detail: `${process.platform}/${process.arch}` },
					{
						label: "Workspace",
						status: fs.existsSync(this.sessionManager.getCwd()) ? "ok" : "fail",
						detail: this.sessionManager.getCwd(),
					},
					{
						label: "Agent dir",
						status: fs.existsSync(getAgentDir()) ? "ok" : "warn",
						detail: getAgentDir(),
					},
					{
						label: "Session file",
						status: stats.sessionFile ? "ok" : "warn",
						detail: stats.sessionFile ?? "in-memory session",
					},
				],
			},
			{
				title: "Provider",
				lines: [
					{
						label: "Model",
						status: model ? "ok" : "fail",
						detail: model ? `${model.provider}/${model.name || model.id}` : "not selected",
					},
					{
						label: "Auth",
						status: authStatus?.configured ? "ok" : "warn",
						detail: authStatus?.configured ? authStatus.source || "configured" : "not configured",
					},
				],
			},
			{
				title: "Local tools",
				lines: [
					{ label: "git", status: git.ok ? "ok" : "warn", detail: git.value },
					{
						label: "rg",
						status: rgPath ? "ok" : "warn",
						detail: rgPath ?? "not found; grep/search tool may be slower or unavailable",
					},
					{
						label: "fd",
						status: fdPath ? "ok" : "warn",
						detail: fdPath ?? "not found; file autocomplete may be degraded",
					},
				],
			},
			{
				title: "Termux",
				lines: [
					{
						label: "Environment",
						status: termuxKeyboard.isTermux ? "ok" : "warn",
						detail: termuxKeyboard.isTermux ? "detected" : "not detected",
					},
					{
						label: "Touch keys",
						status: termuxKeyboard.usesNeoLayout ? "ok" : "warn",
						detail: termuxKeyboard.usesNeoLayout
							? "Neo layout active"
							: termuxKeyboard.hasExtraKeys
								? "custom layout present; /termux-keys apply can install Neo layout"
								: "not configured; use /termux-keys apply on Termux",
					},
					{
						label: "Termux:API",
						status: termuxApiCaps.available ? "ok" : "warn",
						detail: `${summarizeTermuxApiCapabilities(termuxApiCaps)} — see /termux-status`,
					},
				],
			},
			{
				title: "Resources",
				lines: [
					{
						label: "Loader",
						status: resourceErrors.length > 0 ? "fail" : resourceWarnings.length > 0 ? "warn" : "ok",
						detail: `${resourceErrors.length} errors, ${resourceWarnings.length} warnings`,
					},
				],
			},
			{
				title: "Code intelligence",
				lines: lspStatusLines,
			},
			{
				title: "Session",
				lines: [
					{
						label: "Context",
						status: stats.contextUsage?.percent && stats.contextUsage.percent >= 90 ? "warn" : "ok",
						detail: formatPercent(stats.contextUsage?.percent),
					},
					{
						label: "Memory RSS",
						status: memory.rss > 1024 * 1024 * 1024 ? "warn" : "ok",
						detail: formatBytes(memory.rss),
					},
				],
			},
		];

		let totalErrors = 0;
		let totalWarnings = 0;
		for (const section of sections) {
			for (const line of section.lines) {
				if (line.status === "fail") totalErrors += 1;
				else if (line.status === "warn") totalWarnings += 1;
			}
		}

		const data: DoctorScreenData = {
			version: this.version,
			sections,
			summary: { errors: totalErrors, warnings: totalWarnings },
			resourceDiagnostics: [...resourceErrors, ...resourceWarnings].map(
				(diagnostic): DoctorDiagnostic => ({
					type: diagnostic.type === "error" ? "error" : diagnostic.type === "collision" ? "collision" : "warning",
					message: diagnostic.message,
					path: "path" in diagnostic ? diagnostic.path : undefined,
				}),
			),
			tip: "Use /status for account/model summary and /context for context details.",
		};

		let overlay: OverlayHandle | undefined;
		const component = new DoctorScreenComponent(
			data,
			() => this.ui.terminal.rows,
			() => overlay?.hide(),
		);
		overlay = this.ui.showOverlay(component, {
			anchor: "top-center",
			row: 0,
			width: Math.min(80, Math.max(50, this.ui.terminal.columns - 2)),
			maxHeight: "95%",
			margin: { top: 0, left: 1, right: 1, bottom: 1 },
		});
	}

	private addPlainInfoBlock(info: string): void {
		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new Text(info, 1, 0));
		this.ui.requestRender();
	}

	private normalizeToolNames(rawNames: string[]): string[] {
		return rawNames
			.flatMap((name) => name.split(","))
			.map((name) => name.trim())
			.filter((name) => name.length > 0);
	}

	private padVisible(text: string, width: number): string {
		return text + " ".repeat(Math.max(0, width - visibleWidth(text)));
	}

	private agentModeColor(mode: AgentWorkMode): "accent" | "success" | "warning" | "error" | "muted" {
		switch (mode) {
			case "ask":
				return "accent";
			case "read-only":
				return "success";
			case "plan":
				return "warning";
			case "accept-edits":
				return "success";
			case "full":
				return "error";
			case "default":
				return "muted";
		}
	}

	private formatAgentModeCard(mode: AgentWorkMode, notice?: string): string {
		const color = this.agentModeColor(mode);
		const config = AGENT_WORK_MODE_CONFIG[mode];
		const width = 68;
		const innerWidth = width - 4;
		const title = " Neo Code Mode ";
		const top = theme.fg(color, `╭─${title}${"─".repeat(Math.max(0, width - visibleWidth(`╭─${title}`) - 1))}╮`);
		const bottom = theme.fg(color, `╰${"─".repeat(width - 2)}╯`);
		const line = (content: string) =>
			`${theme.fg(color, "│")} ${this.padVisible(truncateToWidth(content, innerWidth, "…"), innerWidth)} ${theme.fg(color, "│")}`;
		const modeTitle = theme.bold(theme.fg(color, `${config.symbol} ${config.label.toUpperCase()} MODE`));
		const lines = [top];
		if (notice) {
			lines.push(line(theme.fg("muted", notice)));
			lines.push(line(""));
		}
		lines.push(line(modeTitle));
		lines.push(line(theme.fg("dim", getAgentWorkModeFooterDetail(mode))));
		lines.push(line(`Tools: ${getAgentWorkModeToolSummary(mode)}`));
		lines.push(bottom);
		return lines.join("\n");
	}

	private formatAgentModeInfo(notice?: string): string {
		const activeMode = this.session.agentMode;
		let info = this.formatAgentModeCard(activeMode, notice);
		info += `\n\n${theme.bold("Modes")}`;
		for (const mode of AGENT_WORK_MODES) {
			const selected = mode === activeMode;
			const config = AGENT_WORK_MODE_CONFIG[mode];
			const marker = selected ? theme.fg(this.agentModeColor(mode), "●") : theme.fg("muted", "○");
			const label = selected
				? theme.bold(theme.fg(this.agentModeColor(mode), `${config.symbol} ${mode}`))
				: `${config.symbol} ${mode}`;
			info += `\n${marker} ${this.padVisible(label, 20)} ${theme.fg("dim", config.footerDetail)} ${theme.fg("muted", `— ${config.description}`)}`;
		}
		info += `\n\n${theme.fg("dim", "Usage:")} /mode <${formatAgentWorkModeList()}>`;
		info += `\n${theme.fg("dim", "Cycle:")} ${this.getAppKeyDisplay("app.mode.cycle")} cycles ${formatAgentWorkModeCycleList()}`;
		info += `\n${theme.fg("dim", "Shortcuts:")} /ask · /plan · /read-only · /default · /accept-edits`;
		info += `\n${theme.fg("dim", "Claude-style aliases:")} /agent = /default · --permission-mode plan`;
		info += `\n${theme.fg("dim", "Approval flow:")} read/search/list auto-run inside workspace · default asks before bash/edit/write/extension tools · accept-edits auto-allows file edits · full bypasses prompts`;
		return info;
	}

	private applyAgentMode(mode: AgentWorkMode): void {
		this.session.setAgentMode(mode);
		this.footer.invalidate();
	}

	private async sendPromptFromModeCommand(prompt: string, originalText: string): Promise<void> {
		if (!prompt) return;
		this.editor.addToHistory?.(originalText);
		await this.session.prompt(
			prompt,
			this.session.isStreaming ? { streamingBehavior: "followUp" as const } : undefined,
		);
	}

	private async handleModeCommand(text: string): Promise<void> {
		const args = text.slice("/mode".length).trim().split(/\s+/).filter(Boolean);
		if (args.length === 0) {
			this.addPlainInfoBlock(this.formatAgentModeInfo());
			return;
		}

		const rawMode = args[0];
		const mode = parseAgentWorkMode(rawMode);
		if (!mode) {
			this.addPlainInfoBlock(
				this.formatAgentModeInfo(`Unknown mode: ${rawMode}. Valid modes: ${formatAgentWorkModeList()}.`),
			);
			return;
		}

		this.applyAgentMode(mode);
		const prompt = args.slice(1).join(" ").trim();
		if (prompt) {
			await this.sendPromptFromModeCommand(prompt, text);
			return;
		}
		this.addPlainInfoBlock(this.formatAgentModeInfo(`Switched to ${getAgentWorkModeLabel(mode)} mode.`));
		this.ui.requestRender();
	}

	private async handleModeShortcutCommand(mode: AgentWorkMode, prompt: string, originalText: string): Promise<void> {
		this.applyAgentMode(mode);
		if (prompt) {
			await this.sendPromptFromModeCommand(prompt, originalText);
			return;
		}
		this.addPlainInfoBlock(this.formatAgentModeInfo(`Switched to ${getAgentWorkModeLabel(mode)} mode.`));
		this.ui.requestRender();
	}

	private getToolPermissionPresetTools(preset: ToolPermissionPreset): string[] {
		const allNames = new Set(this.session.getAllTools().map((tool) => tool.name));
		const keep = (names: string[]): string[] => names.filter((name) => allNames.has(name));
		switch (preset) {
			case "default":
				return keep(["read", "bash", "edit", "write"]);
			case "read-only":
				return keep(["read", "grep", "find", "ls"]);
			case "full":
				return [...allNames].sort((a, b) => a.localeCompare(b));
			case "no-tools":
				return [];
		}
	}

	private formatToolSource(source: string | undefined, scope: string | undefined): string {
		if (!source && !scope) return "unknown";
		if (!scope) return source ?? "unknown";
		if (!source) return scope;
		return `${source}/${scope}`;
	}

	private handleBackgroundCurrentTask(): void {
		const task = this.session.backgroundCurrentShellTask();
		if (!task) {
			this.showWarning("No foreground shell task is running. Ctrl+B only backgrounds the current bash command.");
			return;
		}
		this.footer.invalidate();
		this.showStatus(`Backgrounded ${task.id}. Use /tasks to view or /tasks stop ${task.id} to kill it.`);
		this.ui.requestRender();
	}

	private handleTasksCommand(text: string): void {
		const args = text.slice("/tasks".length).trim().split(/\s+/).filter(Boolean);
		const action = args[0]?.toLowerCase();
		const taskId = args[1];
		if (action === "stop" || action === "kill") {
			if (!taskId) {
				this.showError("Usage: /tasks stop <task-id>");
				return;
			}
			const task = this.session.stopBackgroundTask(taskId);
			if (!task) {
				this.showError(`Background task not found: ${taskId}`);
				return;
			}
			this.footer.invalidate();
			this.showStatus(`Stopped ${task.id}`);
			this.showBackgroundTaskDetail(task.id, { title: "Stopped background task" });
			return;
		}

		if (action === "show" || action === "tail" || action === "view") {
			const id = taskId ?? args[0];
			if (!id || id === action) {
				this.showError("Usage: /tasks show <task-id>");
				return;
			}
			this.showBackgroundTaskDetail(id, { title: "Background task detail" });
			return;
		}

		this.showBackgroundTaskList();
	}

	private showBackgroundTaskList(): void {
		const tasks = this.session.getBackgroundTasks();
		this.chatContainer.addChild(new Spacer(1));
		if (tasks.length === 0) {
			this.chatContainer.addChild(new Text(theme.fg("muted", "Background tasks\n  └─ none"), 1, 0));
			this.ui.requestRender();
			return;
		}

		const rows = [theme.fg("accent", theme.bold("Background tasks"))];
		for (const task of tasks) {
			const color =
				task.status === "running"
					? "warning"
					: task.status === "completed"
						? "success"
						: task.status === "failed" || task.status === "killed"
							? "error"
							: "muted";
			rows.push(
				`  ● ${theme.fg(color, task.id)} ${theme.fg("muted", this.session.formatBackgroundTaskSummary(task).replace(/^\S+\s+/, ""))}`,
			);
		}
		rows.push(theme.fg("dim", "  Enter commands: /tasks show <id> · /tasks stop <id>"));
		this.chatContainer.addChild(new Text(rows.join("\n"), 1, 0));
		this.ui.requestRender();
	}

	private showBackgroundTaskDetail(taskId: string, options: { title: string }): void {
		const task = this.session
			.getBackgroundTasks({ includeForeground: true })
			.find((candidate) => candidate.id === taskId);
		if (!task) {
			this.showError(`Background task not found: ${taskId}`);
			return;
		}
		const tail = this.session.readBackgroundTaskOutputTail(task.id, 60) || "(no output)";
		const elapsed = ((task.endedAt ?? Date.now()) - task.startedAt) / 1000;
		const rows = [
			theme.fg("accent", theme.bold(options.title)),
			`  ├─ id: ${task.id}`,
			`  ├─ status: ${task.status}`,
			`  ├─ runtime: ${elapsed.toFixed(1)}s`,
			typeof task.exitCode === "number" ? `  ├─ exit: ${task.exitCode}` : undefined,
			`  ├─ cwd: ${task.cwd}`,
			`  ├─ log: ${task.outputPath}`,
			`  ├─ command: ${task.command}`,
			`  └─ output tail`,
			...tail
				.split("\n")
				.slice(-60)
				.map((line) => theme.fg("toolOutput", `     ${line}`)),
		].filter((line): line is string => Boolean(line));
		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new Text(rows.join("\n"), 1, 0));
		this.ui.requestRender();
	}

	private handlePermissionsCommand(text: string): void {
		const args = text.slice("/permissions".length).trim().split(/\s+/).filter(Boolean);
		const activeBefore = new Set(this.session.getActiveToolNames());
		const allTools = this.session.getAllTools().sort((a, b) => a.name.localeCompare(b.name));
		const allNames = new Set(allTools.map((tool) => tool.name));
		let notice: string | undefined;

		if (args.length > 0) {
			const action = args[0]?.toLowerCase();
			if (action === "default" || action === "read-only" || action === "full" || action === "no-tools") {
				const preset = action as ToolPermissionPreset;
				this.session.setActiveToolsByName(this.getToolPermissionPresetTools(preset));
				notice = `Applied preset: ${preset}. Changes affect the next agent turn.`;
			} else if (action === "reset" || action === "clear") {
				this.session.clearToolApprovalRules();
				notice = "Cleared session approval allow/deny rules.";
			} else if (action === "allow" || action === "enable" || action === "add") {
				const requested = this.normalizeToolNames(args.slice(1));
				const unknown = requested.filter((name) => !allNames.has(name));
				const next = new Set(activeBefore);
				for (const name of requested) {
					if (allNames.has(name)) next.add(name);
				}
				this.session.setActiveToolsByName([...next]);
				notice = `Enabled: ${requested.filter((name) => allNames.has(name)).join(", ") || "none"}.${unknown.length ? ` Unknown: ${unknown.join(", ")}.` : ""}`;
			} else if (action === "deny" || action === "disable" || action === "remove") {
				const requested = this.normalizeToolNames(args.slice(1));
				const next = new Set(activeBefore);
				for (const name of requested) next.delete(name);
				this.session.setActiveToolsByName([...next]);
				notice = `Disabled: ${requested.join(", ") || "none"}. Changes affect the next agent turn.`;
			} else {
				notice = `Unknown permissions action: ${action}. Use allow, deny, reset, default, read-only, full, or no-tools.`;
			}
		}

		const active = new Set(this.session.getActiveToolNames());
		let info = `${theme.bold("Neo Code Permissions")}`;
		if (notice) {
			info += `\n${theme.fg("muted", notice)}`;
		}
		info += `\n\n${theme.bold("Tool exposure")}`;
		info += `\n${theme.fg("dim", "Scope:")} current session; active tools are sent to the model on the next turn`;
		info += `\n${theme.fg("dim", "Presets:")} /permissions default · /permissions read-only · /permissions full · /permissions no-tools`;
		info += `\n${theme.fg("dim", "Edit:")} /permissions allow <tool> · /permissions deny <tool> · /permissions reset`;
		info += `\n${theme.fg("dim", "Approval:")} default prompts for bash/edit/write/extension tools; full mode skips prompts\n`;
		for (const tool of allTools) {
			const enabled = active.has(tool.name);
			const marker = enabled ? theme.fg("success", "✓") : theme.fg("muted", "○");
			const source = this.formatToolSource(tool.sourceInfo?.source, tool.sourceInfo?.scope);
			info += `\n${marker} ${theme.bold(tool.name)} ${theme.fg("dim", `[${source}]`)}`;
			if (tool.description) {
				info += `\n  ${theme.fg("muted", tool.description)}`;
			}
		}

		this.addPlainInfoBlock(info);
	}

	private runGit(
		args: string[],
		timeout = 5000,
	): { ok: boolean; stdout: string; stderr: string; status: number | null } {
		const result = spawnSync("git", args, {
			cwd: this.sessionManager.getCwd(),
			encoding: "utf8",
			stdio: "pipe",
			timeout,
		});
		return {
			ok: result.status === 0,
			stdout: result.stdout ?? "",
			stderr: result.stderr ?? "",
			status: result.status,
		};
	}

	private truncateLargeText(text: string, maxChars: number): string {
		if (text.length <= maxChars) return text;
		return `${text.slice(0, maxChars)}\n\n${theme.fg("warning", `[truncated ${text.length - maxChars} characters]`)}`;
	}

	private async handleReviewCommand(text: string): Promise<void> {
		if (this.session.isStreaming || this.session.isCompacting) {
			this.showWarning("/review is unavailable while Neo Code is already working.");
			return;
		}

		const cwd = this.sessionManager.getCwd();
		if (!isGitRepository(cwd)) {
			this.addPlainInfoBlock(
				`${theme.bold("Code Review")}\n\n${theme.fg("warning", "No Git repository detected.")} /review needs Git to inspect diffs and commits.`,
			);
			return;
		}

		const arg = text.slice("/review".length).trim();
		const target = await this.resolveReviewTargetFromArg(arg, cwd);
		if (target === undefined) {
			// Caller aborted (escape from picker or empty custom prompt). No echo.
			return;
		}
		if (target === null) {
			// Couldn't resolve due to bad arg; helper already showed the error.
			return;
		}

		await this.runReviewWithTarget(target);
	}

	/**
	 * Map a `/review` argument to a {@link ReviewTarget}.
	 *
	 * Returns:
	 *  - `target` when the argument produced an actionable selection.
	 *  - `null` when the argument was invalid (helper already surfaced the error).
	 *  - `undefined` when the user opened the picker and dismissed it.
	 */
	private async resolveReviewTargetFromArg(arg: string, cwd: string): Promise<ReviewTarget | null | undefined> {
		if (arg.length === 0) {
			return await this.openReviewPicker(cwd);
		}

		const lower = arg.toLowerCase();

		if (lower === "uncommitted" || lower === "diff" || lower === "wip") {
			return { kind: "uncommitted" };
		}

		const baseMatch = arg.match(/^(?:base|branch)\s+(\S+)$/i);
		if (baseMatch) {
			const branch = baseMatch[1]!;
			const sha = resolveMergeBase(cwd, branch) ?? undefined;
			return { kind: "base-branch", branch, mergeBaseSha: sha };
		}

		const commitMatch = arg.match(/^commit\s+(\S+)$/i);
		if (commitMatch) {
			const sha = commitMatch[1]!;
			const subject = getCommitSubject(cwd, sha) ?? undefined;
			return { kind: "commit", sha, title: subject };
		}

		const prMatch = arg.match(/^pr\s+#?(\d+)$/i);
		if (prMatch) {
			const number = Number.parseInt(prMatch[1]!, 10);
			if (!Number.isFinite(number) || number <= 0) {
				this.showError(`/review pr expects a positive number, got '${prMatch[1]}'.`);
				return null;
			}
			return { kind: "pull-request", number };
		}

		// Fall back to custom instructions.
		return { kind: "custom", instructions: arg };
	}

	private openReviewPicker(cwd: string): Promise<ReviewTarget | undefined> {
		return new Promise((resolve) => {
			this.showSelector((done) => {
				const branches = listLocalBranches(cwd);
				const commits = listRecentCommits(cwd, 100);
				const selector = new ReviewSelectorComponent(
					{ branches, commits, cwd },
					(target) => {
						resolve(target);
						done();
					},
					() => {
						resolve(undefined);
						done();
					},
				);
				return { component: selector, focus: selector };
			});
		});
	}

	private async runReviewWithTarget(target: ReviewTarget): Promise<void> {
		// Custom selected from picker without inline instructions: surface a
		// hint rather than firing an empty review. Users can re-invoke with
		// `/review <free-form text>`.
		if (target.kind === "custom" && target.instructions.trim().length === 0) {
			this.showWarning('Type "/review <your instructions>" to run a custom review.');
			return;
		}

		// Hydrate base-branch merge-base if it was deferred (e.g. CLI shortcut
		// path resolved already, but the picker path resolves here so the
		// prompt always carries the SHA when available).
		let resolved = target;
		if (resolved.kind === "base-branch" && !resolved.mergeBaseSha) {
			const sha = resolveMergeBase(this.sessionManager.getCwd(), resolved.branch) ?? undefined;
			resolved = { ...resolved, mergeBaseSha: sha };
		}

		const kickoff = buildReviewKickoffMessage(resolved);
		this.addPlainInfoBlock(`${theme.bold("Code Review")}\n\n${theme.fg("dim", kickoff)}`);

		const userPrompt = buildReviewUserPrompt(resolved);
		try {
			await this.session.prompt(userPrompt);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : "Unknown error";
			this.showError(`/review failed: ${message}`);
		}
	}

	private handleDiffCommand(text: string): void {
		const args = text.slice("/diff".length).trim().split(/\s+/).filter(Boolean);
		const showStatOnly = args.includes("--stat") || args.includes("stat");
		const gitCheck = this.runGit(["rev-parse", "--show-toplevel"]);
		if (!gitCheck.ok) {
			this.addPlainInfoBlock(
				`${theme.bold("Workspace Diff")}\n\n${theme.fg("warning", "No Git repository detected.")} /diff uses Git so it can safely show staged and unstaged workspace changes.`,
			);
			return;
		}

		const status = this.runGit(["status", "--short"]);
		const stagedStat = this.runGit(["diff", "--cached", "--stat", "--"]);
		const unstagedStat = this.runGit(["diff", "--stat", "--"]);
		const stagedDiff = showStatOnly ? { stdout: "" } : this.runGit(["diff", "--cached", "--no-ext-diff", "--"]);
		const unstagedDiff = showStatOnly ? { stdout: "" } : this.runGit(["diff", "--no-ext-diff", "--"]);
		const hasChanges = status.stdout.trim().length > 0;

		let info = `${theme.bold("Workspace Diff")}\n\n`;
		info += `${theme.fg("dim", "Repo:")} ${this.formatCompactDisplayPath(gitCheck.stdout.trim())}\n`;
		if (!hasChanges) {
			info += `${theme.fg("success", "No staged or unstaged changes.")}`;
			this.addPlainInfoBlock(info);
			return;
		}

		info += `${theme.bold("Status")}\n${status.stdout.trim()}\n`;
		const statText = [
			stagedStat.stdout.trim() && `Staged:\n${stagedStat.stdout.trim()}`,
			unstagedStat.stdout.trim() && `Unstaged:\n${unstagedStat.stdout.trim()}`,
		]
			.filter(Boolean)
			.join("\n\n");
		if (statText) {
			info += `\n${theme.bold("Stat")}\n${statText}\n`;
		}
		if (showStatOnly) {
			this.addPlainInfoBlock(info.trimEnd());
			return;
		}

		const renderedSections: string[] = [];
		if (stagedDiff.stdout.trim()) {
			renderedSections.push(`${theme.bold("Staged changes")}\n${renderDiff(stagedDiff.stdout.trim())}`);
		}
		if (unstagedDiff.stdout.trim()) {
			renderedSections.push(`${theme.bold("Unstaged changes")}\n${renderDiff(unstagedDiff.stdout.trim())}`);
		}
		if (renderedSections.length === 0) {
			info += `\n${theme.fg("warning", "Only untracked files are present; Git diff has no file content to show.")}`;
		} else {
			info += `\n${this.truncateLargeText(renderedSections.join("\n\n"), 60000)}`;
		}
		this.addPlainInfoBlock(info.trimEnd());
	}

	private formatAgentsFilePath(filePath: string): string {
		const cwd = this.sessionManager.getCwd();
		const relative = path.relative(cwd, filePath);
		if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
			return relative || path.basename(filePath);
		}
		return this.formatCompactDisplayPath(filePath);
	}

	private createAgentsTemplate(): string {
		return `# AGENTS.md\n\nProject instructions for Neo Code and other coding agents.\n\n## Project overview\n- TODO: Describe what this project does.\n\n## Development commands\n- TODO: Add build/test/lint commands.\n\n## Coding style\n- TODO: Add formatting, naming, and architecture rules.\n\n## Safety and permissions\n- Ask before destructive file operations.\n- Prefer small, reviewable diffs.\n\n## Notes for Neosantara\n- Keep responses practical and paste-ready.\n`;
	}

	private async handleInitCommand(): Promise<void> {
		if (this.session.isStreaming || this.session.isCompacting) {
			this.showWarning("/init is unavailable while Neo Code is already working.");
			return;
		}

		const targetPath = path.join(this.sessionManager.getCwd(), AGENTS_FILE_NAME);
		if (fs.existsSync(targetPath)) {
			this.addPlainInfoBlock(
				`${theme.bold("Project Instructions")}\n\n${theme.fg("warning", `${AGENTS_FILE_NAME} already exists here.`)} Skipping /init to avoid overwriting it.\n${theme.fg("dim", this.formatCompactDisplayPath(targetPath))}`,
			);
			return;
		}

		await this.session.prompt(INIT_AGENTS_PROMPT);
	}

	private async handleAgentsCommand(text: string): Promise<void> {
		const args = text.slice("/agents".length).trim().split(/\s+/).filter(Boolean);
		const action = args[0]?.toLowerCase();
		const targetPath = path.join(this.sessionManager.getCwd(), AGENTS_FILE_NAME);

		if (action === "init") {
			if (fs.existsSync(targetPath)) {
				this.addPlainInfoBlock(
					`${theme.bold("Project Instructions")}\n\n${theme.fg("warning", "AGENTS.md already exists:")} ${targetPath}`,
				);
				return;
			}
			fs.writeFileSync(targetPath, this.createAgentsTemplate(), "utf8");
			await this.session.reload();
			this.addPlainInfoBlock(
				`${theme.bold("Project Instructions")}\n\n${theme.fg("success", "Created:")} ${targetPath}\n${theme.fg("dim", "Reloaded resources so AGENTS.md is included in the next turn.")}`,
			);
			return;
		}

		const agentsFiles = this.session.resourceLoader.getAgentsFiles().agentsFiles;
		let info = `${theme.bold("Project Instructions")}`;
		info += `\n${theme.fg("dim", "Source:")} AGENTS.md files from user agent dir and workspace ancestors`;
		info += `\n${theme.fg("dim", "Commands:")} /init · /agents init · /agents show\n`;
		if (agentsFiles.length === 0) {
			info += `\n${theme.fg("warning", "No AGENTS.md loaded.")} Run /init to generate one with the agent, or /agents init for a starter template.`;
			this.addPlainInfoBlock(info);
			return;
		}

		for (const [index, file] of agentsFiles.entries()) {
			info += `\n${theme.bold(`${index + 1}. ${this.formatAgentsFilePath(file.path)}`)}`;
			if (action === "show") {
				info += `\n${file.content.trim() || theme.fg("muted", "(empty)")}\n`;
			} else {
				const preview = file.content.trim().split("\n").slice(0, 6).join("\n");
				info += `\n${theme.fg("muted", preview || "(empty)")}`;
				if (file.content.trim().split("\n").length > 6) {
					info += `\n${theme.fg("dim", "  … use /agents show for full content")}`;
				}
			}
		}
		this.addPlainInfoBlock(info.trimEnd());
	}

	private handleHooksCommand(): void {
		const extensions = this.session.resourceLoader.getExtensions().extensions;
		let info = `${theme.bold("Extension Hooks")}`;
		info += `\n${theme.fg("dim", "Events:")} existing Neo extension event system; this command only reports registered handlers`;
		info += `\n${theme.fg("dim", "Docs:")} extension hooks can listen to agent, tool, model, context, input, and session events\n`;
		if (extensions.length === 0) {
			info += `\n${theme.fg("muted", "No extensions loaded.")}`;
			this.addPlainInfoBlock(info);
			return;
		}

		for (const ext of extensions) {
			const handlerSummary = [...ext.handlers.entries()]
				.filter(([, handlers]) => handlers.length > 0)
				.map(([event, handlers]) => `${event}×${handlers.length}`)
				.sort((a, b) => a.localeCompare(b));
			const commandNames = [...ext.commands.keys()].sort((a, b) => a.localeCompare(b));
			const toolNames = [...ext.tools.keys()].sort((a, b) => a.localeCompare(b));
			const shortcutNames = [...ext.shortcuts.keys()].sort((a, b) => a.localeCompare(b));
			info += `\n${theme.bold(this.formatCompactDisplayPath(ext.path))}`;
			info += `\n  ${theme.fg("dim", "Hooks:")} ${handlerSummary.length ? handlerSummary.join(", ") : "none"}`;
			info += `\n  ${theme.fg("dim", "Commands:")} ${commandNames.length ? commandNames.map((name) => `/${name}`).join(", ") : "none"}`;
			info += `\n  ${theme.fg("dim", "Tools:")} ${toolNames.length ? toolNames.join(", ") : "none"}`;
			info += `\n  ${theme.fg("dim", "Shortcuts:")} ${shortcutNames.length ? shortcutNames.join(", ") : "none"}`;
		}
		this.addPlainInfoBlock(info);
	}

	private formatSkillsList(): string {
		const skills = this.session.resourceLoader.getSkills().skills;
		if (skills.length === 0) {
			return `${theme.bold("Skills")}\n\n${theme.fg("muted", "No skills loaded.")}\n${theme.fg("dim", "Install with:")} /skills install <source>`;
		}

		let info = `${theme.bold("Skills")}`;
		info += `\n${theme.fg("dim", "Install:")} /skills install <source> [-l|--local]`;
		info += `\n${theme.fg("dim", "Invoke:")} /skill:<name>`;
		info += `\n${theme.fg("dim", "Setting:")} Register skills as /skill:name commands controls invocation autocomplete only.\n`;
		for (const skill of [...skills].sort((left, right) => left.name.localeCompare(right.name))) {
			const displayName = getSkillDisplayName(skill);
			const nameSuffix = displayName === skill.name ? "" : ` ${theme.fg("dim", skill.name)}`;
			info += `\n${theme.bold(displayName)}${nameSuffix} ${theme.fg("dim", `(/skill:${skill.name})`)}`;
			info += `\n  ${theme.fg("muted", getSkillDescription(skill))}`;
			info += `\n  ${theme.fg("dim", this.formatCompactDisplayPath(skill.filePath))}`;
		}
		return info;
	}

	private async handleSkillsCommand(text: string): Promise<void> {
		const command = parseSkillsCommand(text);

		if (command.action === "help") {
			this.addPlainInfoBlock(
				[
					theme.bold("Skills"),
					"",
					`${theme.fg("dim", "Install:")} /skills install <source> [-l|--local]`,
					`${theme.fg("dim", "List:")} /skills list`,
					`${theme.fg("dim", "Invoke:")} /skill:<name>`,
					"",
					"Installing adds a package/resource to settings, reloads resources, then loaded skills can be invoked with /skill:<name>.",
				].join("\n"),
			);
			return;
		}

		if (command.action === "list") {
			this.addPlainInfoBlock(this.formatSkillsList());
			return;
		}

		if (command.action === "error") {
			this.showError(command.message);
			return;
		}
		if (command.action !== "install") {
			return;
		}

		const packageManager = new DefaultPackageManager({
			cwd: this.sessionManager.getCwd(),
			agentDir: getAgentDir(),
			settingsManager: this.settingsManager,
		});
		packageManager.setProgressCallback((event) => {
			if (event.type === "start") {
				this.showStatus(event.message ?? `Installing ${command.source}...`);
			}
		});

		try {
			await packageManager.installAndPersist(command.source, {
				local: command.local,
			});
			await this.session.reload();
			this.setupAutocompleteProvider();
			const scope = command.local ? "project" : "user";
			this.addPlainInfoBlock(
				`${theme.bold("Skills")}\n\n${theme.fg("success", `Installed ${command.source} (${scope}).`)}\n${theme.fg("dim", "Resources reloaded. Use /skills list to see loaded skills.")}`,
			);
		} catch (error) {
			this.showError(`Failed to install skill package: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private handleChangelogCommand(): void {
		const allEntries = getAllChangelogEntries();

		const changelogMarkdown = formatChangelogEntries(
			allEntries,
			this.changelogMarkdown?.trim() || "No changelog entries found.",
		);

		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new DynamicBorder());
		this.chatContainer.addChild(new Text(theme.bold(theme.fg("accent", "What's New")), 1, 0));
		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new Markdown(changelogMarkdown, 1, 1, this.getMarkdownThemeWithSettings()));
		this.chatContainer.addChild(new DynamicBorder());
		this.ui.requestRender();
	}

	/**
	 * Get capitalized display string for an app keybinding action.
	 */
	private getAppKeyDisplay(action: AppKeybinding): string {
		return keyDisplayText(action);
	}

	/**
	 * Get capitalized display string for an editor keybinding action.
	 */
	private getEditorKeyDisplay(action: Keybinding): string {
		return keyDisplayText(action);
	}

	private handleHotkeysCommand(): void {
		// Navigation keybindings
		const cursorUp = this.getEditorKeyDisplay("tui.editor.cursorUp");
		const cursorDown = this.getEditorKeyDisplay("tui.editor.cursorDown");
		const cursorLeft = this.getEditorKeyDisplay("tui.editor.cursorLeft");
		const cursorRight = this.getEditorKeyDisplay("tui.editor.cursorRight");
		const cursorWordLeft = this.getEditorKeyDisplay("tui.editor.cursorWordLeft");
		const cursorWordRight = this.getEditorKeyDisplay("tui.editor.cursorWordRight");
		const cursorLineStart = this.getEditorKeyDisplay("tui.editor.cursorLineStart");
		const cursorLineEnd = this.getEditorKeyDisplay("tui.editor.cursorLineEnd");
		const jumpForward = this.getEditorKeyDisplay("tui.editor.jumpForward");
		const jumpBackward = this.getEditorKeyDisplay("tui.editor.jumpBackward");
		const pageUp = this.getEditorKeyDisplay("tui.editor.pageUp");
		const pageDown = this.getEditorKeyDisplay("tui.editor.pageDown");

		// Editing keybindings
		const submit = this.getEditorKeyDisplay("tui.input.submit");
		const newLine = this.getEditorKeyDisplay("tui.input.newLine");
		const deleteWordBackward = this.getEditorKeyDisplay("tui.editor.deleteWordBackward");
		const deleteWordForward = this.getEditorKeyDisplay("tui.editor.deleteWordForward");
		const deleteToLineStart = this.getEditorKeyDisplay("tui.editor.deleteToLineStart");
		const deleteToLineEnd = this.getEditorKeyDisplay("tui.editor.deleteToLineEnd");
		const yank = this.getEditorKeyDisplay("tui.editor.yank");
		const yankPop = this.getEditorKeyDisplay("tui.editor.yankPop");
		const undo = this.getEditorKeyDisplay("tui.editor.undo");
		const tab = this.getEditorKeyDisplay("tui.input.tab");

		// App keybindings
		const interrupt = this.getAppKeyDisplay("app.interrupt");
		const clear = this.getAppKeyDisplay("app.clear");
		const exit = this.getAppKeyDisplay("app.exit");
		const suspend = this.getAppKeyDisplay("app.suspend");
		const cycleMode = this.getAppKeyDisplay("app.mode.cycle");
		const cycleThinkingLevel = this.getAppKeyDisplay("app.thinking.cycle");
		const cycleModelForward = this.getAppKeyDisplay("app.model.cycleForward");
		const selectModel = this.getAppKeyDisplay("app.model.select");
		const viewTranscript = this.getAppKeyDisplay("app.transcript.view");
		const expandTools = this.getAppKeyDisplay("app.tools.expand");
		const toggleThinking = this.getAppKeyDisplay("app.thinking.toggle");
		const externalEditor = this.getAppKeyDisplay("app.editor.external");
		const cycleModelBackward = this.getAppKeyDisplay("app.model.cycleBackward");
		const followUp = this.getAppKeyDisplay("app.message.followUp");
		const dequeue = this.getAppKeyDisplay("app.message.dequeue");
		const pasteImage = this.getAppKeyDisplay("app.clipboard.pasteImage");

		let hotkeys = `
**Navigation**
| Key | Action |
|-----|--------|
| \`${cursorUp}\` / \`${cursorDown}\` / \`${cursorLeft}\` / \`${cursorRight}\` | Move cursor / browse history (Up when empty) |
| \`${cursorWordLeft}\` / \`${cursorWordRight}\` | Move by word |
| \`${cursorLineStart}\` | Start of line |
| \`${cursorLineEnd}\` | End of line |
| \`${jumpForward}\` | Jump forward to character |
| \`${jumpBackward}\` | Jump backward to character |
| \`${pageUp}\` / \`${pageDown}\` | Scroll by page |

**Editing**
| Key | Action |
|-----|--------|
| \`${submit}\` | Send message |
| \`${newLine}\` | New line${process.platform === "win32" ? " (Ctrl+Enter on Windows Terminal)" : ""} |
| \`${deleteWordBackward}\` | Delete word backwards |
| \`${deleteWordForward}\` | Delete word forwards |
| \`${deleteToLineStart}\` | Delete to start of line |
| \`${deleteToLineEnd}\` | Delete to end of line |
| \`${yank}\` | Paste the most-recently-deleted text |
| \`${yankPop}\` | Cycle through the deleted text after pasting |
| \`${undo}\` | Undo |

**Other**
| Key | Action |
|-----|--------|
| \`${tab}\` | Path completion / accept autocomplete |
| \`${interrupt}\` | Cancel autocomplete / abort streaming |
| \`${clear}\` | Clear editor (first) / exit (second) |
| \`${exit}\` | Exit (when editor is empty) |
| \`${suspend}\` | Suspend to background |
| \`${cycleMode}\` | Cycle workflow mode |
| \`${cycleThinkingLevel}\` | Cycle thinking level |
| \`${cycleModelForward}\` / \`${cycleModelBackward}\` | Cycle models |
| \`${selectModel}\` | Open model selector |
| \`${viewTranscript}\` | View transcript / expand tool output |
| \`${expandTools}\` | Toggle tool output expansion |
| \`${toggleThinking}\` | Toggle thinking block visibility |
| \`${externalEditor}\` | Edit message in external editor |
| \`${followUp}\` | Queue follow-up message |
| \`${dequeue}\` | Restore queued messages |
| \`${pasteImage}\` | Paste image from clipboard |
| \`/\` | Slash commands |
| \`!\` | Run bash command |
| \`!!\` | Run bash command (excluded from context) |
`;

		// Add extension-registered shortcuts
		const extensionRunner = this.session.extensionRunner;
		const shortcuts = extensionRunner.getShortcuts(this.keybindings.getEffectiveConfig());
		if (shortcuts.size > 0) {
			hotkeys += `
**Extensions**
| Key | Action |
|-----|--------|
`;
			for (const [key, shortcut] of shortcuts) {
				const description = shortcut.description ?? shortcut.extensionPath;
				const keyDisplay = formatKeyText(key, { capitalize: true });
				hotkeys += `| \`${keyDisplay}\` | ${description} |\n`;
			}
		}

		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new DynamicBorder());
		this.chatContainer.addChild(new Text(theme.bold(theme.fg("accent", "Keyboard Shortcuts")), 1, 0));
		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new Markdown(hotkeys.trim(), 1, 1, this.getMarkdownThemeWithSettings()));
		this.chatContainer.addChild(new DynamicBorder());
		this.ui.requestRender();
	}

	private async handleClearCommand(): Promise<void> {
		if (this.loadingAnimation) {
			this.loadingAnimation.stop();
			this.loadingAnimation = undefined;
		}
		this.statusContainer.clear();
		try {
			const result = await this.runtimeHost.newSession();
			if (result.cancelled) {
				return;
			}
			this.renderCurrentSessionState();
			this.chatContainer.addChild(new Spacer(1));
			this.chatContainer.addChild(new Text(`${theme.fg("accent", "✓ New session started")}`, 1, 1));
			this.ui.requestRender();
		} catch (error: unknown) {
			await this.handleFatalRuntimeError("Failed to create session", error);
		}
	}

	/**
	 * Spawn a new session that records the current one as its parent.
	 *
	 * Mirrors Codex's `/fork` command: the new session is fresh (no inherited
	 * messages), but the session-tree picker keeps the original visible as
	 * the parent so the user can navigate back. In-memory sessions cannot
	 * be referenced as a parent, so we treat them like `/new` instead.
	 */
	private async handleForkCommand(): Promise<void> {
		const currentSessionFile = this.session.sessionFile;
		if (!currentSessionFile) {
			this.showWarning("/fork is unavailable in in-memory sessions; use /new instead.");
			return;
		}
		if (this.session.isStreaming || this.session.isCompacting) {
			this.showWarning("/fork is unavailable while Neo Code is already working.");
			return;
		}
		if (this.loadingAnimation) {
			this.loadingAnimation.stop();
			this.loadingAnimation = undefined;
		}
		this.statusContainer.clear();
		try {
			const result = await this.runtimeHost.newSession({ parentSession: currentSessionFile });
			if (result.cancelled) {
				return;
			}
			this.renderCurrentSessionState();
			this.chatContainer.addChild(new Spacer(1));
			this.chatContainer.addChild(new Text(`${theme.fg("accent", "✓ Forked into a new session")}`, 1, 1));
			this.ui.requestRender();
		} catch (error: unknown) {
			await this.handleFatalRuntimeError("Failed to fork session", error);
		}
	}

	/**
	 * Hand off an approved plan into a fresh session.
	 *
	 * Triggered by the "Yes, fork to fresh context" branch of the ExitPlanMode
	 * approval popup. We wait for the current turn to wrap up after the agent
	 * sees the approval, then fork the session (preserving the parent link in
	 * the session tree) and submit the plan as a new user message so the
	 * implementation runs against a clean context window.
	 *
	 * Failures here are surfaced to the user as warnings rather than fatal
	 * runtime errors because the plan has already been approved in the
	 * original thread; partial failure (e.g. fork succeeds but submit fails)
	 * is recoverable manually.
	 */
	private async forkSessionWithPlan(plan: string): Promise<void> {
		const trimmedPlan = plan.trim();
		if (!trimmedPlan) return;

		// Wait for the current turn to drain so the parent session has a
		// chance to record the approval message before we tear it down.
		await this.waitForSessionIdle();

		const currentSessionFile = this.session.sessionFile;
		if (!currentSessionFile) {
			this.showWarning("Cannot fork to fresh context: current session is not persisted.");
			return;
		}

		try {
			const forkResult = await this.runtimeHost.newSession({ parentSession: currentSessionFile });
			if (forkResult.cancelled) {
				this.showStatus("Fork cancelled");
				return;
			}
			this.renderCurrentSessionState();
			this.chatContainer.addChild(new Spacer(1));
			this.chatContainer.addChild(
				new Text(`${theme.fg("accent", "✓ Forked into a fresh context. Implementing plan…")}`, 1, 1),
			);
			this.ui.requestRender();
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : "Unknown error";
			this.showWarning(`Failed to fork into fresh context: ${message}`);
			return;
		}

		const userPrompt = [
			"A previous plan-mode agent in this project produced the plan below to accomplish the user's task.",
			"Implement the plan in a fresh context. Treat the plan as the source of user intent, re-read files as needed, and carry the work through implementation and verification.",
			"",
			trimmedPlan,
		].join("\n");
		try {
			await this.session.prompt(userPrompt);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : "Unknown error";
			this.showError(`Plan implementation prompt failed: ${message}`);
		}
	}

	/**
	 * Resolve once the current session has stopped streaming/compacting. Polls
	 * with a short delay; bounded so a stuck session cannot hang the fork
	 * handoff indefinitely.
	 */
	private waitForSessionIdle(): Promise<void> {
		return new Promise((resolve) => {
			const start = Date.now();
			const check = () => {
				if (!this.session.isStreaming && !this.session.isCompacting) {
					resolve();
					return;
				}
				if (Date.now() - start > 30_000) {
					// Bail out after 30s so we never deadlock the user; the
					// caller surfaces a warning if the fork itself fails.
					resolve();
					return;
				}
				setTimeout(check, 50);
			};
			check();
		});
	}

	private checkLowBalance(): void {
		if (this.lowBalanceWarningShown) return;
		// Estimate remaining balance from last known balance minus session cost
		const sessionCost = this.getCumulativeUsageForContext().cost;
		if (this.lastKnownBalanceIdr !== undefined) {
			const estimated = this.lastKnownBalanceIdr - sessionCost;
			if (estimated < 5000 && estimated >= 0) {
				this.lowBalanceWarningShown = true;
				this.showWarning(
					`Low balance: ~${Math.round(estimated)} IDR remaining. Top up at https://app.neosantara.xyz/billing`,
				);
			}
			return;
		}
		// Fetch balance in background on first check
		getNeosantaraBackendUsageSnapshot()
			.then((result) => {
				if (result.snapshot?.balanceIdr !== undefined) {
					this.lastKnownBalanceIdr = result.snapshot.balanceIdr;
					const estimated = this.lastKnownBalanceIdr - sessionCost;
					if (estimated < 5000 && estimated >= 0) {
						this.lowBalanceWarningShown = true;
						this.showWarning(
							`Low balance: ~${Math.round(estimated)} IDR remaining. Top up at https://app.neosantara.xyz/billing`,
						);
					}
				}
			})
			.catch(() => {});
	}

	private handleTerminalBlur(): void {
		this.terminalBlurredAt = Date.now();
		this.workCompletedWhileAway = false;
	}

	/**
	 * Fire an opt-in Termux:API completion notification when:
	 *  - `notifications.termux.enabled` is true,
	 *  - the terminal is currently unfocused (or was blurred at any point
	 *    during the turn — `terminalBlurredAt` is set), and
	 *  - the turn took at least `minDurationMs`.
	 *
	 * Safe no-op when Termux:API is not installed or anything fails: the
	 * underlying wrappers never throw.
	 */
	private maybeSendTermuxCompletionNotification(): void {
		const startedAt = this.currentTurnStartedAt;
		if (!startedAt) return;
		if (!this.terminalBlurredAt) return;
		const settings = this.settingsManager.getTermuxNotificationSettings();
		if (!settings.enabled) return;
		const durationMs = Date.now() - startedAt;
		if (durationMs < settings.minDurationMs) return;
		const caps = getTermuxApiCapabilities();
		if (!caps.notification && !caps.vibrate) return;

		const seconds = Math.round(durationMs / 1000);
		const durationLabel = seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
		const sessionName = this.session.sessionManager.getSessionName();
		const title = sessionName ? `Neo Code · ${sessionName}` : "Neo Code";
		const content = `Turn finished in ${durationLabel}. Tap to return.`;

		try {
			termuxNotify({
				title,
				content,
				id: "neo-code-turn-complete",
				priority: "default",
				sound: settings.sound,
				group: "neo-code",
			});
		} catch {
			// termuxNotify already swallows errors; this is belt-and-braces.
		}
		if (settings.vibrate) {
			try {
				termuxVibrate(150);
			} catch {
				// no-op
			}
		}
	}

	private handleTerminalFocus(): void {
		if (!this.terminalBlurredAt) return;
		const awayMs = Date.now() - this.terminalBlurredAt;
		const awayMinutes = Math.floor(awayMs / 60_000);
		this.terminalBlurredAt = undefined;

		// Show away summary if gone >2 minutes and work completed while away
		if (awayMinutes >= 2 && this.workCompletedWhileAway) {
			const minutes =
				awayMinutes >= 60 ? `${Math.floor(awayMinutes / 60)}h ${awayMinutes % 60}m` : `${awayMinutes}m`;
			this.showStatus(`Welcome back (away ${minutes}). Work completed while you were gone.`);
		}
		this.workCompletedWhileAway = false;
	}

	private handleDebugCommand(): void {
		const width = this.ui.terminal.columns;
		const height = this.ui.terminal.rows;
		const allLines = this.ui.render(width);

		const debugLogPath = getDebugLogPath();
		const debugData = [
			`Debug output at ${new Date().toISOString()}`,
			`Terminal: ${width}x${height}`,
			`Total lines: ${allLines.length}`,
			"",
			"=== All rendered lines with visible widths ===",
			...allLines.map((line, idx) => {
				const vw = visibleWidth(line);
				const escaped = JSON.stringify(line);
				return `[${idx}] (w=${vw}) ${escaped}`;
			}),
			"",
			"=== Agent messages (JSONL) ===",
			...this.session.messages.map((msg) => JSON.stringify(msg)),
			"",
		].join("\n");

		fs.mkdirSync(path.dirname(debugLogPath), { recursive: true });
		fs.writeFileSync(debugLogPath, debugData);

		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(
			new Text(`${theme.fg("accent", "✓ Debug log written")}\n${theme.fg("muted", debugLogPath)}`, 1, 1),
		);
		this.ui.requestRender();
	}

	private handleArminSaysHi(): void {
		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new ArminComponent(this.ui));
		this.ui.requestRender();
	}

	private handleDementedDelves(): void {
		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new NeosantaraAnnouncementComponent());
		this.ui.requestRender();
	}

	private async handleBashCommand(command: string, excludeFromContext = false): Promise<void> {
		const extensionRunner = this.session.extensionRunner;

		// Emit user_bash event to let extensions intercept
		const eventResult = await extensionRunner.emitUserBash({
			type: "user_bash",
			command,
			excludeFromContext,
			cwd: this.sessionManager.getCwd(),
		});

		// If extension returned a full result, use it directly
		if (eventResult?.result) {
			const result = eventResult.result;

			// Create UI component for display
			this.bashComponent = new BashExecutionComponent(command, this.ui, excludeFromContext);
			if (this.session.isStreaming) {
				this.pendingMessagesContainer.addChild(this.bashComponent);
				this.pendingBashComponents.push(this.bashComponent);
			} else {
				this.chatContainer.addChild(this.bashComponent);
			}

			// Show output and complete
			if (result.output) {
				this.bashComponent.appendOutput(result.output);
			}
			this.bashComponent.setComplete(
				result.exitCode,
				result.cancelled,
				result.truncated ? ({ truncated: true, content: result.output } as TruncationResult) : undefined,
				result.fullOutputPath,
			);

			// Record the result in session
			this.session.recordBashResult(command, result, { excludeFromContext });
			this.bashComponent = undefined;
			this.ui.requestRender();
			return;
		}

		// Normal execution path (possibly with custom operations)
		const isDeferred = this.session.isStreaming;
		this.bashComponent = new BashExecutionComponent(command, this.ui, excludeFromContext);

		if (isDeferred) {
			// Show in pending area when agent is streaming
			this.pendingMessagesContainer.addChild(this.bashComponent);
			this.pendingBashComponents.push(this.bashComponent);
		} else {
			// Show in chat immediately when agent is idle
			this.chatContainer.addChild(this.bashComponent);
		}
		this.ui.requestRender();

		try {
			const result = await this.session.executeBash(
				command,
				(chunk) => {
					if (this.bashComponent) {
						this.bashComponent.appendOutput(chunk);
						this.ui.requestRender();
					}
				},
				{ excludeFromContext, operations: eventResult?.operations },
			);

			if (this.bashComponent) {
				this.bashComponent.setComplete(
					result.exitCode,
					result.cancelled,
					result.truncated ? ({ truncated: true, content: result.output } as TruncationResult) : undefined,
					result.fullOutputPath,
				);
			}
		} catch (error) {
			if (this.bashComponent) {
				this.bashComponent.setComplete(undefined, false);
			}
			this.showError(`Bash command failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		}

		this.bashComponent = undefined;
		this.ui.requestRender();
	}

	private async handleCompactCommand(customInstructions?: string): Promise<void> {
		if (this.session.isCompacting) {
			this.showWarning("Compaction is already running");
			return;
		}

		const entries = this.sessionManager.getEntries();
		const messageCount = entries.filter((e) => e.type === "message").length;

		if (messageCount < 2) {
			this.showWarning("Nothing to compact (no messages yet)");
			return;
		}

		if (this.loadingAnimation) {
			this.loadingAnimation.stop();
			this.loadingAnimation = undefined;
		}
		this.statusContainer.clear();

		try {
			await this.session.compact(customInstructions);
		} catch {
			// Ignore, will be emitted as an event
		}
	}

	stop(): void {
		this.unregisterSignalHandlers();
		if (this.settingsManager.getShowTerminalProgress()) {
			this.ui.terminal.setProgress(false);
		}
		if (this.loadingAnimation) {
			this.loadingAnimation.stop();
			this.loadingAnimation = undefined;
		}
		this.clearExtensionTerminalInputListeners();
		this.footer.dispose();
		this.footerDataProvider.dispose();
		if (this.unsubscribe) {
			this.unsubscribe();
		}
		if (this.isInitialized) {
			this.ui.stop();
			this.isInitialized = false;
		}
	}
}
