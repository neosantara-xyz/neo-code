import { join } from "node:path";
import { getDocsPath } from "../config.js";

const UNKNOWN_PROVIDER = "unknown";

export function getProviderLoginHelp(): string {
	return [
		"Run `nai login` to log in with Neosantara device authorization, or use NAI_API_KEY/NEOSANTARA_API_KEY. See:",
		`  ${join(getDocsPath(), "providers.md")}`,
		`  ${join(getDocsPath(), "models.md")}`,
	].join("\n");
}

export function formatNoModelsAvailableMessage(): string {
	return `No models available. ${getProviderLoginHelp()}`;
}

export function formatNoModelSelectedMessage(): string {
	return `No model selected.\n\n${getProviderLoginHelp()}\n\nThen use /model to select a model.`;
}

export function formatNoApiKeyFoundMessage(provider: string): string {
	const providerDisplay = provider === UNKNOWN_PROVIDER ? "the selected model" : provider;
	return `No API key found for ${providerDisplay}.\n\n${getProviderLoginHelp()}`;
}
