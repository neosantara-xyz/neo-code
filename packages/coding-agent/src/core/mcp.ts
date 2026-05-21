import { spawn } from "node:child_process";
import { VERSION } from "../config.js";

export interface McpServerConfig {
	command: string;
	args?: string[];
	env?: Record<string, string>;
}

export type McpServersSettings = Record<string, McpServerConfig>;

export interface McpToolInfo {
	server: string;
	name: string;
	description?: string;
	inputSchema?: unknown;
}

interface JsonRpcRequest {
	jsonrpc: "2.0";
	id: number;
	method: string;
	params?: unknown;
}

interface JsonRpcResponse {
	jsonrpc?: string;
	id?: number;
	result?: unknown;
	error?: { message?: string; code?: number; data?: unknown };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateMcpServers(value: unknown): McpServersSettings {
	if (!isRecord(value)) return {};
	const result: McpServersSettings = {};
	for (const [name, raw] of Object.entries(value)) {
		if (!isRecord(raw) || typeof raw.command !== "string" || raw.command.trim().length === 0) continue;
		const args = Array.isArray(raw.args)
			? raw.args.filter((arg): arg is string => typeof arg === "string")
			: undefined;
		const env = isRecord(raw.env)
			? Object.fromEntries(
					Object.entries(raw.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
				)
			: undefined;
		result[name] = { command: raw.command, ...(args ? { args } : {}), ...(env ? { env } : {}) };
	}
	return result;
}

function encodeMessage(payload: unknown): string {
	const body = JSON.stringify(payload);
	return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function decodeMessages(buffer: Buffer): { messages: unknown[]; rest: Buffer<ArrayBufferLike> } {
	const messages: unknown[] = [];
	let rest = buffer;
	while (true) {
		const headerEnd = rest.indexOf("\r\n\r\n");
		if (headerEnd === -1) break;
		const header = rest.slice(0, headerEnd).toString("utf8");
		const match = header.match(/content-length:\s*(\d+)/i);
		if (!match) {
			rest = rest.slice(headerEnd + 4);
			continue;
		}
		const length = Number(match[1]);
		const bodyStart = headerEnd + 4;
		const bodyEnd = bodyStart + length;
		if (rest.length < bodyEnd) break;
		const body = rest.slice(bodyStart, bodyEnd).toString("utf8");
		messages.push(JSON.parse(body));
		rest = rest.slice(bodyEnd);
	}
	return { messages, rest };
}

export class McpClientError extends Error {}

export async function withMcpServer<T>(
	name: string,
	config: McpServerConfig,
	callback: (request: (method: string, params?: unknown) => Promise<unknown>) => Promise<T>,
	options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
	const timeoutMs = options.timeoutMs ?? 15_000;
	const child = spawn(config.command, config.args ?? [], {
		env: { ...process.env, ...(config.env ?? {}) },
		stdio: ["pipe", "pipe", "pipe"],
	});
	let nextId = 1;
	let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
	let stderr = "";
	const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
	let settled = false;

	const failAll = (error: Error): void => {
		for (const waiter of pending.values()) waiter.reject(error);
		pending.clear();
	};

	const abortHandler = (): void => {
		const error = new McpClientError(`MCP server ${name} aborted`);
		failAll(error);
		child.kill();
	};
	options.signal?.addEventListener("abort", abortHandler, { once: true });

	child.stdout?.on("data", (chunk: Buffer) => {
		try {
			buffer = Buffer.concat([buffer, chunk]);
			const decoded = decodeMessages(buffer);
			buffer = decoded.rest;
			for (const message of decoded.messages) {
				if (!isRecord(message) || typeof message.id !== "number") continue;
				const waiter = pending.get(message.id);
				if (!waiter) continue;
				pending.delete(message.id);
				const response = message as JsonRpcResponse;
				if (response.error) {
					waiter.reject(new McpClientError(response.error.message ?? `MCP request ${message.id} failed`));
				} else {
					waiter.resolve(response.result);
				}
			}
		} catch (error) {
			failAll(error instanceof Error ? error : new McpClientError(String(error)));
		}
	});
	child.stderr?.on("data", (chunk: Buffer) => {
		stderr += chunk.toString("utf8");
		if (stderr.length > 8192) stderr = stderr.slice(-8192);
	});
	child.on("error", (error) => failAll(error));
	child.on("close", (code) => {
		if (!settled && pending.size > 0) {
			failAll(
				new McpClientError(
					`MCP server ${name} exited with code ${code ?? "unknown"}${stderr ? `: ${stderr.trim()}` : ""}`,
				),
			);
		}
	});

	const request = (method: string, params?: unknown): Promise<unknown> => {
		const id = nextId++;
		const payload: JsonRpcRequest = { jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) };
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				pending.delete(id);
				reject(new McpClientError(`MCP request timed out: ${method}`));
				child.kill();
			}, timeoutMs);
			pending.set(id, {
				resolve: (value) => {
					clearTimeout(timer);
					resolve(value);
				},
				reject: (error) => {
					clearTimeout(timer);
					reject(error);
				},
			});
			child.stdin?.write(encodeMessage(payload));
		});
	};

	try {
		await request("initialize", {
			protocolVersion: "2024-11-05",
			capabilities: {},
			clientInfo: { name: "neo-code", version: VERSION },
		});
		child.stdin?.write(encodeMessage({ jsonrpc: "2.0", method: "notifications/initialized" }));
		const result = await callback(request);
		settled = true;
		return result;
	} finally {
		options.signal?.removeEventListener("abort", abortHandler);
		child.kill();
	}
}

export function parseMcpToolsList(server: string, payload: unknown): McpToolInfo[] {
	if (!isRecord(payload) || !Array.isArray(payload.tools)) return [];
	return payload.tools
		.filter((tool): tool is Record<string, unknown> => isRecord(tool) && typeof tool.name === "string")
		.map((tool) => ({
			server,
			name: tool.name as string,
			description: typeof tool.description === "string" ? tool.description : undefined,
			inputSchema: tool.inputSchema,
		}));
}
