import { describe, expect, it } from "vitest";
import { resolveOpenStrategy } from "../src/core/open-file.js";

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
