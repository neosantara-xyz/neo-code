import { spawnSync } from "node:child_process";
import { extname } from "node:path";

export interface LspServerConfig {
	id: string;
	displayName: string;
	command: string;
	args: string[];
	languages: string[];
	fileExtensions: string[];
	languageIds: Record<string, string>;
	installHint: string;
}

export const LSP_REGISTRY: ReadonlyArray<LspServerConfig> = [
	{
		id: "typescript-language-server",
		displayName: "typescript-language-server",
		command: "typescript-language-server",
		args: ["--stdio"],
		languages: ["typescript", "javascript"],
		fileExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
		languageIds: {
			".ts": "typescript",
			".tsx": "typescriptreact",
			".js": "javascript",
			".jsx": "javascriptreact",
			".mjs": "javascript",
			".cjs": "javascript",
		},
		installHint: "npm install -g typescript-language-server typescript",
	},
	{
		id: "pyright",
		displayName: "pyright-langserver",
		command: "pyright-langserver",
		args: ["--stdio"],
		languages: ["python"],
		fileExtensions: [".py", ".pyi"],
		languageIds: { ".py": "python", ".pyi": "python" },
		installHint: "npm install -g pyright",
	},
	{
		id: "rust-analyzer",
		displayName: "rust-analyzer",
		command: "rust-analyzer",
		args: [],
		languages: ["rust"],
		fileExtensions: [".rs"],
		languageIds: { ".rs": "rust" },
		installHint: "rustup component add rust-analyzer",
	},
	{
		id: "gopls",
		displayName: "gopls",
		command: "gopls",
		args: [],
		languages: ["go"],
		fileExtensions: [".go"],
		languageIds: { ".go": "go" },
		installHint: "go install golang.org/x/tools/gopls@latest",
	},
	{
		id: "clangd",
		displayName: "clangd",
		command: "clangd",
		args: [],
		languages: ["c", "cpp"],
		fileExtensions: [".c", ".cc", ".cpp", ".cxx", ".h", ".hpp", ".hh"],
		languageIds: {
			".c": "c",
			".h": "c",
			".cc": "cpp",
			".cpp": "cpp",
			".cxx": "cpp",
			".hpp": "cpp",
			".hh": "cpp",
		},
		installHint: "install LLVM/Clang tools (e.g., apt install clangd, brew install llvm)",
	},
	{
		id: "jdtls",
		displayName: "jdtls",
		command: "jdtls",
		args: [],
		languages: ["java"],
		fileExtensions: [".java"],
		languageIds: { ".java": "java" },
		installHint: "install Eclipse JDT Language Server (jdtls) and put it on PATH",
	},
	{
		id: "solargraph",
		displayName: "solargraph",
		command: "solargraph",
		args: ["stdio"],
		languages: ["ruby"],
		fileExtensions: [".rb"],
		languageIds: { ".rb": "ruby" },
		installHint: "gem install solargraph",
	},
];

export interface LspBinaryAvailability {
	config: LspServerConfig;
	installed: boolean;
	resolvedPath?: string;
}

export function detectLspBinary(config: LspServerConfig, env: NodeJS.ProcessEnv = process.env): LspBinaryAvailability {
	const result = spawnSync("sh", ["-c", 'command -v "$1"', "--", config.command], {
		encoding: "utf8",
		stdio: "pipe",
		timeout: 2000,
		env,
	});
	if (result.status === 0 && result.stdout) {
		return { config, installed: true, resolvedPath: result.stdout.trim() };
	}
	return { config, installed: false };
}

export function detectAllLspBinaries(env: NodeJS.ProcessEnv = process.env): LspBinaryAvailability[] {
	return LSP_REGISTRY.map((config) => detectLspBinary(config, env));
}

export function findLspForFile(filePath: string): LspServerConfig | undefined {
	const ext = extname(filePath).toLowerCase();
	if (!ext) return undefined;
	return LSP_REGISTRY.find((config) => config.fileExtensions.includes(ext));
}

export function getLspLanguageId(config: LspServerConfig, filePath: string): string {
	const ext = extname(filePath).toLowerCase();
	return config.languageIds[ext] ?? config.languages[0] ?? "plaintext";
}
