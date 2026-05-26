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

Access via `/settings` in the TUI.

### Model & Provider

| Key | Type | Description |
| --- | --- | --- |
| `defaultProvider` | string | Provider to use (default: neosantara) |
| `defaultModel` | string | Model ID to use |
| `transport` | string | Transport type: openai-responses or openai-completions |
| `defaultThinkingLevel` | string | off, minimal, low, medium, high, xhigh |

### Behavior

| Key | Type | Description |
| --- | --- | --- |
| `agentMode` | string | Default workflow mode (default, ask, read-only, plan, accept-edits, full) |
| `hideThinkingBlock` | boolean | Hide thinking blocks in conversation (default: true) |
| `quietStartup` | boolean | Suppress startup messages |
| `shellPath` | string | Custom shell path for bash tool |
| `shellCommandPrefix` | string | Prefix prepended to all shell commands |
| `npmCommand` | string[] | Custom npm command (e.g. ["pnpm"]) |

### Compaction

| Key | Type | Description |
| --- | --- | --- |
| `compaction.enabled` | boolean | Enable auto-compaction (default: true) |
| `compaction.reserveTokens` | number | Tokens to reserve for response |
| `compaction.keepRecentTokens` | number | Recent tokens to preserve during compaction |

### Memory

| Key | Type | Description |
| --- | --- | --- |
| `memory.maxStored` | number | Maximum memories to keep |
| `memory.pruneAfterDays` | number | Auto-prune memories older than N days |
| `memory.maxInjectionChars` | number | Max chars injected per session |

### Retry

| Key | Type | Description |
| --- | --- | --- |
| `retry.enabled` | boolean | Enable automatic retry on failure |
| `retry.maxRetries` | number | Maximum retry attempts |
| `retry.baseDelayMs` | number | Base delay between retries |

### UI

| Key | Type | Description |
| --- | --- | --- |
| `theme` | string | TUI color theme |
| `showTerminalProgress` | boolean | Show progress in terminal title |
| `spinnerTips.enabled` | boolean | Show tips during loading |
| `statusline.items` | array | Configure footer status line items |
| `collapseChangelog` | boolean | Auto-collapse changelog on startup |

### Skills

| Key | Type | Description |
| --- | --- | --- |
| `skills` | string[] | Additional skill paths to load |

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
