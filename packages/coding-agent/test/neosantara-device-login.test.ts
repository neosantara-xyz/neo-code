import { describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.js";
import { loginWithNeosantaraDeviceAuth, runNeosantaraDeviceLogin } from "../src/core/neosantara-device-auth.js";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(body), {
		status: init?.status ?? 200,
		headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
	});
}

describe("Neosantara device login", () => {
	it("returns device auth details for interactive consumers", async () => {
		const authStorage = AuthStorage.inMemory();
		const initiated: string[] = [];
		const pendingUpdates: string[] = [];
		let tokenPolls = 0;
		const fetchImpl: typeof fetch = async (input) => {
			if (String(input).endsWith("/auth/cli/initiate")) {
				return jsonResponse({
					status: true,
					data: {
						device_code: "interactive-device",
						user_code: "NUSA-1234",
						verification_uri: "https://app.neosantara.xyz/device",
						expires_in: 300,
						interval: 1,
					},
				});
			}

			return jsonResponse(
				tokenPolls++ === 0
					? { status: true, message: "waiting" }
					: {
							status: true,
							data: {
								token: "interactive-token",
								user: { username: "neosantara", tier: "Pro" },
							},
						},
				{ status: tokenPolls === 1 ? 202 : 200 },
			);
		};

		const result = await loginWithNeosantaraDeviceAuth({
			apiBaseUrl: "https://api.example.test",
			authStorage,
			fetchImpl,
			stdout: {
				write: () => true,
			},
			sleep: async () => {
				// Keep the polling loop synchronous in test.
			},
			now: () => 0,
			onInitiated: (data) => {
				initiated.push(`${data.user_code}@${data.verification_uri}`);
			},
			onPending: () => {
				pendingUpdates.push("pending");
			},
		});

		expect(initiated).toEqual(["NUSA-1234@https://app.neosantara.xyz/device"]);
		expect(pendingUpdates).toContain("pending");
		expect(result.initiateData.user_code).toBe("NUSA-1234");
		expect(result.tokenData.token).toBe("interactive-token");
		expect(await authStorage.getApiKey("neosantara")).toBe("interactive-token");
	});

	it("stores the authorized CLI token as the Neosantara credential", async () => {
		const calls: Array<{ url: string; body?: unknown }> = [];
		const fetchImpl: typeof fetch = async (input, init) => {
			calls.push({
				url: String(input),
				body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
			});

			if (String(input).endsWith("/auth/cli/initiate")) {
				return jsonResponse({
					status: true,
					data: {
						device_code: "device-secret",
						user_code: "ABCD-EFGH",
						verification_uri: "https://app.neosantara.xyz/device",
						expires_in: 300,
						interval: 1,
					},
				});
			}

			return jsonResponse({
				status: true,
				data: {
					token: "jwt-token",
					user: { username: "er", tier: "Free" },
				},
			});
		};

		const authStorage = AuthStorage.inMemory();
		let stdout = "";
		let stderr = "";
		const oldExitCode = process.exitCode;
		process.exitCode = undefined;

		await runNeosantaraDeviceLogin(["login"], {
			apiBaseUrl: "https://api.example.test",
			fetchImpl,
			authStorage,
			sleep: async () => {},
			now: () => 0,
			stdout: {
				write: (chunk: string | Uint8Array) => {
					stdout += String(chunk);
					return true;
				},
			},
			stderr: {
				write: (chunk: string | Uint8Array) => {
					stderr += String(chunk);
					return true;
				},
			},
		});

		expect(stderr).toBe("");
		expect(process.exitCode).toBeUndefined();
		expect(await authStorage.getApiKey("neosantara")).toBe("jwt-token");
		expect(calls.map((call) => call.url)).toEqual([
			"https://api.example.test/auth/cli/initiate",
			"https://api.example.test/auth/cli/token",
		]);
		expect(calls[1].body).toEqual({ device_code: "device-secret" });
		expect(stdout).toContain("ABCD-EFGH");
		expect(stdout).toContain("Logged in to Neosantara");

		process.exitCode = oldExitCode;
	});
});
