# SDK

The SDK provides programmatic access to Neo Code's agent capabilities. Use it to
embed Neo Code in other applications, build custom interfaces, or integrate with
automated workflows.

## Quick Start

```typescript
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@neosantara/code";

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("What files are in the current directory?");
```

## Installation

```bash
npm install @neosantara/code
```

The SDK is included in the main package.

## Core Concepts

### createAgentSession()

Factory function for a single `AgentSession`.

```typescript
import { createAgentSession, SessionManager } from "@neosantara/code";

// Minimal: defaults with standard discovery
const { session } = await createAgentSession();

// Custom: override specific options
const { session } = await createAgentSession({
  model: myModel,
  tools: ["read", "bash"],
  sessionManager: SessionManager.inMemory(),
});
```

### AgentSession

Manages agent lifecycle, message history, model state, compaction, and events.

```typescript
// Send prompt and wait for completion
await session.prompt("Fix the bug in utils.ts");

// Queue messages during streaming
await session.steer("Focus on error handling");
await session.followUp("Then run the tests");

// Subscribe to events
session.subscribe((event) => {
  switch (event.type) {
    case "agent_start": break;
    case "message_update": break;
    case "tool_execution_start": break;
    case "agent_end": break;
  }
});

// Model control
session.setModel(model);
session.setThinkingLevel("high");

// Session control
await session.compact();
session.abort();
```

### SessionManager

Controls session persistence.

```typescript
import { SessionManager } from "@neosantara/code";

// In-memory (no persistence, good for testing)
const sm = SessionManager.inMemory();

// File-based (standard JSONL persistence)
const sm = await SessionManager.create(cwd);

// List existing sessions
const sessions = await SessionManager.list(cwd);
```

### ModelRegistry

Manages available models and authentication.

```typescript
import { AuthStorage, ModelRegistry } from "@neosantara/code";

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);

// Get available models
const models = modelRegistry.getModels();

// Find a specific model
const model = modelRegistry.find("neosantara", "deepseek-v4-0324");
```

## Options

```typescript
const { session } = await createAgentSession({
  // Model
  model: myModel,
  thinkingLevel: "medium",
  scopedModels: ["deepseek-*"],

  // Tools
  tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
  customTools: [myCustomTool],
  noTools: false, // "all" | "builtin" | false

  // Session
  sessionManager: SessionManager.inMemory(),
  cwd: "/path/to/project",
  agentDir: "~/.neo-code/agent",
  agentMode: "default",

  // Auth
  authStorage: AuthStorage.create(),
  modelRegistry: ModelRegistry.create(authStorage),

  // Resources (optional — uses DefaultResourceLoader if omitted)
  resourceLoader: myResourceLoader,
  settingsManager: mySettingsManager,
});
```

## Events

Subscribe to all `AgentSessionEvent` types:

| Event | Description |
| --- | --- |
| `agent_start` | Agent begins processing |
| `agent_end` | Agent finished |
| `turn_start` / `turn_end` | LLM turn lifecycle |
| `message_start` / `message_update` / `message_end` | Message streaming |
| `tool_execution_start` / `tool_execution_end` | Tool lifecycle |
| `compaction_start` / `compaction_end` | Compaction events |
| `queue_update` | Message queue changed |

## Runtime Replacement

For multi-session management (switching, forking, resuming), use
`createAgentSessionRuntime` with a factory function:

```typescript
import { createAgentSessionRuntime } from "@neosantara/code";

const runtime = await createAgentSessionRuntime(
  (options) => createAgentSession({ ...options, authStorage, modelRegistry }),
  { cwd, agentDir, sessionManager },
);

// Switch sessions
await runtime.newSession();
await runtime.switchSession(sessionPath);
await runtime.fork(entryId);
```

## RPC Mode

For non-Node.js integrations, use RPC mode:

```bash
neo --mode rpc
```

JSON lines protocol over stdin/stdout with correlation IDs. Supports all
session operations (prompt, steer, abort, model control, compaction, fork, etc.).
