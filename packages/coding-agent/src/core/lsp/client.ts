import { type ChildProcess, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	createMessageConnection,
	type MessageConnection,
	StreamMessageReader,
	StreamMessageWriter,
} from "vscode-jsonrpc/lib/node/main.js";
import { getLspLanguageId, type LspServerConfig } from "./registry.js";

export interface LspLocation {
	uri: string;
	range: {
		start: { line: number; character: number };
		end: { line: number; character: number };
	};
}

export interface LspWorkspaceSymbol {
	name: string;
	kind: number;
	containerName?: string;
	location: LspLocation;
}

export interface LspClientOptions {
	workspaceRoot: string;
	logBuffer?: string[];
	maxLogLines?: number;
	startTimeoutMs?: number;
}

const SYMBOL_KIND_NAMES: Record<number, string> = {
	1: "File",
	2: "Module",
	3: "Namespace",
	4: "Package",
	5: "Class",
	6: "Method",
	7: "Property",
	8: "Field",
	9: "Constructor",
	10: "Enum",
	11: "Interface",
	12: "Function",
	13: "Variable",
	14: "Constant",
	15: "String",
	16: "Number",
	17: "Boolean",
	18: "Array",
	19: "Object",
	20: "Key",
	21: "Null",
	22: "EnumMember",
	23: "Struct",
	24: "Event",
	25: "Operator",
	26: "TypeParameter",
};

export function lspSymbolKindName(kind: number): string {
	return SYMBOL_KIND_NAMES[kind] ?? `Kind${kind}`;
}

export function lspLocationToString(location: LspLocation, workspaceRoot: string): string {
	const filePath = lspUriToPath(location.uri);
	const display = filePath.startsWith(workspaceRoot)
		? filePath.slice(workspaceRoot.length).replace(/^[\\/]+/, "")
		: filePath;
	return `${display}:${location.range.start.line + 1}:${location.range.start.character + 1}`;
}

export function lspUriToPath(uri: string): string {
	if (uri.startsWith("file://")) {
		try {
			return decodeURIComponent(new URL(uri).pathname);
		} catch {
			return uri.replace("file://", "");
		}
	}
	return uri;
}

export class LspClient {
	private process: ChildProcess | undefined;
	private connection: MessageConnection | undefined;
	private initializePromise: Promise<void> | undefined;
	private openedDocuments = new Set<string>();
	private logBuffer: string[];
	private maxLogLines: number;
	private startTimeoutMs: number;
	private disposed = false;

	constructor(
		readonly config: LspServerConfig,
		private readonly options: LspClientOptions,
	) {
		this.logBuffer = options.logBuffer ?? [];
		this.maxLogLines = options.maxLogLines ?? 200;
		this.startTimeoutMs = options.startTimeoutMs ?? 10_000;
	}

	get isStarted(): boolean {
		return this.connection !== undefined && !this.disposed;
	}

	getLogs(): readonly string[] {
		return this.logBuffer;
	}

	async ensureStarted(): Promise<void> {
		if (this.disposed) throw new Error(`LSP client for ${this.config.id} has been disposed`);
		if (!this.initializePromise) {
			this.initializePromise = this.start();
		}
		return this.initializePromise;
	}

	private async start(): Promise<void> {
		const child = spawn(this.config.command, this.config.args, {
			cwd: this.options.workspaceRoot,
			stdio: ["pipe", "pipe", "pipe"],
		});
		this.process = child;
		child.on("error", (err) => this.appendLog(`process error: ${err.message}`));
		child.on("exit", (code, signal) => {
			this.appendLog(`process exited code=${code ?? "?"} signal=${signal ?? "-"}`);
			this.connection?.dispose();
			this.connection = undefined;
		});
		child.stderr?.setEncoding("utf8");
		child.stderr?.on("data", (chunk: string) => {
			for (const line of chunk.split(/\r?\n/)) {
				if (line.trim()) this.appendLog(`stderr: ${line}`);
			}
		});

		if (!child.stdout || !child.stdin) {
			throw new Error(`LSP server ${this.config.id} did not expose stdio streams`);
		}

		const connection = createMessageConnection(
			new StreamMessageReader(child.stdout),
			new StreamMessageWriter(child.stdin),
		);
		this.connection = connection;
		connection.onError((event) => {
			const err = event[0];
			this.appendLog(`connection error: ${err.message}`);
		});
		connection.onClose(() => this.appendLog("connection closed"));
		connection.onNotification("window/logMessage", (params: { type?: number; message?: string }) => {
			if (params.message) this.appendLog(`log[${params.type ?? "?"}]: ${params.message}`);
		});
		connection.onNotification("textDocument/publishDiagnostics", () => {
			// ignore for now
		});
		connection.listen();

		const initializeParams = {
			processId: process.pid,
			rootUri: pathToFileURL(this.options.workspaceRoot).toString(),
			rootPath: this.options.workspaceRoot,
			workspaceFolders: [
				{
					uri: pathToFileURL(this.options.workspaceRoot).toString(),
					name: this.options.workspaceRoot,
				},
			],
			capabilities: {
				workspace: {
					symbol: { dynamicRegistration: false },
					workspaceFolders: true,
					configuration: false,
				},
				textDocument: {
					synchronization: { didSave: false, willSave: false, dynamicRegistration: false },
					definition: { linkSupport: false },
					references: { dynamicRegistration: false },
					documentSymbol: { dynamicRegistration: false, hierarchicalDocumentSymbolSupport: true },
				},
			},
			initializationOptions: {},
			trace: "off",
		};

		const initialize = connection.sendRequest("initialize", initializeParams) as Promise<unknown>;
		await this.withTimeout(initialize, this.startTimeoutMs, `${this.config.id} initialize timed out`);
		await connection.sendNotification("initialized", {});
	}

	private appendLog(line: string): void {
		const stamp = new Date().toISOString();
		this.logBuffer.push(`[${stamp}] ${line}`);
		while (this.logBuffer.length > this.maxLogLines) this.logBuffer.shift();
	}

	private async withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
		let timer: NodeJS.Timeout | undefined;
		const timeout = new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error(message)), ms);
		});
		try {
			return await Promise.race([promise, timeout]);
		} finally {
			if (timer) clearTimeout(timer);
		}
	}

	async openDocument(filePath: string): Promise<void> {
		await this.ensureStarted();
		if (this.openedDocuments.has(filePath)) return;
		const absolute = isAbsolute(filePath) ? filePath : resolve(this.options.workspaceRoot, filePath);
		let text: string;
		try {
			text = await readFile(absolute, "utf8");
		} catch (err) {
			this.appendLog(`openDocument read failed: ${(err as Error).message}`);
			return;
		}
		const uri = pathToFileURL(absolute).toString();
		const languageId = getLspLanguageId(this.config, absolute);
		await this.connection?.sendNotification("textDocument/didOpen", {
			textDocument: {
				uri,
				languageId,
				version: 1,
				text,
			},
		});
		this.openedDocuments.add(filePath);
	}

	async workspaceSymbol(query: string): Promise<LspWorkspaceSymbol[]> {
		await this.ensureStarted();
		try {
			const result = (await this.connection?.sendRequest("workspace/symbol", { query })) as
				| LspWorkspaceSymbol[]
				| null
				| undefined;
			return Array.isArray(result) ? result : [];
		} catch (err) {
			this.appendLog(`workspace/symbol failed: ${(err as Error).message}`);
			return [];
		}
	}

	async definition(filePath: string, line: number, character: number): Promise<LspLocation[]> {
		await this.ensureStarted();
		await this.openDocument(filePath);
		const absolute = isAbsolute(filePath) ? filePath : resolve(this.options.workspaceRoot, filePath);
		const uri = pathToFileURL(absolute).toString();
		try {
			const result = (await this.connection?.sendRequest("textDocument/definition", {
				textDocument: { uri },
				position: { line, character },
			})) as LspLocation | LspLocation[] | null | undefined;
			if (!result) return [];
			return Array.isArray(result) ? result : [result];
		} catch (err) {
			this.appendLog(`textDocument/definition failed: ${(err as Error).message}`);
			return [];
		}
	}

	async references(filePath: string, line: number, character: number): Promise<LspLocation[]> {
		await this.ensureStarted();
		await this.openDocument(filePath);
		const absolute = isAbsolute(filePath) ? filePath : resolve(this.options.workspaceRoot, filePath);
		const uri = pathToFileURL(absolute).toString();
		try {
			const result = (await this.connection?.sendRequest("textDocument/references", {
				textDocument: { uri },
				position: { line, character },
				context: { includeDeclaration: true },
			})) as LspLocation[] | null | undefined;
			return Array.isArray(result) ? result : [];
		} catch (err) {
			this.appendLog(`textDocument/references failed: ${(err as Error).message}`);
			return [];
		}
	}

	async dispose(): Promise<void> {
		if (this.disposed) return;
		this.disposed = true;
		const connection = this.connection;
		const child = this.process;
		this.connection = undefined;
		this.process = undefined;
		if (connection) {
			try {
				await this.withTimeout(connection.sendRequest("shutdown") as Promise<void>, 2000, "shutdown timeout");
				connection.sendNotification("exit").catch(() => undefined);
			} catch (err) {
				this.appendLog(`shutdown failed: ${(err as Error).message}`);
			}
			try {
				connection.dispose();
			} catch {
				// ignore
			}
		}
		if (child && !child.killed) {
			child.kill("SIGTERM");
			setTimeout(() => {
				try {
					child.kill("SIGKILL");
				} catch {
					// Process already exited — ignore.
				}
			}, 1500).unref();
		}
	}
}
