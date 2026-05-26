# Neo Code

A Neosantara-first AI coding agent that runs in your terminal. Cross-session
memory, code intelligence, subagents, and 12+ built-in tools.

```bash
curl -fsSL https://code.neosantara.xyz/install.sh | sh
neo login
```

**Website:** [code.neosantara.xyz](https://code.neosantara.xyz)
**Docs:** [code.neosantara.xyz/docs](https://code.neosantara.xyz/docs)

## Features

- Cross-session memory with auto-extraction
- LSP-powered code intelligence (TypeScript, Python, Go, Rust, Java, Ruby, C/C++)
- Subagent delegation for parallel tasks
- MCP server integration
- Auto-compaction for long sessions
- Session tree with fork/clone/resume
- Background shell tasks
- Code review (`/review`)
- Installable skills and extensions
- Full theming system
- Termux (Android) first-class support

## Install

**macOS / Linux:**
```bash
curl -fsSL https://code.neosantara.xyz/install.sh | sh
```

**Termux (Android):**
```bash
pkg install nodejs-lts git
curl -fsSL https://code.neosantara.xyz/install.sh | sh
```

**From source:**
```bash
git clone https://github.com/neosantara-xyz/neo-code.git
cd neo-code
npm install --ignore-scripts
npm run build
npm link --workspace @neosantara-xyz/code
```

## Packages

| Package | Purpose |
| --- | --- |
| `@neosantara-xyz/ai` | OpenAI-compatible transport for Neosantara |
| `@neosantara-xyz/code` | `neo` CLI/TUI coding agent |
| `@neosantara-xyz/agent-core` | Agent loop/runtime primitives |
| `@neosantara-xyz/tui` | Terminal UI primitives |
| `@neosantara-xyz/web` | Landing page and docs (static export) |

## Development

```bash
npm install --ignore-scripts
npm run build
npm run check    # lint + typecheck (no tests)
npm test         # run tests
```

Environment variables: [`docs/env.md`](docs/env.md)

## Documentation

- [Getting Started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
- [Tools](docs/tools.md)
- [Sessions](docs/sessions.md)
- [Subagents](docs/subagents.md)
- [Extensions](docs/extensions.md)
- [Themes](docs/themes.md)
- [Memory](docs/memory.md)
- [Skills](docs/skills.md)
- [LSP](docs/lsp.md)
- [Termux](docs/termux.md)
- [Environment Variables](docs/env.md)

## License

MIT
