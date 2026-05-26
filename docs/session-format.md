# Session File Format

Sessions are stored as JSONL (JSON Lines) files. Each line is a JSON object with
a `type` field. Entries form a tree structure via `id`/`parentId` fields,
enabling in-place branching without creating new files.

## File Location

```
~/.neo-code/agent/sessions/--<path>--/<timestamp>_<uuid>.jsonl
```

Where `<path>` is the working directory with `/` replaced by `-`.

## Session Version

- **Version 1**: Linear entry sequence (legacy, auto-migrated)
- **Version 2**: Tree structure with `id`/`parentId` linking
- **Version 3**: Current version

Existing sessions are automatically migrated to v3 when loaded.

## Entry Types

### Header

First entry in every session file (type field is `"session"`):

```json
{"type":"session","version":3,"id":"...","timestamp":"2026-05-27T01:00:00.000Z","cwd":"/path/to/project"}
```

### Message

```json
{"type":"message","id":"...","parentId":"...","timestamp":"2026-05-27T01:00:00.000Z","message":{"role":"user","content":"hello","timestamp":1234567890}}
```

Message roles: `user`, `assistant`, `toolResult`, `bashExecution`, `custom`,
`branchSummary`, `compactionSummary`

### Compaction

```json
{"type":"compaction","id":"...","parentId":"...","timestamp":"2026-05-27T01:00:00.000Z","summary":"...","firstKeptEntryId":"...","tokensBefore":50000,"details":{"readFiles":[],"modifiedFiles":[]}}
```

### Branch Summary

```json
{"type":"branch_summary","id":"...","parentId":"...","timestamp":"2026-05-27T01:00:00.000Z","summary":"...","fromId":"...","details":{"readFiles":[],"modifiedFiles":[]}}
```

### Custom (Extension)

```json
{"type":"custom","id":"...","parentId":"...","timestamp":"2026-05-27T01:00:00.000Z","customType":"my-extension","data":{"key":"value"}}
```

### Label

```json
{"type":"label","id":"...","parentId":"...","timestamp":"2026-05-27T01:00:00.000Z","targetId":"...","label":"checkpoint"}
```

### Thinking Level Change

```json
{"type":"thinking_level_change","id":"...","parentId":"...","timestamp":"2026-05-27T01:00:00.000Z","thinkingLevel":"high"}
```

### Model Change

```json
{"type":"model_change","id":"...","parentId":"...","timestamp":"2026-05-27T01:00:00.000Z","provider":"neosantara","modelId":"deepseek-v4-0324"}
```

### Session Info

```json
{"type":"session_info","id":"...","parentId":"...","timestamp":"2026-05-27T01:00:00.000Z","name":"My Session"}
```

## Content Blocks

Messages contain typed content blocks:

```typescript
// Text
{ type: "text", text: "..." }

// Image
{ type: "image", data: "base64...", mimeType: "image/png" }

// Thinking
{ type: "thinking", thinking: "..." }

// Tool Call
{ type: "toolCall", id: "...", name: "read", arguments: { path: "file.ts" } }
```

## Message Types

### UserMessage

```typescript
{ role: "user", content: string | (TextContent | ImageContent)[], timestamp: number }
```

### AssistantMessage

```typescript
{ role: "assistant", content: (TextContent | ThinkingContent | ToolCall)[], usage: Usage, stopReason: string, timestamp: number }
```

### ToolResultMessage

```typescript
{ role: "toolResult", toolCallId: string, toolName: string, content: (TextContent | ImageContent)[], isError: boolean, timestamp: number }
```

### Extended Messages

- `BashExecutionMessage` — user `!`/`!!` command results
- `CustomMessage` — extension-injected messages (with `customType` and `data`)
- `BranchSummaryMessage` — injected when navigating tree
- `CompactionSummaryMessage` — injected after compaction

## Tree Structure

Entries link via `id`/`parentId`. Multiple children of the same parent create branches:

```
header (id: "a")
  └─ user msg (id: "b", parentId: "a")
       ├─ assistant msg (id: "c", parentId: "b")
       │    └─ tool result (id: "d", parentId: "c")
       └─ assistant msg (id: "e", parentId: "b")  ← branch
```

The active branch is the path from root to the current leaf. `/tree` navigates between branches.

## Deleting Sessions

Delete `.jsonl` files under `~/.neo-code/agent/sessions/`, or use `/resume` and press `Ctrl+D` on a session to delete it interactively.
