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

## Workflow Modes

Neo Code supports multiple workflow modes, cycled with `Shift+Tab`:

| Mode | Description |
| --- | --- |
| `default` | Full coding mode — inspect, edit, run commands |
| `ask` | Chat only, no tools |
| `read-only` | Inspect files only, no edits |
| `plan` | Inspect and plan, no execution |
| `accept-edits` | Auto-accept file edits |
| `full` | All tools exposed, no restrictions |

## Slash Commands

Type `/` in the prompt to see available commands:

- `/status` — Show model, auth, and usage
- `/usage` — Neosantara PAYG usage in Rupiah
- `/context` — Context window usage
- `/mode` — Switch workflow mode
- `/model` — Select model
- `/memory` — View, search, or manage memories
- `/skills` — Install or list skills
- `/lsp` — Manage LSP servers
- `/doctor` — Health checks
- `/compact` — Compact context manually
- `/export` — Export session to HTML/JSONL
- `/share` — Share session via gist
