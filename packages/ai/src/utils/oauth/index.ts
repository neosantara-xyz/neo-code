/**
 * OAuth credential registry.
 *
 * The Neosantara-first build intentionally ships with no built-in OAuth
 * providers. Neosantara itself uses a device-authorization flow that yields
 * a long-lived API key, not OAuth tokens (see
 * `packages/coding-agent/src/core/neosantara-device-auth.ts`).
 *
 * This registry is a stable extension point: third-party CLI extensions can
 * register OAuth providers at runtime via `registerOAuthProvider`, and the
 * coding-agent's `AuthStorage` will resolve their tokens through the same
 * code path as built-in API keys. Removing it would break the extension API.
 */

export * from "./types.js";

import type { OAuthCredentials, OAuthProviderId, OAuthProviderInterface } from "./types.js";

type OAuthApiKeyResult = { apiKey: string; newCredentials: OAuthCredentials };

const oauthProviderRegistry = new Map<string, OAuthProviderInterface>();

export function getOAuthProvider(id: OAuthProviderId): OAuthProviderInterface | undefined {
	return oauthProviderRegistry.get(id);
}

export function registerOAuthProvider(provider: OAuthProviderInterface): void {
	oauthProviderRegistry.set(provider.id, provider);
}

export function unregisterOAuthProvider(id: string): void {
	oauthProviderRegistry.delete(id);
}

export function resetOAuthProviders(): void {
	oauthProviderRegistry.clear();
}

export function getOAuthProviders(): OAuthProviderInterface[] {
	return Array.from(oauthProviderRegistry.values());
}

export async function loginOAuthProvider(
	id: OAuthProviderId,
	callbacks: Parameters<OAuthProviderInterface["login"]>[0],
): Promise<OAuthCredentials> {
	const provider = getOAuthProvider(id);
	if (!provider) throw new Error(`Unknown OAuth provider: ${id}`);
	return provider.login(callbacks);
}

export async function refreshOAuthToken(id: OAuthProviderId, credentials: OAuthCredentials): Promise<OAuthCredentials> {
	const provider = getOAuthProvider(id);
	if (!provider) throw new Error(`Unknown OAuth provider: ${id}`);
	return provider.refreshToken(credentials);
}

export async function getOAuthApiKey(
	id: OAuthProviderId,
	credentialsByProvider: Record<string, OAuthCredentials>,
): Promise<OAuthApiKeyResult | null> {
	const provider = getOAuthProvider(id);
	const credentials = credentialsByProvider[id];
	if (!provider || !credentials) return null;

	const newCredentials = Date.now() >= credentials.expires ? await provider.refreshToken(credentials) : credentials;
	return { apiKey: provider.getApiKey(newCredentials), newCredentials };
}
