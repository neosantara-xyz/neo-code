# Sessions

Neo Code sessions are stored as trees, enabling branching, forking, and
navigation across conversation history.

## Session Tree

Every message is a node in a tree. When you fork or branch, you create a new
path from any point. Use `/tree` to visualize and navigate.

Tree filter modes (cycle with keybinding):
- **default** — All messages
- **no-tools** — Hide tool calls
- **user-only** — Only user messages
- **labeled-only** — Only labeled/bookmarked entries
- **all** — Everything including system

## Commands

```
/new                Start a fresh session
/resume             Resume a previous session (picker)
/fork               Pick a user message and fork a new session from it
/clone              Clone entire session
/tree               Visual tree navigator
/name <name>        Name or rename current session
/rename <name>      Alias for /name
/session            Show session info and stats
/import <path>      Import a JSONL session file
/export [path]      Export to HTML or JSONL
/share [gist|local] Share session via gist or local OS share sheet
```

## CLI Flags

```bash
neo --continue              Continue last session
neo --resume                Pick a session to resume
neo --session <path|id>     Use a specific session file or partial UUID
neo --fork <path|id>        Fork a specific session file or partial UUID
neo --session-dir <path>    Custom session storage
neo --no-session            Run without saving session history
```

## Branch Summaries

When navigating away from a branch, Neo Code generates a summary so you can
return later with context. Configure:

| Key | Description |
| --- | --- |
| `branchSummary.skipPrompt` | Skip the confirmation prompt and do not generate a branch summary |
| `branchSummary.reserveTokens` | Token budget for summary generation |
| `treeFilterMode` | Default `/tree` filter: `default`, `no-tools`, `user-only`, `labeled-only`, or `all` |

## Double-Escape Action

Configure what happens when you press Escape twice quickly:

| Value | Action |
| --- | --- |
| `tree` | Open tree navigator (default) |
| `fork` | Pick a user message and fork a new session from it |
| `none` | Do nothing |

Set via `settings.doubleEscapeAction`.

## Storage

Sessions are stored in `~/.neo-code/agent/sessions/` organized by workspace
path. Override with `NEO_CODE_CODING_AGENT_SESSION_DIR` or `settings.sessionDir`.
