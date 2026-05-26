# Extensions

Extensions are TypeScript plugins that add custom tools, commands, hooks, and
UI to Neo Code.

## Installing

```bash
neo install <source>          # Install globally
neo install <source> --local  # Install for current project
neo remove <source>           # Remove extension
neo update <source>           # Update extension
neo list                      # List installed extensions
```

Sources: npm packages, git URLs, or local paths.

## Extension Locations

- Global: `~/.neo-code/agent/extensions/`
- Project: `.neo-code/extensions/`
- CLI: `--extension <path>`
- Settings: `extensions` array, `packages` array

## Capabilities

Extensions can:

- **Register tools** — Custom LLM-callable tools with schema and rendering
- **Register slash commands** — Custom `/command` handlers
- **Register keyboard shortcuts** — Custom keybindings
- **Subscribe to events** — 30+ lifecycle events (session_start, tool_call,
  tool_result, message_start/end, model_select, etc.)
- **Add UI widgets** — Above/below editor, overlays, custom footer/header
- **Add autocomplete providers** — Custom completions in the input editor
- **Register providers** — Add new model providers with OAuth support
- **Send messages** — Programmatically steer the agent (steer, followUp, nextTurn)
- **Persist state** — Custom session entries that survive compaction
- **Customize working indicator** — Custom frames, shimmer, direction

## Reloading

Use `/reload` to hot-reload extensions, skills, prompts, and themes without
restarting the session.

## Configuration

```bash
neo config    # TUI to enable/disable package resources
```
