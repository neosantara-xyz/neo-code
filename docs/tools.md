# Tools

Neo Code exposes tools to the AI model for interacting with your codebase.

## Built-in Tools

| Tool | Description |
| --- | --- |
| `read` | Read file contents with line ranges |
| `write` | Create or overwrite files |
| `edit` | Apply targeted edits to existing files |
| `bash` | Execute shell commands |
| `grep` | Search file contents with regex |
| `find` | Find files by glob pattern |
| `ls` | List directory contents |
| `lsp` | Language Server Protocol queries |
| `todo` | Manage task plans |
| `agent` | Dispatch subagent for parallel work |

## Permissions

Tools require approval based on the workflow mode:

- **Read-only tools** (read, grep, find, ls, lsp) — always allowed
- **Write tools** (edit, write) — require approval in default mode
- **Shell commands** (bash) — require approval in default mode

Use `/permissions` to adjust, or switch to `accept-edits` or `full` mode.

## Extensions

Custom tools can be added via extensions in `.neo-code/extensions/`. Extensions
can register:

- Custom tool handlers
- Slash commands
- Event hooks
- Autocomplete providers
