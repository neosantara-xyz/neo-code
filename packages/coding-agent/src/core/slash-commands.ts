import { APP_NAME } from "../config.js";
import type { SourceInfo } from "./source-info.js";

export type SlashCommandSource = "extension" | "prompt" | "skill";

export interface SlashCommandInfo {
	name: string;
	description?: string;
	source: SlashCommandSource;
	sourceInfo: SourceInfo;
}

export interface BuiltinSlashCommand {
	name: string;
	description: string;
	argumentHint?: string;
}

export const BUILTIN_SLASH_COMMANDS: ReadonlyArray<BuiltinSlashCommand> = [
	{ name: "settings", description: "Open settings menu" },
	{ name: "status", description: "Show Neo Code status, model, auth, and usage summary" },
	{ name: "usage", description: "Show Neosantara PAYG usage and budget in Rupiah" },
	{ name: "context", description: "Show current context window usage and compaction guidance" },
	{ name: "doctor", description: "Run local Neo Code health checks" },
	{ name: "config", description: "Show effective Neo Code configuration summary" },
	{ name: "mcp", description: "Show configured MCP servers" },
	{ name: "todo", description: "Show current todo plan" },
	{ name: "termux-keys", description: "Show or apply Neo Code touch-keyboard keys for Termux" },
	{ name: "termux-status", description: "Show Termux:API capability and tool availability" },
	{
		name: "lsp",
		description: "Show, init, restart, or inspect logs for installed LSP servers",
		argumentHint: "[status|init|logs|restart|stop]",
	},
	{ name: "mode", description: "Show or switch workflow mode" },
	{ name: "permissions", description: "Show or change active tool permissions for the next turn" },
	{ name: "tasks", description: "Show, inspect, or stop background shell tasks" },
	{ name: "diff", description: "Show current Git workspace diff" },
	{ name: "review", description: "Review uncommitted changes, a branch, a commit, or a pull request" },
	{ name: "init", description: "Create an AGENTS.md contributor guide for this repository" },
	{ name: "statusline", description: "Choose which items appear in the footer status line" },
	{ name: "agents", description: "Show or initialize AGENTS.md project instructions" },
	{ name: "skills", description: "Install or list skills" },
	{ name: "model", description: "Select model" },
	{ name: "export", description: "Export session to HTML or JSONL" },
	{ name: "import", description: "Import and resume a JSONL session" },
	{
		name: "share",
		description: "Share session — gist (default) or local OS share sheet",
		argumentHint: "[local|gist]",
	},
	{ name: "hotkeys", description: "Show all keyboard shortcuts" },
	{
		name: "memory",
		description: "View, search, or manage cross-session memories",
		argumentHint: "[list|search <query>|delete <id>|clear|help]",
	},
	{ name: "login", description: "Configure provider authentication" },
	{ name: "logout", description: "Remove provider authentication" },
	{ name: "new", description: "Start a new session" },
	{ name: "fork", description: "Fork the current chat into a new session that branches off this one" },
	{
		name: "compact",
		description: "Manually compact the session context",
		argumentHint: "<optional custom summarization instructions>",
	},
	{ name: "quit", description: `Quit ${APP_NAME}` },
];
