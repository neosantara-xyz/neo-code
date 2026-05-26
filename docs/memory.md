# Memory System

Neo Code persists context across sessions using an automatic memory system.

## How It Works

After each session, Neo Code extracts key decisions, patterns, and project
context into memory entries. These are injected into future sessions to provide
continuity.

## Commands

```
/memory list              Show stored memories (up to 20)
/memory search <query>    Search memories by keyword
/memory add title | body  Manually add a memory
/memory delete <id>       Delete a memory by ID prefix
/memory clear             Delete all memories
/memory prune             Remove stale or over-limit memories
```

## Storage

Memories are stored as markdown files in `~/.neo-code/agent/memories/`. Each
memory has:

- **Title** — Short summary
- **Content** — Full context (max 2000 chars, secrets redacted)
- **Tags** — Categorization (auto-extracted or manual)
- **Usage count** — How often it's been injected
- **Created at** — Timestamp

## Settings

Configure via `/settings`:

- **Max stored** — Maximum number of memories to keep
- **Prune after days** — Auto-remove memories older than N days
- **Max injection chars** — Budget for memory injection per session

## Extraction

Memories are extracted automatically from completed sessions. The system looks
for:

- Project decisions and conventions
- Debugging patterns that worked
- Architecture choices
- Tool configurations
- Recurring workflows
