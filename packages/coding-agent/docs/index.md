# Neo Code

Neo Code is a Neosantara-first terminal coding assistant.

```bash
neo login
neo --provider neosantara --model grok-4.1-fast-non-reasoning
neo --list-models neosantara
```

Credentials are stored in `~/.neo-code/agent/auth.json`.

## Termux

Neo Code can be installed on Android/Termux with the release installer. Termux builds from source because desktop release binaries are not compatible with Android libc.

```bash
pkg install nodejs-lts git
curl -fsSL https://code.neosantara.xyz/install.sh | sh
neo login
```

The installer places `neo` in `$PREFIX/bin` on Termux. Use `--bin-dir DIR` to choose a different command path.

Use `/termux-keys` inside the TUI to preview, apply, or restore the Neo touch-keyboard layout. The command updates `~/.termux/termux.properties`, backs up the previous file, and reloads Termux settings when possible.

See [Termux](./termux.md) for the full command reference.
