import assert from "node:assert";
import { describe, it } from "node:test";
import { Loader } from "../src/components/loader.js";
import type { TUI } from "../src/tui.js";

class FakeTui {
	renderRequests = 0;
	requestRender(): void {
		this.renderRequests += 1;
	}
}

function withMockedDateNow<T>(value: { now: number }, run: () => T): T {
	const original = Date.now;
	Date.now = () => value.now;
	try {
		return run();
	} finally {
		Date.now = original;
	}
}

// Strip ANSI SGR sequences for assertions about plain-text content of the
// loader output. Loader v2 may wrap individual graphemes in bold escapes when
// `shimmerBoldCenter` is enabled, which would otherwise break naive substring
// matches in tests.
function stripAnsi(value: string): string {
	return value.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
}

describe("Loader", () => {
	it("renders a Claude-style right-to-left glimmer with continuous phase math", () => {
		const clock = { now: 0 };
		withMockedDateNow(clock, () => {
			const tui = new FakeTui();
			// At t=880ms with sweepMs=2000 the right-to-left phase places the
			// shimmer band over the trailing characters of the 5-cell message
			// (band center ≈ 4, halfWidth=1 → covers indices 3 and 4).
			const loader = new Loader(
				tui as unknown as TUI,
				(text) => `[${text}]`,
				(text) => text,
				"abcde",
				{
					frames: ["·", "✢"],
					intervalMs: 120,
					shimmer: true,
					shimmerColorFn: (text) => text.toUpperCase(),
					shimmerWidth: 3,
					shimmerSweepMs: 2000,
					shimmerBoldCenter: false,
					animationsEnabled: true,
				},
			);

			try {
				clock.now = 880;
				loader.setMessage("abcde");
				const line = stripAnsi(loader.render(40).join("\n"));

				assert.match(line, /abcDE/);
				assert.ok(tui.renderRequests > 0);
			} finally {
				loader.stop();
			}
		});
	});

	it("uses the slower Claude-style response sweep period by default", () => {
		const clock = { now: 0 };
		withMockedDateNow(clock, () => {
			const tui = new FakeTui();
			const loader = new Loader(
				tui as unknown as TUI,
				(text) => `[${text}]`,
				(text) => text,
				"abcde",
				{
					frames: ["·"],
					shimmer: true,
					shimmerColorFn: (text) => text.toUpperCase(),
					shimmerWidth: 3,
					shimmerBoldCenter: false,
					animationsEnabled: true,
				},
			);

			try {
				clock.now = 880;
				loader.setMessage("abcde");
				const line = stripAnsi(loader.render(40).join("\n"));

				assert.match(line, /abcDE/);
			} finally {
				loader.stop();
			}
		});
	});

	it("keeps a travelling glimmer in tool-input mode", () => {
		const clock = { now: 0 };
		withMockedDateNow(clock, () => {
			const tui = new FakeTui();
			const loader = new Loader(
				tui as unknown as TUI,
				(text) => `[${text}]`,
				(text) => text,
				"preparing tool…",
				{
					frames: [],
					mode: "tool-input",
					shimmer: true,
					shimmerColorFn: (text) => text.toUpperCase(),
					shimmerWidth: 3,
					shimmerBoldCenter: false,
					animationsEnabled: true,
				},
			);

			try {
				clock.now = 800;
				loader.setMessage("preparing tool…");
				const line = stripAnsi(loader.render(40).join("\n"));

				assert.match(line, /[A-Z]/);
				assert.doesNotMatch(line, /✦/);
			} finally {
				loader.stop();
			}
		});
	});

	it("pulses the whole message in tool-use mode without adding a second symbol", () => {
		const clock = { now: 0 };
		withMockedDateNow(clock, () => {
			const tui = new FakeTui();
			const loader = new Loader(
				tui as unknown as TUI,
				(text) => `[${text}]`,
				(text) => text,
				"searching files…",
				{
					frames: [],
					mode: "tool-use",
					shimmer: true,
					shimmerColorFn: (text) => text.toUpperCase(),
					animationsEnabled: true,
				},
			);

			try {
				clock.now = 2600;
				loader.setMessage("searching files…");
				const line = loader.render(40).join("\n");

				assert.match(line, /SEARCHING FILES/);
				assert.doesNotMatch(line, /✦/);
			} finally {
				loader.stop();
			}
		});
	});

	it("keeps the working loader to one stable line when the message changes length", () => {
		const clock = { now: 0 };
		withMockedDateNow(clock, () => {
			const tui = new FakeTui();
			const loader = new Loader(
				tui as unknown as TUI,
				(text) => `[${text}]`,
				(text) => text,
				"short",
				{
					frames: ["·"],
					shimmer: true,
					shimmerColorFn: (text) => text.toUpperCase(),
					maxMessageWidth: 18,
					animationsEnabled: true,
				},
			);

			try {
				clock.now = 2000;
				loader.setMessage("checking a much longer status label");
				const lines = loader.render(28);

				assert.equal(lines.length, 2);
				assert.match(lines.join("\n"), /checking a much/);
				assert.match(lines.join("\n"), /\.\.\./);
			} finally {
				loader.stop();
			}
		});
	});

	it("shows Claude-style elapsed time and streamed output token estimate after threshold", () => {
		const clock = { now: 0 };
		withMockedDateNow(clock, () => {
			const tui = new FakeTui();
			const loader = new Loader(
				tui as unknown as TUI,
				(text) => `[${text}]`,
				(text) => text,
				"ngulik...",
				{
					frames: [],
					showStatus: true,
					elapsedAfterMs: 0,
					tokensAfterMs: 0,
					statusColorFn: (text) => `DIM(${text})`,
					animationsEnabled: true,
				},
			);

			try {
				clock.now = 32_000;
				loader.setStalledDetectionState(400, false);
				const line = loader.render(80).join("\n");

				assert.match(line, /DIM\( \(32s · ↓ 100 tokens\)\)/);
			} finally {
				loader.stop();
			}
		});
	});

	it("fades the loader toward warning/error when streaming stalls without active tools", () => {
		const clock = { now: 0 };
		withMockedDateNow(clock, () => {
			const tui = new FakeTui();
			const loader = new Loader(
				tui as unknown as TUI,
				(text) => `[${text}]`,
				(text) => text,
				"ngulik...",
				{
					frames: ["·"],
					stalledDetection: true,
					stalledAfterMs: 3000,
					stalledFadeMs: 2000,
					stalledWarningColorFn: (text) => `WARN(${text})`,
					stalledColorFn: (text) => `ERR(${text})`,
					animationsEnabled: true,
				},
			);

			try {
				clock.now = 4100;
				loader.setStalledDetectionState(0, false);
				assert.match(loader.render(40).join("\n"), /WARN\(ngulik\.\.\.\)/);

				clock.now = 5200;
				loader.setStalledDetectionState(0, false);
				assert.match(loader.render(40).join("\n"), /ERR\(ngulik\.\.\.\)/);

				clock.now = 9000;
				loader.setStalledDetectionState(0, true);
				const activeToolLine = loader.render(40).join("\n");
				assert.doesNotMatch(activeToolLine, /ERR\(/);
				assert.doesNotMatch(activeToolLine, /WARN\(/);
			} finally {
				loader.stop();
			}
		});
	});

	it("disables shimmer animation when stdout is not a TTY (NO_COLOR / CI / piped)", () => {
		const clock = { now: 0 };
		withMockedDateNow(clock, () => {
			const tui = new FakeTui();
			const loader = new Loader(
				tui as unknown as TUI,
				(text) => `[${text}]`,
				(text) => text,
				"abcde",
				{
					frames: [],
					shimmer: true,
					shimmerColorFn: (text) => text.toUpperCase(),
					shimmerBoldCenter: false,
					animationsEnabled: false,
				},
			);

			try {
				clock.now = 880;
				loader.setMessage("abcde");
				const line = stripAnsi(loader.render(40).join("\n"));

				// No characters should be uppercased: the band never travels.
				assert.match(line, /abcde/);
				assert.doesNotMatch(line, /[A-Z]/);
			} finally {
				loader.stop();
			}
		});
	});

	it("skips redraws when the rendered output is byte-for-byte identical", () => {
		const clock = { now: 0 };
		withMockedDateNow(clock, () => {
			const tui = new FakeTui();
			const loader = new Loader(
				tui as unknown as TUI,
				(text) => `[${text}]`,
				(text) => text,
				"abcde",
				{
					frames: [],
					shimmer: false,
					animationsEnabled: false,
				},
			);

			try {
				clock.now = 1000;
				loader.setMessage("abcde");
				const initialRequests = tui.renderRequests;

				// Manually trigger another updateDisplay-equivalent path by
				// re-applying the same message; the diff guard should skip the
				// requestRender call because nothing visible changed.
				loader.setMessage("abcde");

				assert.equal(tui.renderRequests, initialRequests);
			} finally {
				loader.stop();
			}
		});
	});
});
