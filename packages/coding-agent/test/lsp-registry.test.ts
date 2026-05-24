import { describe, expect, it } from "vitest";
import { findLspForFile, getLspLanguageId, LSP_REGISTRY } from "../src/core/lsp/registry.js";

describe("LSP registry", () => {
	it("registers TypeScript, Python, Rust, Go, C/C++, Java, Ruby servers", () => {
		const ids = LSP_REGISTRY.map((entry) => entry.id);
		expect(ids).toEqual(
			expect.arrayContaining([
				"typescript-language-server",
				"pyright",
				"rust-analyzer",
				"gopls",
				"clangd",
				"jdtls",
				"solargraph",
			]),
		);
	});

	it("maps file extensions to the correct server", () => {
		expect(findLspForFile("/repo/src/index.ts")?.id).toBe("typescript-language-server");
		expect(findLspForFile("/repo/main.py")?.id).toBe("pyright");
		expect(findLspForFile("/repo/lib.rs")?.id).toBe("rust-analyzer");
		expect(findLspForFile("/repo/main.go")?.id).toBe("gopls");
		expect(findLspForFile("/repo/util.cpp")?.id).toBe("clangd");
		expect(findLspForFile("/repo/Foo.java")?.id).toBe("jdtls");
		expect(findLspForFile("/repo/app.rb")?.id).toBe("solargraph");
		expect(findLspForFile("/repo/notes.md")).toBeUndefined();
	});

	it("uses LSP languageId values that match the protocol convention", () => {
		const ts = LSP_REGISTRY.find((entry) => entry.id === "typescript-language-server");
		expect(ts).toBeDefined();
		expect(getLspLanguageId(ts!, "/repo/index.tsx")).toBe("typescriptreact");
		expect(getLspLanguageId(ts!, "/repo/index.ts")).toBe("typescript");
	});
});
