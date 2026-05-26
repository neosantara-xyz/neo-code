# Themes

Neo Code supports full JSON-based theming with 50+ color tokens.

## Built-in Themes

- `dark` (default)
- `light`
- `neosantara`
- `neosantara-light`

Switch with `/settings` → theme, or `--theme <name>`.

## Custom Themes

Create JSON files in `~/.neo-code/agent/themes/` or `.neo-code/themes/`:

```json
{
  "name": "my-theme",
  "vars": {
    "bg": "#1a1a2e",
    "fg": "#e0e0e0",
    "accent": "#00d4aa"
  },
  "colors": {
    "background": "$bg",
    "foreground": "$fg",
    "primary": "$accent",
    "border": "#333355",
    "toolRunning": "#ffaa00",
    "toolDone": "#00cc66",
    "diffAdded": "#00ff88",
    "diffRemoved": "#ff4466",
    "thinkingBorder": "#6644cc"
  }
}
```

## Color Categories

- **Core UI** — background, foreground, primary, border, selection
- **Markdown** — headings, code, links, lists, blockquotes
- **Tool Diffs** — added, removed, context, header
- **Syntax** — keywords, strings, comments, numbers, types
- **Thinking** — border colors per thinking level
- **Status** — success, warning, error, info

## Configuration

| Key | Description |
| --- | --- |
| `theme` | Active theme name |
| `themes` | Additional theme file paths to load |

CLI flags: `--theme <path>`, `--no-themes`

Themes hot-reload via `/reload`.
