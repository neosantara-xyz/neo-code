# Termux Support

Neo Code has first-class support for Android via Termux.

## Installation

```bash
pkg install nodejs-lts git
curl -fsSL https://code.neosantara.xyz/install.sh | sh
```

The installer detects Termux and builds from source. The `neo` command is
linked into `$PREFIX/bin`.

## Touch Keyboard

Configure extra keys for the Neo Code TUI:

```
/termux-keys show      Preview the Neo layout
/termux-keys apply     Update ~/.termux/termux.properties
/termux-keys restore   Restore the previous backup
```

The layout includes Escape, Ctrl, Tab, arrow keys, and pipe — optimized for
the coding agent workflow.

## Termux:API Integration

If `termux-api` is installed, Neo Code can use:

- **Notifications** — Alert when long tasks complete
- **Vibration** — Haptic feedback on completion
- **Clipboard** — Copy/paste integration

Check availability with `/termux-status`.

### Notification Settings

Notifications fire when the terminal is unfocused and a turn exceeds the
minimum duration. Configure in `settings.json`:

| Key | Default | Description |
| --- | --- | --- |
| `notifications.termux.enabled` | false | Enable Termux notifications |
| `notifications.termux.minDurationMs` | 30000 | Min turn duration to trigger |
| `notifications.termux.vibrate` | true | Vibrate on notification |
| `notifications.termux.sound` | false | Play sound on notification |

## Performance Notes

- LSP servers are heavy on mobile — most users won't need them
- The TUI adapts to narrow terminals (compact/tight layouts)
- Auto-compaction keeps sessions responsive on limited RAM
- Background tasks run in Termux's process space

## Responsive TUI

The footer and tool activity tree adapt to terminal width:

| Width | Layout |
| --- | --- |
| >= 72 cols | Full — detail rows, all status items |
| 50-71 cols | Compact — no detail rows, shortened labels |
| < 50 cols | Tight — single summary line |
