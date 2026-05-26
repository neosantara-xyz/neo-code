# Subagents

Subagents are parallel workers that handle tasks independently with their own
context window, keeping the main conversation focused.

## Built-in Types

| Type | Purpose | Tools |
| --- | --- | --- |
| general-purpose | Default delegation | read, grep, find, ls, lsp |
| explore | Codebase exploration | read, grep, find, ls, lsp |
| plan | Planning and analysis | read, grep, find, ls, lsp, todo |
| verification | Verify changes work | read, grep, find, ls, lsp, bash |
| reviewer | Code review | read, grep, find, ls, lsp |

## Custom Subagents

Define custom subagents in `.neo-code/agents/` (project) or
`~/.neo-code/agent/agents/` (global) as markdown files with frontmatter:

```markdown
---
name: my-agent
description: Specialized agent for database migrations
tools:
  - read
  - grep
  - find
  - bash
model: deepseek-v4-0324
maxTurns: 10
mcpServers:
  - my-db-server
---

You are a database migration specialist. Focus on...
```

## Frontmatter Options

| Key | Type | Description |
| --- | --- | --- |
| `name` | string | Agent identifier |
| `description` | string | When to use this agent |
| `tools` | string[] | Allowed tools |
| `disallowedTools` | string[] | Explicitly blocked tools |
| `model` | string | Model override |
| `maxTurns` | number | Maximum conversation turns |
| `mcpServers` | string[] | MCP servers this agent can access |

## Usage

The LLM dispatches subagents via the `agent` tool when tasks benefit from
parallel execution or isolated context. Use `/agents` to list available
subagent definitions.
