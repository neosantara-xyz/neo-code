const FALLBACK_WORKING_MESSAGE = "ngulik";
type WorkingLoaderMode = "responding" | "requesting" | "tool-input" | "tool-use";

export function pickDefaultWorkingMessageIndex(messageCount: number, random: () => number = Math.random): number {
	if (messageCount <= 0) return 0;
	const value = random();
	const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999_999) : 0;
	return Math.floor(normalized * messageCount);
}

export function formatDefaultWorkingMessage(messages: readonly string[], index: number): string {
	const normalizedIndex = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
	const label = messages.length > 0 ? messages[normalizedIndex % messages.length] : FALLBACK_WORKING_MESSAGE;
	return `${label}...`;
}

export function shouldAttachSpinnerTipForMode(mode: WorkingLoaderMode): boolean {
	return mode === "responding";
}
