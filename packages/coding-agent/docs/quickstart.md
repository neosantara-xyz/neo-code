# Quickstart

Neo Code is a Neosantara-first terminal coding assistant.

```bash
neo login
neo --provider neosantara --model grok-4.1-fast-non-reasoning
neo --list-models neosantara
```

Credentials are stored in `~/.neo-code/agent/auth.json`.

## Termux quickstart

```bash
pkg install nodejs-lts git
curl -fsSL https://code.neosantara.xyz/install.sh | sh
neo login
```

On Termux, `neo` is installed to `$PREFIX/bin` by default. If that directory is not on `PATH`, add it in your shell profile or pass `--bin-dir DIR` to the installer.

For Android touch-keyboard keys, open Neo Code and run:

```txt
/termux-keys show
/termux-keys apply
```

`/termux-keys apply` updates `~/.termux/termux.properties`, creates a backup first, and reloads Termux settings when `termux-reload-settings` is available. Use `/termux-keys restore` to restore the latest Neo-created backup.
