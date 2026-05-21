import { type SpawnSyncOptions, spawn, spawnSync } from "child_process";
import { platform } from "os";
import { isWaylandSession } from "./clipboard-image.js";
import { clipboard } from "./clipboard-native.js";

type NativeClipboardSpawnOptions = Pick<SpawnSyncOptions, "input" | "timeout" | "stdio"> & {
	input: string;
	timeout: number;
	stdio: ["pipe", "ignore", "ignore"];
};

function spawnClipboardCommand(command: string, args: readonly string[], options: NativeClipboardSpawnOptions): void {
	const result = spawnSync(command, [...args], {
		input: options.input,
		timeout: options.timeout,
		stdio: options.stdio,
		shell: false,
		windowsHide: true,
	});
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? "unknown"}`);
}

function commandExists(command: string): boolean {
	const result = spawnSync("which", [command], {
		stdio: "ignore",
		timeout: 2000,
		shell: false,
		windowsHide: true,
	});
	return !result.error && result.status === 0;
}

function copyToX11Clipboard(options: NativeClipboardSpawnOptions): void {
	try {
		spawnClipboardCommand("xclip", ["-selection", "clipboard"], options);
	} catch {
		spawnClipboardCommand("xsel", ["--clipboard", "--input"], options);
	}
}

const MAX_OSC52_ENCODED_LENGTH = 100_000;

function isRemoteSession(env: NodeJS.ProcessEnv = process.env): boolean {
	return Boolean(env.SSH_CONNECTION || env.SSH_CLIENT || env.MOSH_CONNECTION);
}

function emitOsc52(text: string): boolean {
	const encoded = Buffer.from(text).toString("base64");
	if (encoded.length > MAX_OSC52_ENCODED_LENGTH) {
		return false;
	}
	process.stdout.write(`\x1b]52;c;${encoded}\x07`);
	return true;
}

export async function copyToClipboard(text: string): Promise<void> {
	let copied = false;

	const p = platform();

	// Prefer direct clipboard writes. Emitting OSC 52 first can make terminals
	// write the same native clipboard concurrently with the addon, and very large
	// OSC 52 payloads can desynchronize terminal rendering.
	//
	// On Linux, skip the native addon. The underlying `clipboard-rs` crate is
	// X11-only and does not retain selection ownership after `set_text`
	// resolves, so on Wayland-only compositors (Hyprland, Niri, ...) and even
	// some X11 sessions the call resolves successfully without populating the
	// clipboard. The platform tools below (wl-copy, xclip, xsel) properly
	// daemonize and keep ownership.
	try {
		if (clipboard && p !== "linux") {
			await clipboard.setText(text);
			copied = true;
		}
	} catch {
		// Fall through to platform-specific clipboard tools.
	}

	const remote = isRemoteSession();
	if (copied && !remote) {
		return;
	}

	const options: NativeClipboardSpawnOptions = { input: text, timeout: 5000, stdio: ["pipe", "ignore", "ignore"] };

	if (!copied) {
		try {
			if (p === "darwin") {
				spawnClipboardCommand("pbcopy", [], options);
				copied = true;
			} else if (p === "win32") {
				spawnClipboardCommand("clip", [], options);
				copied = true;
			} else {
				// Linux. Try Termux, Wayland, or X11 clipboard tools.
				if (process.env.TERMUX_VERSION) {
					try {
						spawnClipboardCommand("termux-clipboard-set", [], options);
						copied = true;
					} catch {
						// Fall back to Wayland or X11 tools.
					}
				}

				if (!copied) {
					const hasWaylandDisplay = Boolean(process.env.WAYLAND_DISPLAY);
					const hasX11Display = Boolean(process.env.DISPLAY);
					const isWayland = isWaylandSession();
					if (isWayland && hasWaylandDisplay) {
						try {
							// wl-copy with spawnSync can hang due to fork behavior; use spawn instead.
							if (!commandExists("wl-copy")) throw new Error("wl-copy is not available");
							const proc = spawn("wl-copy", [], { stdio: ["pipe", "ignore", "ignore"] });
							proc.stdin.on("error", () => {
								// Ignore EPIPE errors if wl-copy exits early.
							});
							proc.stdin.write(text);
							proc.stdin.end();
							proc.unref();
							copied = true;
						} catch {
							if (hasX11Display) {
								copyToX11Clipboard(options);
								copied = true;
							}
						}
					} else if (hasX11Display) {
						copyToX11Clipboard(options);
						copied = true;
					}
				}
			}
		} catch {
			// Fall through to OSC 52 fallback.
		}
	}

	if (remote || !copied) {
		const osc52Copied = emitOsc52(text);
		copied = copied || osc52Copied;
	}

	if (!copied) {
		throw new Error("Failed to copy to clipboard");
	}
}
