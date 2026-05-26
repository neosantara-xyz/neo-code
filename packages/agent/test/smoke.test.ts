import type { Context, Model } from "@neosantara/ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import { streamProxy } from "../src/proxy.js";

const model = {
	id: "nusantara-base",
	api: "openai-responses",
	provider: "neosantara",
} as Model<any>;

const context = {
	messages: [],
} as unknown as Context;

describe("streamProxy", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("emits a proxy error when the response has no readable body", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				status: 200,
				statusText: "OK",
				body: null,
			})),
		);

		const stream = streamProxy(model, context, {
			authToken: "test-token",
			proxyUrl: "https://api.neosantara.xyz",
		});

		const result = await stream.result();
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toBe("Proxy response did not include a readable body.");
	});

	it("reconstructs assistant text from SSE proxy events", async () => {
		const encoder = new TextEncoder();
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(
					encoder.encode(
						[
							'data: {"type":"start"}\n',
							'data: {"type":"text_start","contentIndex":0}\n',
							'data: {"type":"text_delta","contentIndex":0,"delta":"Halo"}\n',
							'data: {"type":"text_end","contentIndex":0}\n',
							'data: {"type":"done","reason":"stop","usage":{"input":1,"output":1,"cacheRead":0,"cacheWrite":0,"totalTokens":2,"cost":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"total":0}}}\n',
						].join(""),
					),
				);
				controller.close();
			},
		});

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				status: 200,
				statusText: "OK",
				body,
			})),
		);

		const stream = streamProxy(model, context, {
			authToken: "test-token",
			proxyUrl: "https://api.neosantara.xyz",
		});

		const events = [];
		for await (const event of stream) {
			events.push(event.type);
		}

		const result = await stream.result();
		expect(events).toEqual(["start", "text_start", "text_delta", "text_end", "done"]);
		expect(result.stopReason).toBe("stop");
		expect(result.content).toEqual([{ type: "text", text: "Halo", textSignature: undefined }]);
	});
});
