import { spawn, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openLocal, resolveOpenStrategy } from "../src/core/open-file.js";

vi.mock("node:child_process", () => ({
	spawn: vi.fn(),
	spawnSync: vi.fn(),
}));

afterEach(() => {
	vi.mocked(spawn).mockReset();
	vi.mocked(spawnSync).mockReset();
});

const NON_TERMUX_ENV: NodeJS.ProcessEnv = { HOME: "/home/user", PATH: "/usr/bin" };

describe("resolveOpenStrategy", () => {
	it("uses termux-share when running on Termux with the share tool present", () => {
		const r = resolveOpenStrategy("/tmp/session.html", {
			platform: "linux",
			env: {
				TERMUX_VERSION: "0.118.0",
				PREFIX: "/data/data/com.termux/files/usr",
				HOME: "/data/data/com.termux/files/home",
			},
			termuxShareAvailable: true,
		});
		expect(r.strategy).toBe("termux-share");
		expect(r.argv[0]).toBe("termux-share");
		expect(r.argv).toContain("/tmp/session.html");
		expect(r.argv).toContain("view");
	});

	it("falls back to xdg-open inside Termux when termux-share is missing", () => {
		const r = resolveOpenStrategy("/tmp/session.html", {
			platform: "linux",
			env: {
				TERMUX_VERSION: "0.118.0",
				PREFIX: "/data/data/com.termux/files/usr",
				HOME: "/data/data/com.termux/files/home",
			},
			termuxShareAvailable: false,
		});
		expect(r.strategy).toBe("xdg-open");
		expect(r.argv).toEqual(["xdg-open", "/tmp/session.html"]);
	});

	it("uses `open` on macOS", () => {
		const r = resolveOpenStrategy("/tmp/session.html", { platform: "darwin", env: NON_TERMUX_ENV });
		expect(r.strategy).toBe("open");
		expect(r.argv).toEqual(["open", "/tmp/session.html"]);
	});

	it("uses `xdg-open` on Linux", () => {
		const r = resolveOpenStrategy("/tmp/session.html", { platform: "linux", env: NON_TERMUX_ENV });
		expect(r.strategy).toBe("xdg-open");
		expect(r.argv).toEqual(["xdg-open", "/tmp/session.html"]);
	});

	it('uses `cmd /c start ""` on Windows', () => {
		const r = resolveOpenStrategy("C:/tmp/session.html", { platform: "win32", env: NON_TERMUX_ENV });
		expect(r.strategy).toBe("windows-start");
		expect(r.argv).toEqual(["cmd", "/c", "start", "", "C:/tmp/session.html"]);
	});

	it("returns `unsupported` for exotic platforms", () => {
		const r = resolveOpenStrategy("/tmp/session.html", { platform: "aix" as NodeJS.Platform, env: NON_TERMUX_ENV });
		expect(r.strategy).toBe("unsupported");
		expect(r.argv).toEqual([]);
		expect(r.label).toContain("aix");
	});
});

describe("openLocal", () => {
	it("treats xdg-open as a successful handoff after spawning it", () => {
		vi.mocked(spawnSync).mockReturnValueOnce({
			status: 0,
			signal: null,
			output: [],
			pid: 123,
			stdout: null,
			stderr: null,
		});
		const unref = vi.fn();
		vi.mocked(spawn).mockReturnValueOnce({ pid: 456, unref } as never);

		const result = openLocal("/tmp/session.html", { platform: "linux", env: NON_TERMUX_ENV });

		expect(result.ok).toBe(true);
		expect(spawnSync).toHaveBeenCalledWith("sh", ["-c", "command -v xdg-open"], expect.any(Object));
		expect(spawn).toHaveBeenCalledWith(
			"xdg-open",
			["/tmp/session.html"],
			expect.objectContaining({ detached: true }),
		);
		expect(unref).toHaveBeenCalled();
	});

	it("reports missing xdg-open before trying to spawn it", () => {
		vi.mocked(spawnSync).mockReturnValueOnce({
			status: 1,
			signal: null,
			output: [],
			pid: 123,
			stdout: null,
			stderr: null,
		});

		const result = openLocal("/tmp/session.html", { platform: "linux", env: NON_TERMUX_ENV });

		expect(result.ok).toBe(false);
		expect(result.error).toBe("xdg-open not found");
		expect(spawn).not.toHaveBeenCalled();
	});
});
