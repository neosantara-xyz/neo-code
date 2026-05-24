# Code intelligence (LSP)

Neo Code can use real Language Server Protocol (LSP) servers to navigate code
symbols. The `lsp` tool exposed to the agent and the `/lsp` slash command both
read from the same lazily-spawned LSP manager.

## How detection works

Neo looks for LSP binaries on `PATH` using `command -v`. No language servers
are bundled. When you call the `lsp` tool or `/lsp init`, Neo:

1. Looks up the LSP server config matching the file extension (or asks every
   installed server for `workspace/symbol`).
2. Spawns the LSP process lazily, one per server, scoped to the current
   workspace root.
3. Reuses the same connection for follow-up calls in the same session.
4. Shuts down LSP processes on `SIGINT`, `SIGTERM`, or `process.exit`.

If no matching binary is on `PATH`, the tool returns a clear install hint
instead of guessing — the agent will fall back to `grep`/`find` when needed.

## Supported servers

| Server                          | Languages    | Install hint                                                |
| ------------------------------- | ------------ | ----------------------------------------------------------- |
| `typescript-language-server`    | TS, JS, JSX  | `npm install -g typescript-language-server typescript`      |
| `pyright-langserver`            | Python       | `npm install -g pyright`                                    |
| `rust-analyzer`                 | Rust         | `rustup component add rust-analyzer`                        |
| `gopls`                         | Go           | `go install golang.org/x/tools/gopls@latest`                |
| `clangd`                        | C, C++       | `apt install clangd` / `brew install llvm`                  |
| `jdtls`                         | Java         | install Eclipse JDT Language Server, ensure `jdtls` on PATH |
| `solargraph`                    | Ruby         | `gem install solargraph`                                    |

## Slash command

```
/lsp              show installed/running servers (alias of /lsp status)
/lsp status       same as above
/lsp init         start every installed server
/lsp init <id>    start a single server (e.g., /lsp init pyright)
/lsp logs <id>    show recent stderr/log output from a server
/lsp restart <id> restart a running server
/lsp stop         stop all running servers
```

## Tool actions

The agent tool name remains `lsp`. Three actions are supported:

- `workspaceSymbols` — fuzzy symbol search. `path` is optional; when omitted Neo
  asks every installed server.
- `definition` — jump to the declaration of a symbol. Requires a `path`
  pointing to a source file. Neo finds the first occurrence of `query` inside
  that file as the anchor position.
- `references` — find all references to a symbol. Same anchoring rules as
  `definition`.

## Termux notes

LSP servers are heavy. On Termux/Android most users will not have one installed
and the tool will degrade gracefully with an install hint. If you do install
`typescript-language-server` (works on Termux via `npm install -g`), Neo will
spawn it on demand.
