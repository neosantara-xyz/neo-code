import { resolve } from "node:path";
import { LspClient } from "./client.js";
import {
	detectAllLspBinaries,
	detectLspBinary,
	findLspForFile,
	LSP_REGISTRY,
	type LspBinaryAvailability,
	type LspServerConfig,
} from "./registry.js";

export interface LspManagerStatus {
	workspaceRoot: string;
	servers: Array<{
		config: LspServerConfig;
		installed: boolean;
		resolvedPath?: string;
		started: boolean;
	}>;
}

class LspManager {
	private clients = new Map<string, LspClient>();
	private logs = new Map<string, string[]>();
	private workspaceRoot: string;
	private cleanupRegistered = false;

	constructor(workspaceRoot: string) {
		this.workspaceRoot = resolve(workspaceRoot);
	}

	getWorkspaceRoot(): string {
		return this.workspaceRoot;
	}

	setWorkspaceRoot(workspaceRoot: string): void {
		const next = resolve(workspaceRoot);
		if (next === this.workspaceRoot) return;
		void this.shutdown();
		this.workspaceRoot = next;
	}

	listServerAvailability(): LspBinaryAvailability[] {
		return detectAllLspBinaries();
	}

	async getClientForFile(filePath: string): Promise<LspClient | undefined> {
		const config = findLspForFile(filePath);
		if (!config) return undefined;
		return this.getClient(config.id);
	}

	async getClient(serverId: string): Promise<LspClient | undefined> {
		const config = LSP_REGISTRY.find((entry) => entry.id === serverId);
		if (!config) return undefined;
		const existing = this.clients.get(config.id);
		if (existing?.isStarted) return existing;
		const availability = detectLspBinary(config);
		if (!availability.installed) return undefined;
		const buffer = this.logs.get(config.id) ?? [];
		this.logs.set(config.id, buffer);
		const client = new LspClient(config, {
			workspaceRoot: this.workspaceRoot,
			logBuffer: buffer,
		});
		this.clients.set(config.id, client);
		this.registerCleanup();
		try {
			await client.ensureStarted();
		} catch (err) {
			buffer.push(`[${new Date().toISOString()}] start failed: ${(err as Error).message}`);
			this.clients.delete(config.id);
			void client.dispose();
			return undefined;
		}
		return client;
	}

	getStatus(): LspManagerStatus {
		const availability = this.listServerAvailability();
		return {
			workspaceRoot: this.workspaceRoot,
			servers: availability.map((entry) => ({
				config: entry.config,
				installed: entry.installed,
				resolvedPath: entry.resolvedPath,
				started: this.clients.get(entry.config.id)?.isStarted ?? false,
			})),
		};
	}

	getLogs(serverId: string): readonly string[] {
		return this.logs.get(serverId) ?? [];
	}

	async restart(serverId: string): Promise<boolean> {
		const client = this.clients.get(serverId);
		if (client) {
			await client.dispose();
			this.clients.delete(serverId);
		}
		const next = await this.getClient(serverId);
		return Boolean(next);
	}

	async shutdown(): Promise<void> {
		const tasks = Array.from(this.clients.values()).map((client) => client.dispose());
		this.clients.clear();
		await Promise.allSettled(tasks);
	}

	private registerCleanup(): void {
		if (this.cleanupRegistered) return;
		this.cleanupRegistered = true;
		const handler = () => {
			void this.shutdown();
		};
		process.once("exit", handler);
		process.once("SIGINT", handler);
		process.once("SIGTERM", handler);
	}
}

let activeManager: LspManager | undefined;

export function getLspManager(workspaceRoot: string): LspManager {
	if (!activeManager) {
		activeManager = new LspManager(workspaceRoot);
	} else {
		activeManager.setWorkspaceRoot(workspaceRoot);
	}
	return activeManager;
}

export async function shutdownLspManager(): Promise<void> {
	if (!activeManager) return;
	await activeManager.shutdown();
}

export type { LspManager };
