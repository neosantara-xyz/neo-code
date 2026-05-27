---
inclusion: always
---

# Neo Code Product Context

Neo Code is a Neosantara-first coding agent for terminal workflows.

Core product constraints:

- Built-in provider identity is `neosantara`.
- Built-in runtime transports are OpenAI-compatible `openai-responses` and `openai-completions`.
- Credentials prefer `NEOSANTARA_API_KEY`; device auth via `neo login` is also supported.
- Default API base URL is `https://api.neosantara.xyz/v1`.
- CLI model pricing is represented in IDR and follows Neosantara billing.
- Do not add built-in vendor SDK providers.

Primary surfaces:

- `packages/coding-agent`: CLI, interactive TUI integration, session/runtime behavior.
- `packages/ai`: provider registry, model metadata, OpenAI-compatible transports.
- `packages/agent`: core agent loop and harness.
- `packages/tui`: terminal UI primitives.
- `packages/web`: static Next.js product/docs/pricing site.

Live project rules:

#[[file:AGENTS.md]]

