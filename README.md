# Neo Code Monorepo

Neo Code is a Neosantara-first coding agent CLI.

## Packages

| Package | Purpose |
| --- | --- |
| `@neosantara/ai` | OpenAI-compatible transport for Neosantara using the `openai` SDK only. |
| `@neosantara/code` | `neo` CLI/TUI coding agent. |
| `@neosantara/agent-core` | Agent loop/runtime primitives. |
| `@neosantara/tui` | Terminal UI primitives. |

## Development workflow

```bash
# Install all workspace dependencies.
npm install --ignore-scripts

# Build all packages in dependency order. Uses npm workspace flags
# (-w @neosantara/...), portable on POSIX shells and Windows.
npm run build

# Lint + typecheck. Run after every change. Tests are not invoked by `check`.
npm run check

# Run tests across all packages.
npm test

# Link the CLI for local use.
npm link --workspace @neosantara/code
neo login
```

Environment variables consumed by the CLI are documented in
[`docs/env.md`](docs/env.md); the starter `.env.example` lives at the repo root.

## Install from source

```bash
npm install --ignore-scripts
npm run build
npm link --workspace @neosantara/code
neo login
```

Device login stores credentials in `~/.neo-code/agent/auth.json`.

## Termux install

Neo Code supports Android/Termux through the source/release installer. Release binaries are built for desktop Linux, macOS, and Windows, so Termux installs build the CLI locally with Node.js.

```bash
pkg install nodejs-lts git
curl -fsSL https://code.neosantara.xyz/install.sh | sh
neo login
```

On Termux, the installer links the `neo` command into `$PREFIX/bin` by default. On non-Termux systems it defaults to `~/.local/bin`; pass `--bin-dir DIR` to override either path.

## Termux touch keyboard

Inside the Neo Code TUI, use `/termux-keys` to manage Android touch-keyboard extra keys:

```txt
/termux-keys show      # preview the Neo layout
/termux-keys apply     # update ~/.termux/termux.properties and back up the old file
/termux-keys restore   # restore the latest Neo-created backup
```

`/termux-keys apply` writes the `extra-keys` layout to `~/.termux/termux.properties`, creates a timestamped backup first, and runs `termux-reload-settings` when available. Restart Termux if the keyboard layout does not refresh immediately.
