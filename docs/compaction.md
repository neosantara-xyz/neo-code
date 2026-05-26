# Compaction & Branch Summarization

LLMs have limited context windows. When conversations grow too long, Neo Code
uses compaction to summarize older content while preserving recent work.

## Overview

| Mechanism | Trigger | Purpose |
|-----------|---------|---------|
| Compaction | Context exceeds threshold, or `/compact` | Summarize old messages to free context |
| Branch summarization | `/tree` navigation | Preserve context when switching branches |

Both use the same structured summary format and track file operations cumulatively.

## Compaction

### When It Triggers

Auto-compaction triggers when:

```
contextTokens >= contextWindow - effectiveReserve
effectiveReserve = max(reserveTokens, min(maxOutputTokens, 20000) + 13000)
```

Default `reserveTokens` is 16384 tokens. The effective reserve may be higher
when the selected model advertises a large output budget.

Manual: `/compact [instructions]` where optional instructions focus the summary.

### How It Works

1. **Find cut point** — Walk backwards from newest message, accumulating tokens until `keepRecentTokens` (default 20000) is reached
2. **Extract messages** — Collect messages from previous boundary to cut point
3. **Generate summary** — Call LLM with structured format, passing previous summary as iterative context
4. **Append entry** — Save `CompactionEntry` with summary and `firstKeptEntryId`
5. **Reload** — Session uses summary + messages from `firstKeptEntryId` onwards

```
Before compaction:

  entry:  0     1     2     3      4     5     6      7      8     9
        ┌─────┬─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┘
                └────────┬───────┘ └──────────────┬──────────────┘
               messagesToSummarize            kept messages
                                   ↑
                          firstKeptEntryId (entry 4)

What the LLM sees after compaction:

  ┌────────┬─────────┬─────┬─────┬──────┬──────┬─────┬──────┐
  │ system │ summary │ usr │ ass │ tool │ tool │ ass │ tool │
  └────────┴─────────┴─────┴─────┴──────┴──────┴─────┴──────┘
       ↑         ↑      └─────────────────┬────────────────┘
    prompt   from cmp          messages from firstKeptEntryId
```

On repeated compactions, the summarized span starts at the previous compaction's
kept boundary, not at the compaction entry itself. This preserves messages that
survived earlier compaction by including them in the next summarization pass.

### Split Turns

A "turn" starts with a user message and includes all assistant responses and
tool calls until the next user message. Normally, compaction cuts at turn
boundaries.

When a single turn exceeds `keepRecentTokens`, the cut point lands mid-turn.
For split turns, Neo Code generates two summaries and merges them:
1. **History summary** — Previous context (if any)
2. **Turn prefix summary** — The early part of the split turn

### Cut Point Rules

Valid cut points: user messages, assistant messages, bash executions, custom
messages. Never cut at tool results (they must stay with their tool call).

## Branch Summarization

### When It Triggers

When you use `/tree` to navigate to a different branch, Neo Code offers to
summarize the work you're leaving. This injects context from the old branch
into the new position.

### How It Works

1. **Find common ancestor** — Deepest node shared by old and new positions
2. **Collect entries** — Walk from old leaf back to common ancestor
3. **Prepare with budget** — Include messages up to token budget (newest first)
4. **Generate summary** — Call LLM with structured format
5. **Append entry** — Save `BranchSummaryEntry` at navigation point

```
Tree before navigation:

         ┌─ B ─ C ─ D (old leaf, being abandoned)
    A ───┤
         └─ E ─ F (target)

Common ancestor: A
Entries to summarize: B, C, D
```

### Cumulative File Tracking

Both mechanisms track files cumulatively. When generating a summary, Neo Code
extracts file operations from tool calls in the messages being summarized plus
previous summary details. This preserves the full history of read and modified
files across multiple compactions.

## Summary Format

Both compaction and branch summarization produce:

```markdown
## Goal
[What the user is trying to accomplish]

## Constraints & Preferences
- [Requirements mentioned by user]

## Progress
### Done
- [x] [Completed tasks]

### In Progress
- [ ] [Current work]

## Key Decisions
- **[Decision]**: [Rationale]

## Next Steps
1. [What should happen next]

## Critical Context
- [Data needed to continue]

<read-files>
path/to/file1.ts
</read-files>

<modified-files>
path/to/changed.ts
</modified-files>
```

Tool results are truncated to 2000 characters during serialization to keep
summarization requests within reasonable token budgets.

## Custom Summarization via Extensions

Extensions can intercept both compaction and branch summarization.

### session_before_compact

Fired before auto-compaction or `/compact`. Can cancel or provide custom summary:

```typescript
neo.on("session_before_compact", async (event, ctx) => {
  const { preparation, signal } = event;

  // Cancel:
  return { cancel: true };

  // Custom summary:
  return {
    compaction: {
      summary: "Your summary...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      details: { /* custom data */ },
    }
  };
});
```

### session_before_tree

Fired before `/tree` navigation. Can cancel or provide custom summary:

```typescript
neo.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;

  if (preparation.userWantsSummary) {
    return {
      summary: {
        summary: "Your summary...",
        details: { /* custom data */ },
      }
    };
  }
});
```

## Settings

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  },
  "branchSummary": {
    "skipPrompt": false,
    "reserveTokens": 16384
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `compaction.enabled` | true | Enable auto-compaction |
| `compaction.reserveTokens` | 16384 | Tokens to reserve for LLM response |
| `compaction.keepRecentTokens` | 20000 | Recent tokens to keep (not summarized) |
| `branchSummary.skipPrompt` | false | Skip the confirmation prompt and do not generate a branch summary |
| `branchSummary.reserveTokens` | 16384 | Token budget for branch summary generation |

Disable auto-compaction with `"enabled": false`. Manual `/compact` still works.
