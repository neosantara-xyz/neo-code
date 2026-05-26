# Terminal Setup

Neo Code uses the [Kitty keyboard protocol](https://sw.kovidgoyal.net/kitty/keyboard-protocol/)
for reliable modifier key detection. Most modern terminals support this.

## Kitty, iTerm2

Work out of the box.

## Ghostty

Add to your Ghostty config:

```
keybind = alt+backspace=text:\x1b\x7f
```

## WezTerm

Create `~/.wezterm.lua`:

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.enable_kitty_keyboard = true
return config
```

## VS Code (Integrated Terminal)

Add to `keybindings.json` to enable `Shift+Enter` for multi-line input:

```json
[
  {
    "key": "shift+enter",
    "command": "workbench.action.terminal.sendSequence",
    "args": { "text": "\u001b[13;2u" },
    "when": "terminalFocus"
  }
]
```

## Apple Terminal

Neo Code enables enhanced key reporting when available. If Terminal.app sends
plain Return for `Shift+Enter`, a local macOS modifier fallback is used.

This fallback only works when Neo Code runs on the same Mac as Terminal.app.
