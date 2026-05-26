import type { KnownProvider } from "@neosantara/ai";

export const BUILT_IN_PROVIDER_DISPLAY_NAMES: Record<string, string> = {
	neosantara: "Neosantara",
};

export const providerDisplayNames = BUILT_IN_PROVIDER_DISPLAY_NAMES;

export function getProviderDisplayName(provider: string): string {
	return BUILT_IN_PROVIDER_DISPLAY_NAMES[provider as KnownProvider] ?? provider;
}
