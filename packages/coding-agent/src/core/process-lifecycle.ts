import { stopThemeWatcher } from "../modes/interactive/theme/theme.js";
import { restoreStdout } from "./output-guard.js";

let globalHandlersInstalled = false;
let fatalExitInProgress = false;

function formatError(error: unknown): string {
	if (error instanceof Error) {
		return error.stack || error.message;
	}
	return String(error);
}

export function runProcessCleanup(): void {
	try {
		stopThemeWatcher();
	} catch {
		// Ignore cleanup failures while exiting.
	}
	try {
		restoreStdout();
	} catch {
		// Ignore cleanup failures while exiting.
	}
}

export function exitAfterCleanup(code: number): never {
	runProcessCleanup();
	process.exit(code);
}

function handleFatalError(kind: "uncaughtException" | "unhandledRejection", error: unknown): void {
	if (fatalExitInProgress) {
		return;
	}
	fatalExitInProgress = true;
	runProcessCleanup();
	process.stderr.write(`Fatal ${kind}: ${formatError(error)}\n`);
	process.exitCode = 1;
	setImmediate(() => process.exit(1));
}

export function installGlobalErrorHandlers(): void {
	if (globalHandlersInstalled) {
		return;
	}
	globalHandlersInstalled = true;
	process.on("uncaughtException", (error) => handleFatalError("uncaughtException", error));
	process.on("unhandledRejection", (reason) => handleFatalError("unhandledRejection", reason));
}
