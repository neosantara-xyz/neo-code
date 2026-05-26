# Getting Started

Neo Code is a Neosantara-first AI coding agent that runs in your terminal.

## Install

```bash
curl -fsSL https://code.neosantara.xyz/install.sh | sh
```

On Termux (Android):

```bash
pkg install nodejs-lts git
curl -fsSL https://code.neosantara.xyz/install.sh | sh
```

## Login

Authenticate with your Neosantara account:

```bash
neo login
```

This opens a browser for device authentication. Credentials are stored in
`~/.neo-code/agent/auth.json`.

## Usage

Start the interactive TUI:

```bash
neo
```

Or run a one-shot prompt:

```bash
neo -p "explain this codebase"
```

### Quick Shortcuts

- `!command` — Run shell command, output included in context
- `!!command` — Run shell command, output hidden from LLM
- `@file.txt` — Attach file contents to your prompt
- `@image.png` — Attach image to your prompt

## Workflow Modes

Neo Code supports multiple workflow modes. Use `Shift+Tab` to cycle between
`default`, `accept-edits`, and `plan`. Use `/mode` or mode-specific slash
commands to switch to any mode.

| Mode | Description |
| --- | --- |
| `default` | Full coding mode — inspect, edit, run commands |
| `ask` | Chat only, no tools |
| `read-only` | Inspect files only, no edits |
| `plan` | Inspect and plan, no execution |
| `accept-edits` | Auto-accept file edits |
| `full` | All tools exposed, no restrictions |

Mode shortcut commands: `/ask`, `/plan`, `/read-only`, `/default`, `/agent`,
`/accept-edits` — run a prompt directly in that mode.

## Slash Commands

Type `/` in the prompt to see available commands:

**Session & Navigation**
- `/status` — Show model, auth, and usage
- `/usage` — Neosantara PAYG usage in Rupiah
- `/context` — Context window usage
- `/session` — Show session info
- `/new` — Start new session
- `/resume` — Resume a previous session
- `/fork` — Fork session
- `/tree` — Navigate session tree
- `/name` — Name or rename session
- `/import` — Import JSONL session
- `/export` — Export session to HTML/JSONL
- `/share` — Share session via gist

**Configuration**
- `/mode` — Switch workflow mode
- `/model` — Select model
- `/settings` — Open settings menu
- `/config` — Show effective configuration summary
- `/permissions` — Show/change tool permissions
- `/scoped-models` — Enable/disable models for cycling
- `/statusline` — Configure footer status line items
- `/hotkeys` — Show all keyboard shortcuts
- `/reload` — Reload extensions, skills, prompts, themes

**Tools & Features**
- `/memory` — View, search, or manage memories
- `/skills` — Install or list skills
- `/lsp` — Manage LSP servers
- `/mcp` — Show configured MCP servers
- `/todo` — Show current task plan
- `/tasks` — Background shell tasks
- `/diff` — Show Git workspace diff
- `/review` — Review changes, branches, commits, or PRs
- `/compact` — Compact context manually
- `/copy` — Copy last agent message to clipboard

**Project**
- `/init` — Create AGENTS.md
- `/agents` — Show/initialize AGENTS.md
- `/doctor` — Health checks
- `/changelog` — Show full changelog
- `/hooks` — Show registered hooks

**Termux**
- `/termux-keys` — Manage touch keyboard layout
- `/termux-status` — Check Termux:API capabilities

**Auth**
- `/login` — Authenticate with provider
- `/logout` — Clear credentials
- `/quit` — Exit
