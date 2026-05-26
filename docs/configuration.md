# Configuration

Neo Code uses JSON settings files and a directory structure for configuration.

## Directory Structure

```
~/.neo-code/
├── agent/
│   ├── auth.json           Credentials from neo login
│   ├── settings.json       Global settings
│   ├── keybindings.json    Custom keybindings
│   ├── models.json         Model registry cache
│   ├── bin/                Managed binaries (fd, rg)
│   ├── memories/           Memory entries (markdown files)
│   ├── sessions/           Session history per workspace
│   ├── skills/             User-installed skills
│   ├── extensions/         Global extensions
│   ├── agents/             Subagent definitions
│   └── prompts/            Custom prompt templates
```

Per-project configuration lives in `.neo-code/` at the project root:

```
your-project/
├── .neo-code/
│   ├── settings.json       Project-specific settings
│   ├── skills/             Project-local skills
│   ├── extensions/         Project-local extensions
│   ├── agents/             Project-local subagent definitions
│   ├── prompts/            Project-local prompt templates
│   └── todos.json          Task plan state
├── AGENTS.md               Project instructions for the agent
```

## Settings

Settings are JSON files. Project settings override global settings.

Access via `/settings` in the TUI, or `/config` to view effective values.

### Model & Provider

| Key | Type | Description |
| --- | --- | --- |
| `defaultProvider` | string | Provider to use (default: neosantara) |
| `defaultModel` | string | Model ID to use |
| `transport` | string | auto, openai-responses, openai-completions, websocket, sse |
| `defaultThinkingLevel` | string | off, minimal, low, medium, high, xhigh |
| `thinkingBudgets` | object | Custom token budgets per thinking level |
| `enabledModels` | string[] | Model patterns enabled for Shift+M cycling |

### Behavior

| Key | Type | Description |
| --- | --- | --- |
| `agentMode` | string | Default workflow mode (default, ask, read-only, plan, accept-edits, full) |
| `steeringMode` | string | Steering message delivery: all or one-at-a-time |
| `followUpMode` | string | Follow-up message delivery: all or one-at-a-time |
| `hideThinkingBlock` | boolean | Hide thinking blocks in conversation (default: true) |
| `quietStartup` | boolean | Suppress startup messages |
| `shellPath` | string | Custom shell path for bash tool |
| `shellCommandPrefix` | string | Prefix prepended to all shell commands |
| `npmCommand` | string[] | Custom npm command (e.g. ["pnpm"]) |
| `doubleEscapeAction` | string | Double-Escape behavior: fork, tree, or none |

### Compaction

| Key | Type | Description |
| --- | --- | --- |
| `compaction.enabled` | boolean | Enable auto-compaction (default: true) |
| `compaction.reserveTokens` | number | Tokens to reserve for response |
| `compaction.keepRecentTokens` | number | Recent tokens to preserve during compaction |
| `branchSummary.reserveTokens` | number | Tokens reserved for branch summary |
| `branchSummary.skipPrompt` | boolean | Skip "Summarize branch?" prompt |

### Memory

| Key | Type | Description |
| --- | --- | --- |
| `memory.enabled` | boolean | Enable memory injection (default: true) |
| `memory.autoExtract` | boolean | Auto-extract memories from conversation (default: true) |
| `memory.maxStored` | number | Maximum memories to keep |
| `memory.maxInjected` | number | Max memories injected per session (default: 10) |
| `memory.maxInjectionChars` | number | Max chars injected per session (default: 4000) |
| `memory.pruneAfterDays` | number | Auto-prune memories older than N days (default: 90) |

### Retry

| Key | Type | Description |
| --- | --- | --- |
| `retry.enabled` | boolean | Enable automatic retry on failure |
| `retry.maxRetries` | number | Maximum retry attempts |
| `retry.baseDelayMs` | number | Base delay between retries |
| `retry.provider.timeoutMs` | number | SDK/provider request timeout |
| `retry.provider.maxRetries` | number | SDK/provider retry attempts |
| `retry.provider.maxRetryDelayMs` | number | Max server-requested retry delay |

### UI

| Key | Type | Description |
| --- | --- | --- |
| `theme` | string | TUI color theme |
| `showTerminalProgress` | boolean | Show progress in terminal title |
| `collapseChangelog` | boolean | Auto-collapse changelog on startup |
| `spinnerTips.enabled` | boolean | Show tips during loading |
| `statusline.items` | array | Configure footer status line items |
| `editorPaddingX` | number | Horizontal padding for input editor |
| `autocompleteMaxVisible` | number | Max visible autocomplete items |
| `showHardwareCursor` | boolean | Show terminal cursor for IME support |
| `markdown.codeBlockIndent` | string | Code block indent string |

### Skills & Extensions

| Key | Type | Description |
| --- | --- | --- |
| `skills` | string[] | Additional skill paths to load |
| `enableSkillCommands` | boolean | Register skills as /skill:name commands |
| `extensions` | string[] | Local extension file paths |
| `packages` | array | npm/git package sources for extensions |
| `prompts` | string[] | Local prompt template paths |
| `themes` | string[] | Local theme file paths |

### MCP

| Key | Type | Description |
| --- | --- | --- |
| `mcpServers` | object | MCP server configuration (name → {command, args, env}) |

### Images

| Key | Type | Description |
| --- | --- | --- |
| `images.autoResize` | boolean | Resize images for model compatibility |
| `images.blockImages` | boolean | Block all images from being sent |

### Notifications (Termux)

| Key | Type | Description |
| --- | --- | --- |
| `notifications.termux.enabled` | boolean | Enable Termux notifications |
| `notifications.termux.minDurationMs` | number | Min turn duration to trigger notification |
| `notifications.termux.vibrate` | boolean | Vibrate on notification |
| `notifications.termux.sound` | boolean | Play sound on notification |

### Session

| Key | Type | Description |
| --- | --- | --- |
| `sessionDir` | string | Custom session storage directory |

## AGENTS.md

The `AGENTS.md` file at your project root provides instructions to the agent
about your project. It's loaded automatically on every session.

Create one with `/init` or `/agents init`.

Common contents:
- Build/test commands
- Code conventions
- Architecture overview
- Forbidden operations

## Keybindings

Custom keybindings in `~/.neo-code/agent/keybindings.json`:

```json
{
  "app.interrupt": "escape",
  "app.mode.cycle": "shift+tab",
  "app.transcript.view": "ctrl+t",
  "app.tools.expand": "ctrl+e",
  "app.session.new": "ctrl+j",
  "app.session.resume": "ctrl+r"
}
```

## Prompt Templates

Custom system prompts in `prompts/` directories:

- `~/.neo-code/agent/prompts/` — global
- `.neo-code/prompts/` — per-project

Files are loaded and appended to the system prompt.
