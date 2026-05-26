# tmux Setup

Neo Code works inside tmux, but tmux strips modifier information from certain
keys by default. Without configuration, `Shift+Enter` is indistinguishable
from plain `Enter`.

## Recommended Configuration

Add to `~/.tmux.conf`:

```tmux
set -g extended-keys on
set -g extended-keys-format csi-u
```

Then restart tmux:

```bash
tmux kill-server
tmux
```

## What This Fixes

| Key | Without extkeys | With `csi-u` |
|-----|-----------------|--------------|
| Enter | `\r` | `\r` |
| Shift+Enter | `\r` | `\x1b[13;2u` |
| Ctrl+Enter | `\r` | `\x1b[13;5u` |
| Alt+Enter | `\x1b\r` | `\x1b[13;3u` |

This affects the default keybindings (`Enter` to submit, `Shift+Enter` for
newline) and any custom keybindings using modified Enter.

## Requirements

- tmux 3.2 or later (`tmux -V`)
- A terminal that supports extended keys (Ghostty, Kitty, iTerm2, WezTerm)
