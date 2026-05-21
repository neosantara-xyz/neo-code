import { describe, expect, it } from "vitest";

import {
	createBashToolDefinition,
	createEditToolDefinition,
	createFindToolDefinition,
	createGrepToolDefinition,
	createLsToolDefinition,
	createReadToolDefinition,
	createWriteToolDefinition,
} from "../src/core/tools/index.js";

describe("built-in tool execution modes", () => {
	it("keeps read-only inspection tools parallel-safe", () => {
		const cwd = process.cwd();
		expect(createReadToolDefinition(cwd).executionMode).toBeUndefined();
		expect(createGrepToolDefinition(cwd).executionMode).toBeUndefined();
		expect(createFindToolDefinition(cwd).executionMode).toBeUndefined();
		expect(createLsToolDefinition(cwd).executionMode).toBeUndefined();
	});

	it("serializes shell and file mutation tools", () => {
		const cwd = process.cwd();
		expect(createBashToolDefinition(cwd).executionMode).toBe("sequential");
		expect(createWriteToolDefinition(cwd).executionMode).toBe("sequential");
		expect(createEditToolDefinition(cwd).executionMode).toBe("sequential");
	});
});
