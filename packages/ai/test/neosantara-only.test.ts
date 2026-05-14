import { describe, expect, it } from "vitest";
import { findEnvKeys } from "../src/env-api-keys.js";
import { getModel, getModels, getProviders } from "../src/models.js";

describe("Neosantara model registry", () => {
	it("exposes only Neosantara as a built-in provider", () => {
		expect(getProviders()).toEqual(["neosantara"]);
	});

	it("has the default Neosantara model", () => {
		const model = getModel("neosantara", "grok-4.1-fast-non-reasoning");
		expect(model?.api).toBe("openai-responses");
		expect(model?.baseUrl).toBe("https://api.neosantara.xyz/v1");
		expect(model?.costCurrency).toBe("IDR");
	});

	it("includes tool-capable Neosantara chat models", () => {
		expect(getModel("neosantara", "garda-core")).toBeDefined();
		expect(getModel("neosantara", "claude-sonnet-4-6")).toBeDefined();
	});

	it("omits text models that do not advertise function calling", () => {
		expect(getModel("neosantara", "archipelago-core-70b")).toBeUndefined();
		expect(getModel("neosantara", "deepseek-r1")).toBeUndefined();
	});

	it("keeps all built-in models under the Neosantara provider", () => {
		expect(getModels().every((model) => model.provider === "neosantara")).toBe(true);
	});

	it("does not report env keys when Neosantara credentials are absent", () => {
		delete process.env.NAI_API_KEY;
		delete process.env.NEOSANTARA_API_KEY;
		expect(findEnvKeys("neosantara")).toBeUndefined();
	});
});
