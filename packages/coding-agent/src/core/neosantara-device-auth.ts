import chalk from "chalk";
import { AuthStorage } from "./auth-storage.js";

const DEFAULT_API_BASE_URL = "https://api.neosantara.xyz";
const DEFAULT_PROVIDER = "neosantara";
const REQUEST_TIMEOUT_MS = 30_000;
const EXTRA_EXPIRY_GRACE_MS = 1_000;

type JsonObject = Record<string, unknown>;

export type DeviceInitiateData = {
	device_code: string;
	user_code: string;
	verification_uri: string;
	expires_in: number;
	interval: number;
};

export type DeviceUser = {
	id?: string;
	username?: string;
	email?: string;
	tier?: string;
};

export type DeviceTokenData = {
	token: string;
	user?: DeviceUser;
};

type DeviceApiEnvelope<TData = unknown> = {
	status?: boolean;
	message?: string;
	data?: TData;
};

export interface DeviceLoginOptions {
	apiBaseUrl?: string;
	provider?: string;
	fetchImpl?: typeof fetch;
	stdout?: Pick<typeof process.stdout, "write">;
	stderr?: Pick<typeof process.stderr, "write">;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
	authStorage?: AuthStorage;
	signal?: AbortSignal;
}

export interface DeviceLoginResult {
	initiateData: DeviceInitiateData;
	tokenData: DeviceTokenData;
	provider: string;
}

export interface DeviceLoginCallbacks {
	onInitiated?: (data: DeviceInitiateData) => void | Promise<void>;
	onPending?: () => void;
}

interface ParsedLoginArgs {
	help: boolean;
	apiBaseUrl: string;
}

function isRecord(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBaseUrl(value: string | undefined): string {
	const raw = value?.trim() || DEFAULT_API_BASE_URL;
	return raw.replace(/\/+$/, "");
}

function parsePositiveNumber(value: unknown, fallback: number): number {
	const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function requireString(value: unknown, field: string): string {
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error(`Invalid device auth response: missing ${field}`);
	}
	return value;
}

function parseInitiateResponse(payload: unknown): DeviceInitiateData {
	if (!isRecord(payload)) throw new Error("Invalid device auth response");
	const envelope = payload as DeviceApiEnvelope<JsonObject>;
	if (envelope.status === false) {
		throw new Error(envelope.message || "Failed to initiate device login");
	}
	if (!isRecord(envelope.data)) throw new Error("Invalid device auth response: missing data");
	return {
		device_code: requireString(envelope.data.device_code, "device_code"),
		user_code: requireString(envelope.data.user_code, "user_code"),
		verification_uri: requireString(envelope.data.verification_uri, "verification_uri"),
		expires_in: parsePositiveNumber(envelope.data.expires_in, 300),
		interval: parsePositiveNumber(envelope.data.interval, 5),
	};
}

function parseTokenResponse(payload: unknown): DeviceTokenData {
	if (!isRecord(payload)) throw new Error("Invalid token response");
	const envelope = payload as DeviceApiEnvelope<JsonObject>;
	if (envelope.status === false) {
		throw new Error(envelope.message || "Device login failed");
	}
	if (!isRecord(envelope.data)) throw new Error("Invalid token response: missing data");
	return {
		token: requireString(envelope.data.token, "token"),
		user: isRecord(envelope.data.user) ? (envelope.data.user as DeviceUser) : undefined,
	};
}

async function readJsonResponse(response: Response): Promise<unknown> {
	const text = await response.text();
	if (!text.trim()) return {};
	try {
		return JSON.parse(text);
	} catch {
		throw new Error(`Invalid JSON response from Neosantara auth service (${response.status})`);
	}
}

async function postJson(
	fetchImpl: typeof fetch,
	url: string,
	body?: JsonObject,
	signal?: AbortSignal,
): Promise<{ response: Response; json: unknown }> {
	const controller = new AbortController();
	const abortFromParent = () => controller.abort();
	if (signal?.aborted) {
		throw new Error("Login cancelled");
	}
	signal?.addEventListener("abort", abortFromParent, { once: true });
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetchImpl(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: body ? JSON.stringify(body) : undefined,
			signal: controller.signal,
		});
		return { response, json: await readJsonResponse(response) };
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			if (signal?.aborted) {
				throw new Error("Login cancelled");
			}
			throw new Error("Neosantara auth request timed out");
		}
		throw error;
	} finally {
		clearTimeout(timeout);
		signal?.removeEventListener("abort", abortFromParent);
	}
}

function formatUser(user: DeviceUser | undefined): string | undefined {
	if (!user) return undefined;
	const name = user.username || user.email || user.id;
	if (!name) return undefined;
	return user.tier ? `${name} (${user.tier})` : name;
}

function printDeviceInstructions(stdout: Pick<typeof process.stdout, "write">, data: DeviceInitiateData): void {
	stdout.write(`${chalk.bold("Neosantara device login")}\n\n`);
	stdout.write(`Open this URL in your browser:\n${chalk.cyan(data.verification_uri)}\n\n`);
	stdout.write(`Enter this code:\n${chalk.bold(data.user_code)}\n\n`);
	stdout.write(chalk.dim(`This code expires in ${data.expires_in} seconds. Waiting for authorization...\n`));
}

function printLoginHelp(stdout: Pick<typeof process.stdout, "write">): void {
	stdout.write(`${chalk.bold("Usage:")}\n  neo login [--api-base <url>]\n\n`);
	stdout.write("Log in to Neosantara using Device Authorization Flow.\n\n");
	stdout.write(`${chalk.bold("Options:")}\n`);
	stdout.write("  --api-base <url>     Auth API base URL (default: https://api.neosantara.xyz)\n");
	stdout.write("  --help, -h           Show this help\n\n");
	stdout.write(`${chalk.bold("Environment:")}\n`);
	stdout.write("  NEOSANTARA_API_BASE_URL  Override auth API base URL\n");
	stdout.write("  NEO_CODE_NEOSANTARA_API_BASE_URL  Override auth API base URL\n");
}

function parseLoginArgs(args: string[]): ParsedLoginArgs {
	let help = false;
	let apiBaseUrl = normalizeBaseUrl(
		process.env.NEOSANTARA_API_BASE_URL || process.env.NEO_CODE_NEOSANTARA_API_BASE_URL,
	);

	for (let index = 1; index < args.length; index++) {
		const arg = args[index];
		if (arg === "--help" || arg === "-h") {
			help = true;
			continue;
		}
		if (arg === "--api-base" || arg === "--api-base-url") {
			const next = args[index + 1];
			if (!next || next.startsWith("-")) {
				throw new Error(`${arg} requires a URL`);
			}
			apiBaseUrl = normalizeBaseUrl(next);
			index++;
			continue;
		}
		if (arg.startsWith("--api-base=")) {
			apiBaseUrl = normalizeBaseUrl(arg.slice("--api-base=".length));
			continue;
		}
		throw new Error(`Unknown login option: ${arg}`);
	}

	return { help, apiBaseUrl };
}

async function pollForToken(
	fetchImpl: typeof fetch,
	apiBaseUrl: string,
	deviceCode: string,
	options: {
		intervalMs: number;
		expiresAt: number;
		now: () => number;
		sleep: (ms: number) => Promise<void>;
		stdout: Pick<typeof process.stdout, "write">;
		signal?: AbortSignal;
		onPending?: () => void;
	},
): Promise<DeviceTokenData> {
	let intervalMs = options.intervalMs;
	let dotCount = 0;

	while (options.now() <= options.expiresAt + EXTRA_EXPIRY_GRACE_MS) {
		if (options.signal?.aborted) {
			throw new Error("Login cancelled");
		}
		await options.sleep(intervalMs);
		if (options.signal?.aborted) {
			throw new Error("Login cancelled");
		}
		const { response, json } = await postJson(
			fetchImpl,
			`${apiBaseUrl}/auth/cli/token`,
			{ device_code: deviceCode },
			options.signal,
		);

		if (response.status === 202) {
			dotCount = (dotCount + 1) % 12;
			options.onPending?.();
			options.stdout.write(
				`\r${chalk.dim(`Waiting for authorization${".".repeat(dotCount + 1)}${" ".repeat(12 - dotCount)}`)}`,
			);
			continue;
		}

		if (response.status === 429) {
			intervalMs = Math.min(intervalMs + 5_000, 30_000);
			continue;
		}

		if (response.ok) {
			options.stdout.write("\n");
			return parseTokenResponse(json);
		}

		const message = isRecord(json) && typeof json.message === "string" ? json.message : response.statusText;
		throw new Error(message || `Device login failed (${response.status})`);
	}

	throw new Error("Device code expired before authorization completed");
}

export async function loginWithNeosantaraDeviceAuth(
	options: DeviceLoginOptions & DeviceLoginCallbacks = {},
): Promise<DeviceLoginResult> {
	const provider = options.provider ?? DEFAULT_PROVIDER;
	const apiBaseUrl = normalizeBaseUrl(
		options.apiBaseUrl || process.env.NEOSANTARA_API_BASE_URL || process.env.NEO_CODE_NEOSANTARA_API_BASE_URL,
	);
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (!fetchImpl) {
		throw new Error("this Node.js runtime does not provide fetch. Use Node.js 20 or newer.");
	}

	const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
	const now = options.now ?? (() => Date.now());
	const authStorage = options.authStorage ?? AuthStorage.create();
	const stdout = options.stdout ?? process.stdout;

	const { response, json } = await postJson(fetchImpl, `${apiBaseUrl}/auth/cli/initiate`, undefined, options.signal);
	if (!response.ok) {
		const message = isRecord(json) && typeof json.message === "string" ? json.message : response.statusText;
		throw new Error(message || `Failed to initiate device login (${response.status})`);
	}

	const initiateData = parseInitiateResponse(json);
	await options.onInitiated?.(initiateData);

	const tokenData = await pollForToken(fetchImpl, apiBaseUrl, initiateData.device_code, {
		intervalMs: Math.max(1, initiateData.interval) * 1_000,
		expiresAt: now() + initiateData.expires_in * 1_000,
		now,
		sleep,
		stdout,
		signal: options.signal,
		onPending: options.onPending,
	});

	authStorage.set(provider, { type: "api_key", key: tokenData.token });

	return { initiateData, tokenData, provider };
}

export async function runNeosantaraDeviceLogin(args: string[], options: DeviceLoginOptions = {}): Promise<void> {
	const stdout = options.stdout ?? process.stdout;
	const stderr = options.stderr ?? process.stderr;
	let parsed: ParsedLoginArgs;
	try {
		parsed = parseLoginArgs(args);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		stderr.write(`${chalk.red(`Error: ${message}`)}\n`);
		stderr.write("Use 'neo login --help' for usage.\n");
		process.exitCode = 1;
		return;
	}

	if (parsed.help) {
		printLoginHelp(stdout);
		return;
	}

	if (options.apiBaseUrl) {
		parsed.apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl);
	}

	const provider = options.provider ?? DEFAULT_PROVIDER;
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (!fetchImpl) {
		stderr.write(chalk.red("Error: this Node.js runtime does not provide fetch. Use Node.js 20 or newer.\n"));
		process.exitCode = 1;
		return;
	}

	const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
	const now = options.now ?? (() => Date.now());
	const authStorage = options.authStorage ?? AuthStorage.create();

	try {
		const { tokenData } = await loginWithNeosantaraDeviceAuth({
			...options,
			apiBaseUrl: parsed.apiBaseUrl,
			fetchImpl,
			sleep,
			now,
			authStorage,
			stdout,
			onInitiated: (initiateData) => {
				printDeviceInstructions(stdout, initiateData);
			},
		});

		const userLabel = formatUser(tokenData.user);
		stdout.write(`${chalk.green("✓")} Logged in to Neosantara${userLabel ? ` as ${userLabel}` : ""}.\n`);
		stdout.write(chalk.dim(`Saved credential for provider "${provider}" in auth.json.\n`));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		stderr.write(`${chalk.red(`Error: ${message}`)}\n`);
		process.exitCode = 1;
	}
}
