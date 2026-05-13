/**
 * OAuth credential registry.
 *
 * The Neosantara-first build intentionally ships with no built-in OAuth providers.
 * Custom extensions can still register OAuth providers at runtime.
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
