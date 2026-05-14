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

describe("Loader", () => {
	it("renders a Claude-style right-to-left glimmer independent from spinner frames", () => {
		const clock = { now: 0 };
		withMockedDateNow(clock, () => {
			const tui = new FakeTui();
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
					shimmerIntervalMs: 200,
				},
			);

			try {
				clock.now = 2000;
				loader.setMessage("abcde");
				const line = loader.render(40).join("\n");

				assert.match(line, /abcdE/);
				assert.ok(tui.renderRequests > 0);
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
					shimmerIntervalMs: 200,
				},
			);

			try {
				clock.now = 2000;
				loader.setMessage("preparing tool…");
				const line = loader.render(40).join("\n");

				assert.match(line, /[A-Z]/);
				assert.doesNotMatch(line, /✦/);
			} finally {
				loader.stop();
			}
		});
	});

	it("pulses the whole message in tool-use mode instead of adding a second symbol", () => {
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
					shimmerColorFn: (text) => text.toUpperCase(),
				},
			);

			try {
				clock.now = 500;
				loader.setMessage("searching files…");
				const line = loader.render(40).join("\n");

				assert.match(line, /SEARCHING FILES…/);
				assert.doesNotMatch(line, /✦/);
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
});
