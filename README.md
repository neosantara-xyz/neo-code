# NAI Code Monorepo

NAI Code (Neosantara Code) is a Neosantara-first coding agent CLI.

## Packages

| Package | Purpose |
| --- | --- |
| `@neosantara/ai` | OpenAI-compatible transport for Neosantara using the `openai` SDK only. |
| `@neosantara/code` | `nai` CLI/TUI coding agent. |
| `@neosantara/agent-core` | Agent loop/runtime primitives. |
| `@neosantara/tui` | Terminal UI primitives. |

## Install from source

```bash
npm install --ignore-scripts
npm run build
npm link --workspace @neosantara/code
nai login
```

Device login stores credentials in `~/.neosantara-code/agent/auth.json`.
