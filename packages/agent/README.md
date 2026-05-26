# @neosantara/agent-core

Core agent loop and runtime primitives for Neo Code. Provider-agnostic — works
with any LLM transport that implements the `@neosantara/ai` stream interface.

## Architecture

```
Agent (high-level API)
  └── AgentLoop (turn execution, tool dispatch)
       ├── StreamFn (LLM call boundary)
       ├── AgentTool[] (tool registry)
       └── AgentEvent sink (event stream)

AgentHarness (session management, compaction, prompt templates)
  ├── Session (tree-based message storage)
  ├── Compaction (context window management)
  ├── BranchSummarization (fork/resume summaries)
  ├── Skills (skill loading and injection)
  └── PromptTemplates (system prompt composition)
```

## Core Components

### Agent

High-level agent class with message queuing, steering, and state management.

```ts
import { Agent } from "@neosantara/agent-core";

const agent = new Agent({
  model,
  tools,
  systemPrompt: "You are a coding assistant.",
  streamFn: (model, context, options) => streamSimple(model, context, options),
});

agent.on("event", (event) => { /* handle events */ });
await agent.prompt("Hello");
```

Features:
- Message queue with `steer` (interrupt) and `followUp` (append) modes
- Configurable queue delivery: `"all"` or `"one-at-a-time"`
- Tool execution modes: `"sequential"` or `"parallel"`
- Lifecycle hooks: `beforeToolCall`, `afterToolCall`, `shouldStopAfterTurn`
- Abort support via `AbortSignal`

### AgentLoop

Low-level loop that executes a single prompt through multiple LLM turns until
the model stops calling tools.

```ts
import { runAgentLoop } from "@neosantara/agent-core";

await runAgentLoop({
  messages,
  tools,
  streamFn,
  config: { maxTurns: 10, toolExecutionMode: "parallel" },
  emit: (event) => { /* ... */ },
});
```

Events emitted: `agent_start`, `agent_end`, `turn_start`, `turn_end`,
`message_start`, `message_update`, `message_end`, `tool_execution_start`,
`tool_execution_end`.

### AgentHarness

Session-aware wrapper that adds persistence, compaction, and prompt templates.

```ts
import { AgentHarness } from "@neosantara/agent-core";

const harness = new AgentHarness({
  model,
  tools,
  session,
  executionEnv,
  systemPromptParts: [basePrompt, skills, memories],
});

await harness.prompt("Fix the bug in utils.ts");
```

Features:
- Session persistence (JSONL or in-memory)
- Auto-compaction when context approaches limit
- Branch summarization for tree navigation
- Prompt template composition with token budgets
- Skill injection with priority ordering

## Session System

Tree-based session storage supporting fork, resume, and branch navigation.

```ts
import { Session, JsonlSessionRepo } from "@neosantara/agent-core";

const repo = new JsonlSessionRepo("/path/to/session.jsonl");
const session = await Session.load(repo);

// Append entries
session.append({ role: "user", content: "hello" });

// Fork from any point
const forked = session.fork(entryId);
```

Storage backends:
- `JsonlSessionRepo` — file-based JSONL persistence
- `MemorySessionRepo` — in-memory (testing)

## Compaction

Automatic context window management.

```ts
import { shouldCompact, compact } from "@neosantara/agent-core";

if (shouldCompact(messages, model.contextWindow, settings)) {
  const result = await compact(messages, model, streamFn, settings);
  // result.summary, result.keptMessages
}
```

Functions:
- `shouldCompact` — check if compaction is needed
- `compact` — generate summary and trim messages
- `estimateTokens` — estimate token count for messages
- `findCutPoint` — find optimal cut point preserving turn boundaries
- `generateBranchSummary` — summarize a branch for tree navigation

## Tool Interface

```ts
import type { AgentTool } from "@neosantara/agent-core";

const myTool: AgentTool = {
  name: "read_file",
  description: "Read a file",
  parameters: Type.Object({ path: Type.String() }),
  async execute(args, context) {
    return { content: [{ type: "text", text: "file contents..." }] };
  },
};
```

## Event Types

| Event | Description |
| --- | --- |
| `agent_start` | Agent begins processing |
| `agent_end` | Agent finished all turns |
| `turn_start` | New LLM turn begins |
| `turn_end` | LLM turn completed |
| `message_start` | Assistant message streaming begins |
| `message_update` | Streaming token/content update |
| `message_end` | Complete assistant message received |
| `tool_execution_start` | Tool call begins |
| `tool_execution_end` | Tool call completed |

## Proxy

Utilities for proxying agent events between processes (used by subagents).

```ts
import { AgentProxy } from "@neosantara/agent-core";
```
