# Neo Code

<p align="center">
  <a href="https://code.neosantara.xyz">
    <img alt="Neo Code" src="../../packages/web/public/neo-code-mark.svg" width="96">
  </a>
</p>
<p align="center">
  <a href="https://github.com/neosantara-xyz/neo-code"><img alt="GitHub" src="https://img.shields.io/github/stars/neosantara-xyz/neo-code?style=flat-square" /></a>
</p>

---

Neo Code is a Neosantara-first terminal coding agent. Cross-session memory, code
intelligence, subagents, and 12+ built-in tools. Extend it with
[Extensions](#extensions), [Skills](#skills), [Prompt Templates](#prompt-templates),
and [Themes](#themes).

## Table of Contents

- [Quick Start](#quick-start)
- [Interactive Mode](#interactive-mode)
  - [Editor](#editor)
  - [Commands](#commands)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
  - [Message Queue](#message-queue)
- [Sessions](#sessions)
  - [Branching](#branching)
  - [Compaction](#compaction)
- [Settings](#settings)
- [Context Files](#context-files)
- [Customization](#customization)
  - [Prompt Templates](#prompt-templates)
  - [Skills](#skills)
  - [Extensions](#extensions)
  - [Themes](#themes)
  - [Packages](#packages)
- [Programmatic Usage](#programmatic-usage)
- [CLI Reference](#cli-reference)

---

## Quick Start

```bash
curl -fsSL https://code.neosantara.xyz/install.sh | sh
neo login
```

On Termux (Android):

```bash
pkg install nodejs-lts git
curl -fsSL https://code.neosantara.xyz/install.sh | sh
```

Then just talk to Neo. By default, Neo gives the model 12 tools: `read`, `write`,
`edit`, `apply_patch`, `bash`, `grep`, `find`, `ls`, `lsp`, `mcp`, `todo`, and
`agent`. The model uses these to fulfill your requests.

**Platform notes:** [Termux](../../docs/termux.md)

---

## Interactive Mode

The interface from top to bottom:

- **Startup header** — Shortcuts, loaded AGENTS.md, prompt templates, skills, extensions
- **Messages** — Your messages, assistant responses, tool calls/results, notifications
- **Editor** — Where you type; border color indicates thinking level
- **Footer** — Working directory, session name, token/cache usage, cost (IDR), context, model

### Editor

| Feature | How |
|---------|-----|
| File reference | Type `@` to fuzzy-search project files |
| Path completion | Tab to complete paths |
| Multi-line | Shift+Enter |
| Images | Ctrl+V to paste, or drag onto terminal |
| Bash commands | `!command` runs and sends output to LLM |
| Private bash | `!!command` runs without sending to LLM |

### Commands

Type `/` in the editor to trigger commands. Extensions can register custom
commands, skills are available as `/skill:name`, and prompt templates expand
via `/templatename`.

| Command | Description |
|---------|-------------|
| `/login`, `/logout` | Device authentication |
| `/model` | Switch models |
| `/scoped-models` | Enable/disable models for cycling |
| `/settings` | Thinking level, theme, message delivery |
| `/mode` | Switch workflow mode |
| `/resume` | Pick from previous sessions |
| `/new` | Start a new session |
| `/name <name>` | Set session display name |
| `/session` | Show session info |
| `/tree` | Navigate session tree |
| `/fork` | Fork session from a previous point |
| `/clone` | Duplicate current branch |
| `/compact [prompt]` | Manually compact context |
| `/copy` | Copy last assistant message to clipboard |
| `/export [file]` | Export session to HTML/JSONL |
| `/share` | Upload as private gist |
| `/review` | AI code review (diff, branch, commit, PR) |
| `/todo` | Show current task plan |
| `/tasks` | Background shell tasks |
| `/diff` | Show Git workspace diff |
| `/mcp` | Show configured MCP servers |
| `/memory` | View, search, manage memories |
| `/skills` | Install or list skills |
| `/lsp` | Manage LSP servers |
| `/permissions` | Show/change tool permissions |
| `/reload` | Reload extensions, skills, prompts, themes |
| `/hotkeys` | Show all keyboard shortcuts |
| `/doctor` | Health checks |
| `/changelog` | Display version history |
| `/quit` | Quit |

### Keyboard Shortcuts

See `/hotkeys` for the full list. Customize via `~/.neo-code/agent/keybindings.json`.

| Key | Action |
|-----|--------|
| Escape | Cancel/abort |
| Escape twice | Fork or tree (configurable) |
| Shift+Tab | Cycle mode (default → accept-edits → plan) |
| Ctrl+L | Open model selector |
| Ctrl+P / Shift+Ctrl+P | Cycle models forward/backward |
| Shift+Ctrl+Tab | Cycle thinking level |
| Ctrl+O | Collapse/expand tool output |
| Ctrl+T | Collapse/expand thinking blocks |
| Ctrl+E | External editor |

### Message Queue

Submit messages while the agent is working:

- **Enter** queues a *steering* message (delivered after current tool calls)
- **Alt+Enter** queues a *follow-up* message (delivered after agent finishes)
- **Escape** aborts and restores queued messages to editor

Configure delivery: `steeringMode` and `followUpMode` can be `"one-at-a-time"`
(default) or `"all"` (delivers all queued at once).

---

## Sessions

Sessions are stored as JSONL files with a tree structure. Each entry has an `id`
and `parentId`, enabling in-place branching without creating new files.

### Management

Sessions auto-save to `~/.neo-code/agent/sessions/` organized by working directory.

```bash
neo -c                  # Continue most recent session
neo -r                  # Browse and select from past sessions
neo --no-session        # Ephemeral mode (don't save)
neo --session <path|id> # Use specific session
neo --fork <path|id>    # Fork specific session into a new one
```

### Branching

- **`/tree`** — Navigate the session tree. Select any previous point, continue from there
- **`/fork`** — Create a new session from a previous user message
- **`/clone`** — Duplicate the current active branch into a new session

Filter modes in tree view (cycle with Ctrl+O): default → no-tools → user-only → labeled-only → all.

### Compaction

Long sessions can exhaust context windows. Compaction summarizes older messages
while keeping recent ones.

- **Manual:** `/compact` or `/compact <custom instructions>`
- **Automatic:** Enabled by default, triggers on context overflow or when approaching the limit

The full history remains in the JSONL file; use `/tree` to revisit.

---

## Settings

Use `/settings` to modify common options, or edit JSON files directly:

| Location | Scope |
|----------|-------|
| `~/.neo-code/agent/settings.json` | Global (all projects) |
| `.neo-code/settings.json` | Project (overrides global) |

See [configuration docs](../../docs/configuration.md) for all options.

---

## Context Files

Neo Code loads `AGENTS.md` at startup from:
- `~/.neo-code/agent/AGENTS.md` (global)
- Parent directories (walking up from cwd)
- Current directory

Use for project instructions, conventions, common commands. All matching files
are concatenated.

Disable with `--no-context-files` (or `-nc`).

---

## Customization

### Prompt Templates

Reusable prompts as Markdown files. Type `/name` to expand.

Place in `~/.neo-code/agent/prompts/` or `.neo-code/prompts/`.

### Skills

On-demand capability packages following the [Agent Skills standard](https://agentskills.io).
Invoke via `/skill:name` or let the agent load them automatically.

```bash
/skills install <source>          # Install globally
/skills install <source> --local  # Install for current project
/skills list                      # List loaded skills
```

Place in `~/.neo-code/agent/skills/` or `.neo-code/skills/`.

### Extensions

TypeScript modules that extend Neo Code with custom tools, commands, keyboard
shortcuts, event handlers, and UI components.

**What's possible:**
- Custom LLM-callable tools
- Slash commands and keyboard shortcuts
- Event hooks (30+ lifecycle events)
- UI widgets (above/below editor, overlays, custom footer/header)
- Custom autocomplete providers
- Provider registration
- Message steering (programmatic agent control)
- Custom working indicator

Place in `~/.neo-code/agent/extensions/` or `.neo-code/extensions/`.

### Themes

JSON-based theming with 50+ color tokens. Built-in: `dark`, `light`,
`neosantara`, `neosantara-light`. Themes hot-reload on file change.

Place in `~/.neo-code/agent/themes/` or `.neo-code/themes/`.

### Packages

Bundle and share extensions, skills, prompts, and themes via npm or git:

```bash
neo install <source>          # Install globally
neo install <source> --local  # Install for current project
neo remove <source>           # Remove
neo list                      # List installed
neo update                    # Update all
neo config                    # Enable/disable resources
```

---

## Programmatic Usage

### SDK

```typescript
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@neosantara-xyz/code";

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

await session.prompt("What files are in the current directory?");
```

### RPC Mode

For non-Node.js integrations, use RPC mode over stdin/stdout:

```bash
neo --mode rpc
```

JSON lines protocol with correlation IDs. See source for protocol types.

---

## CLI Reference

```bash
neo [options] [@files...] [messages...]
```

### Modes

| Flag | Description |
|------|-------------|
| (default) | Interactive mode |
| `-p`, `--print` | Print response and exit |
| `--mode json` | Output all events as JSON lines |
| `--mode rpc` | RPC mode for process integration |
| `--export <in> [out]` | Export session to HTML |

### Model Options

| Option | Description |
|--------|-------------|
| `--provider <name>` | Provider (default: neosantara) |
| `--model <pattern>` | Model pattern or ID (supports `provider/id` and `:<thinking>`) |
| `--thinking <level>` | off, minimal, low, medium, high, xhigh |
| `--models <patterns>` | Comma-separated patterns for Ctrl+P cycling |
| `--list-models [search]` | List available models |

### Session Options

| Option | Description |
|--------|-------------|
| `-c`, `--continue` | Continue most recent session |
| `-r`, `--resume` | Browse and select session |
| `--session <path\|id>` | Use specific session |
| `--fork <path\|id>` | Fork specific session |
| `--session-dir <dir>` | Custom session storage directory |
| `--no-session` | Ephemeral mode |

### Tool Options

| Option | Description |
|--------|-------------|
| `--tools <list>`, `-t` | Allowlist specific tools |
| `--no-builtin-tools`, `-nbt` | Disable built-in tools |
| `--no-tools`, `-nt` | Disable all tools |

### Resource Options

| Option | Description |
|--------|-------------|
| `-e`, `--extension <source>` | Load extension (repeatable) |
| `--no-extensions` | Disable extension discovery |
| `--skill <path>` | Load skill (repeatable) |
| `--no-skills` | Disable skill discovery |
| `--prompt-template <path>` | Load prompt template (repeatable) |
| `--no-prompt-templates` | Disable prompt template discovery |
| `--theme <path>` | Load theme (repeatable) |
| `--no-themes` | Disable theme discovery |
| `--no-context-files`, `-nc` | Disable AGENTS.md loading |

### Other Options

| Option | Description |
|--------|-------------|
| `--system-prompt <text>` | Replace default system prompt |
| `--verbose` | Force verbose startup |
| `--offline` | Disable startup network operations |
| `-h`, `--help` | Show help |
| `-v`, `--version` | Show version |

### File Arguments

Prefix files with `@` to include in the message:

```bash
neo @prompt.md "Answer this"
neo -p @screenshot.png "What's in this image?"
neo @code.ts @test.ts "Review these files"
```

### Examples

```bash
neo "List all .ts files in src/"
neo -p "Summarize this codebase"
neo --model deepseek-v4-0324 "Help me refactor"
neo --thinking high "Solve this complex problem"
neo --tools read,grep,find,ls -p "Review the code"
cat README.md | neo -p "Summarize this"
```

---

## See Also

- [@neosantara-xyz/ai](../ai/) — OpenAI-compatible LLM transport
- [@neosantara-xyz/agent-core](../agent/) — Agent loop and runtime primitives
- [@neosantara-xyz/tui](../tui/) — Terminal UI framework

## License

MIT
