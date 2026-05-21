# Providers

Neo Code is a Neosantara-first terminal coding assistant.

```bash
neo login
neo --provider neosantara --model grok-4.1-fast-non-reasoning
neo --list-models neosantara
```

Credentials are stored in `~/.neo-code/agent/auth.json`.

## Termux note

Provider setup is the same on Termux. Install with the Termux path-aware installer, then run `neo login`:

```bash
pkg install nodejs-lts git
curl -fsSL https://code.neosantara.xyz/install.sh | sh
neo login
```

The installer links `neo` into `$PREFIX/bin` on Termux. Touch-keyboard setup is handled separately in the TUI with `/termux-keys apply`, and can be undone with `/termux-keys restore`.
