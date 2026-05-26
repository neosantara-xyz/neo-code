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
/fork               Fork from current point into new branch
/clone              Clone entire session
/tree               Visual tree navigator
/name <name>        Name or rename current session
/session            Show session info and stats
/import <path>      Import a JSONL session file
/export             Export to HTML or JSONL
/share              Share session via gist
```

## CLI Flags

```bash
neo --continue              Continue last session
neo --resume                Pick a session to resume
neo --fork <session-id>     Fork from a specific session
neo --session-dir <path>    Custom session storage
```

## Branch Summaries

When navigating away from a branch, Neo Code generates a summary so you can
return later with context. Configure:

| Key | Description |
| --- | --- |
| `branchSummary.skipPrompt` | Skip "Summarize branch?" confirmation |
| `branchSummary.reserveTokens` | Token budget for summary generation |

## Double-Escape Action

Configure what happens when you press Escape twice quickly:

| Value | Action |
| --- | --- |
| `tree` | Open tree navigator (default) |
| `tree` | Open tree navigator |
| `none` | Do nothing |

Set via `settings.doubleEscapeAction`.

## Storage

Sessions are stored in `~/.neo-code/agent/sessions/` organized by workspace
path. Override with `NEO_CODE_CODING_AGENT_SESSION_DIR` or `settings.sessionDir`.
