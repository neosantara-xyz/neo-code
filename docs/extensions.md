# Extensions

Extensions are TypeScript modules that extend Neo Code's behavior. They can
subscribe to lifecycle events, register custom tools callable by the LLM, add
commands, and more.

> **Placement for /reload:** Put extensions in `~/.neo-code/agent/extensions/`
> (global) or `.neo-code/extensions/` (project-local) for auto-discovery.
> Use `neo -e ./path.ts` only for quick tests. Extensions in auto-discovered
> locations can be hot-reloaded with `/reload`.

**Key capabilities:**
- **Custom tools** — Register tools the LLM can call via `neo.registerTool()`
- **Event interception** — Block or modify tool calls, inject context, customize compaction
- **User interaction** — Prompt users via `ctx.ui` (select, confirm, input, notify)
- **Custom UI components** — Full TUI components with keyboard input via `ctx.ui.custom()`
- **Custom commands** — Register commands like `/mycommand` via `neo.registerCommand()`
- **Session persistence** — Store state that survives restarts via `neo.appendEntry()`
- **Custom rendering** — Control how tool calls/results and messages appear in TUI

## Quick Start

Create `~/.neo-code/agent/extensions/my-extension.ts`:

```typescript
import type { ExtensionAPI } from "@neosantara/code";
import { Type } from "typebox";

export default function (neo: ExtensionAPI) {
  neo.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Extension loaded!", "info");
  });

  neo.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("Dangerous!", "Allow rm -rf?");
      if (!ok) return { block: true, reason: "Blocked by user" };
    }
  });

  neo.registerTool({
    name: "greet",
    label: "Greet",
    description: "Greet someone by name",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}!` }],
        details: {},
      };
    },
  });

  neo.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify(`Hello ${args || "world"}!`, "info");
    },
  });
}
```

Test with `--extension` (or `-e`) flag:

```bash
neo -e ./my-extension.ts
```

## Extension Locations

> **Security:** Extensions run with your full system permissions and can execute
> arbitrary code. Only install from sources you trust.

| Location | Scope |
|----------|-------|
| `~/.neo-code/agent/extensions/*.ts` | Global (all projects) |
| `~/.neo-code/agent/extensions/*/index.ts` | Global (subdirectory) |
| `.neo-code/extensions/*.ts` | Project-local |
| `.neo-code/extensions/*/index.ts` | Project-local (subdirectory) |

Additional paths via `settings.json`:

```json
{
  "packages": ["npm:@foo/bar@1.0.0", "git:github.com/user/repo@v1"],
  "extensions": ["/path/to/local/extension.ts"]
}
```

## Available Imports

| Package | Purpose |
|---------|---------|
| `@neosantara/code` | Extension types (`ExtensionAPI`, `ExtensionContext`, events) |
| `typebox` | Schema definitions for tool parameters |
| `@neosantara/ai` | AI utilities |
| `@neosantara/tui` | TUI components for custom rendering |

Node.js built-ins (`node:fs`, `node:path`, etc.) are also available.

## Events

### Lifecycle Overview

```
neo starts
  ├─► session_start { reason: "startup" }
  └─► resources_discover { reason: "startup" }

user sends prompt
  ├─► input (can intercept, transform, or handle)
  ├─► before_agent_start (can inject message, modify system prompt)
  ├─► agent_start
  │   ┌─── turn (repeats while LLM calls tools) ───┐
  │   ├─► turn_start
  │   ├─► context (can modify messages)
  │   ├─► before_provider_request
  │   ├─► after_provider_response
  │   │   LLM responds, may call tools:
  │   │     ├─► tool_execution_start
  │   │     ├─► tool_call (can block)
  │   │     ├─► tool_result (can modify)
  │   │     └─► tool_execution_end
  │   └─► turn_end
  └─► agent_end

/compact or auto-compaction
  ├─► session_before_compact (can cancel or customize)
  └─► session_compact

/tree navigation
  ├─► session_before_tree (can cancel or customize)
  └─► session_tree

exit
  └─► session_shutdown
```

### Key Events

#### tool_call

Fired before tool executes. **Can block.** `event.input` is mutable.

```typescript
neo.on("tool_call", async (event, ctx) => {
  if (event.toolName === "bash" && event.input.command?.includes("sudo")) {
    return { block: true, reason: "Blocked sudo" };
  }
});
```

#### tool_result

Fired after tool execution. **Can modify result.**

```typescript
neo.on("tool_result", async (event, ctx) => {
  return { content: [...], details: {...}, isError: false };
});
```

#### before_agent_start

Fired before agent loop. Can inject messages and modify system prompt.

```typescript
neo.on("before_agent_start", async (event, ctx) => {
  return {
    message: { customType: "my-ext", content: "Extra context", display: true },
    systemPrompt: event.systemPrompt + "\n\nExtra instructions...",
  };
});
```

#### context

Fired before each LLM call. Modify messages non-destructively.

```typescript
neo.on("context", async (event, ctx) => {
  const filtered = event.messages.filter(m => !shouldPrune(m));
  return { messages: filtered };
});
```

#### input

Fired when user input is received. Can intercept, transform, or handle.

```typescript
neo.on("input", async (event, ctx) => {
  if (event.text === "ping") {
    ctx.ui.notify("pong", "info");
    return { action: "handled" };
  }
  return { action: "continue" };
});
```

#### session_before_compact

See [compaction.md](compaction.md) for details.

#### session_shutdown

Fired before extension runtime is torn down.

```typescript
neo.on("session_shutdown", async (event, ctx) => {
  // Cleanup, save state
});
```

## ExtensionContext (ctx)

All handlers receive `ctx: ExtensionContext`.

| Property/Method | Description |
|----------------|-------------|
| `ctx.ui` | UI methods (select, confirm, input, notify, setStatus, setWidget) |
| `ctx.hasUI` | `false` in print/JSON mode |
| `ctx.cwd` | Current working directory |
| `ctx.sessionManager` | Read-only session state |
| `ctx.modelRegistry` | Access to models and API keys |
| `ctx.signal` | Current agent abort signal |
| `ctx.isIdle()` | Whether agent is idle |
| `ctx.abort()` | Abort current agent turn |
| `ctx.shutdown()` | Request graceful shutdown |
| `ctx.compact()` | Trigger compaction |
| `ctx.getSystemPrompt()` | Current system prompt string |
| `ctx.getContextUsage()` | Current context token usage |

## ExtensionAPI Methods (neo)

| Method | Description |
|--------|-------------|
| `neo.on(event, handler)` | Subscribe to events |
| `neo.registerTool(def)` | Register LLM-callable tool |
| `neo.registerCommand(name, opts)` | Register slash command |
| `neo.registerShortcut(key, opts)` | Register keyboard shortcut |
| `neo.registerFlag(name, opts)` | Register CLI flag |
| `neo.registerProvider(name, config)` | Register model provider |
| `neo.registerMessageRenderer(type, fn)` | Custom message rendering |
| `neo.sendMessage(msg, opts)` | Inject custom message |
| `neo.sendUserMessage(content, opts)` | Send user message |
| `neo.appendEntry(type, data)` | Persist extension state |
| `neo.setSessionName(name)` | Set session display name |
| `neo.setLabel(entryId, label)` | Set entry label/bookmark |
| `neo.exec(cmd, args, opts)` | Execute shell command |
| `neo.getActiveTools()` | Get active tool list |
| `neo.getAllTools()` | Get all registered tools |
| `neo.setActiveTools(names)` | Enable/disable tools |
| `neo.setModel(model)` | Set current model |
| `neo.getThinkingLevel()` | Get thinking level |
| `neo.setThinkingLevel(level)` | Set thinking level |
| `neo.getCommands()` | Get available commands |
| `neo.events` | Shared event bus between extensions |

## Custom Tools

```typescript
import { Type } from "typebox";

neo.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does (shown to LLM)",
  parameters: Type.Object({
    action: Type.String(),
    text: Type.Optional(Type.String()),
  }),

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    onUpdate?.({ content: [{ type: "text", text: "Working..." }] });

    return {
      content: [{ type: "text", text: "Done" }],
      details: { result: "..." },
    };
  },

  // Optional: Custom TUI rendering
  renderCall(args, theme, context) { /* return Component */ },
  renderResult(result, options, theme, context) { /* return Component */ },
});
```

**Error signaling:** Throw from `execute` to mark as error. Return values never set error flag.

**Early termination:** Return `terminate: true` to skip follow-up LLM call.

## Custom UI

### Dialogs

```typescript
const choice = await ctx.ui.select("Pick one:", ["A", "B", "C"]);
const ok = await ctx.ui.confirm("Delete?", "This cannot be undone");
const name = await ctx.ui.input("Name:", "placeholder");
const text = await ctx.ui.editor("Edit:", "prefilled text");
ctx.ui.notify("Done!", "info");
```

### Widgets & Status

```typescript
ctx.ui.setStatus("my-ext", "Processing...");
ctx.ui.setStatus("my-ext", undefined);  // Clear
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"]);
ctx.ui.setWidget("my-widget", undefined);  // Clear
ctx.ui.setTitle("neo - my-project");
ctx.ui.setEditorText("Prefill text");
```

### Custom Components

```typescript
const result = await ctx.ui.custom<boolean>((tui, theme, keybindings, done) => {
  const text = new Text("Press Enter to confirm, Escape to cancel", 1, 1);
  text.onKey = (key) => {
    if (key === "return") done(true);
    if (key === "escape") done(false);
    return true;
  };
  return text;
});
```

## State Management

Store state in tool result `details` for proper branching support:

```typescript
export default function (neo: ExtensionAPI) {
  let items: string[] = [];

  neo.on("session_start", async (_event, ctx) => {
    items = [];
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "message" && entry.message.role === "toolResult") {
        if (entry.message.toolName === "my_tool") {
          items = entry.message.details?.items ?? [];
        }
      }
    }
  });

  neo.registerTool({
    name: "my_tool",
    parameters: Type.Object({ text: Type.String() }),
    async execute(toolCallId, params) {
      items.push(params.text);
      return {
        content: [{ type: "text", text: "Added" }],
        details: { items: [...items] },
      };
    },
  });
}
```

## Provider Registration

```typescript
neo.registerProvider("my-proxy", {
  name: "My Proxy",
  baseUrl: "https://proxy.example.com",
  apiKey: "PROXY_API_KEY",
  api: "openai-completions",
  models: [{
    id: "my-model",
    name: "My Model",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 4096,
  }],
});
```

## Error Handling

- Extension errors are logged, agent continues
- `tool_call` errors block the tool (fail-safe)
- Tool `execute` errors must be signaled by throwing

## Mode Behavior

| Mode | UI Methods | Notes |
|------|-----------|-------|
| Interactive | Full TUI | Normal operation |
| RPC (`--mode rpc`) | JSON protocol | Host handles UI |
| JSON (`--mode json`) | No-op | Event stream to stdout |
| Print (`-p`) | No-op | Extensions run but can't prompt |

Check `ctx.hasUI` before using UI methods in non-interactive modes.
