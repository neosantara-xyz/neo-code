# Shell Aliases

Neo Code runs bash in non-interactive mode (`bash -c`), which doesn't expand
aliases by default.

To enable your shell aliases, add to `~/.neo-code/agent/settings.json`:

```json
{
  "shellCommandPrefix": "shopt -s expand_aliases\neval \"$(grep '^alias ' ~/.bashrc)\""
}
```

Adjust the path (`~/.bashrc`, `~/.zshrc`, etc.) to match your shell config.
