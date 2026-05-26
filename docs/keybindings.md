# Keybindings

All keyboard shortcuts can be customized via `~/.neo-code/agent/keybindings.json`.
Each action can be bound to one or more keys.

After editing, run `/reload` to apply changes without restarting.

## Key Format

`modifier+key` where modifiers are `ctrl`, `shift`, `alt` (combinable) and keys are:

- **Letters:** `a-z`
- **Digits:** `0-9`
- **Special:** `escape`, `enter`, `tab`, `space`, `backspace`, `delete`, `home`, `end`, `pageUp`, `pageDown`, `up`, `down`, `left`, `right`
- **Function:** `f1`-`f12`

Modifier combinations: `ctrl+shift+x`, `alt+ctrl+x`, etc.

## All Actions

### Editor Cursor Movement

| ID | Default | Description |
|----|---------|-------------|
| `tui.editor.cursorUp` | `up` | Move cursor up |
| `tui.editor.cursorDown` | `down` | Move cursor down |
| `tui.editor.cursorLeft` | `left`, `ctrl+b` | Move cursor left |
| `tui.editor.cursorRight` | `right`, `ctrl+f` | Move cursor right |
| `tui.editor.cursorWordLeft` | `alt+left`, `ctrl+left`, `alt+b` | Move word left |
| `tui.editor.cursorWordRight` | `alt+right`, `ctrl+right`, `alt+f` | Move word right |
| `tui.editor.cursorLineStart` | `home`, `ctrl+a` | Move to line start |
| `tui.editor.cursorLineEnd` | `end`, `ctrl+e` | Move to line end |
| `tui.editor.jumpForward` | `ctrl+]` | Jump forward to character |
| `tui.editor.jumpBackward` | `ctrl+alt+]` | Jump backward to character |
| `tui.editor.pageUp` | `pageUp` | Page up |
| `tui.editor.pageDown` | `pageDown` | Page down |

### Editor Deletion

| ID | Default | Description |
|----|---------|-------------|
| `tui.editor.deleteCharBackward` | `backspace` | Delete char backward |
| `tui.editor.deleteCharForward` | `delete`, `ctrl+d` | Delete char forward |
| `tui.editor.deleteWordBackward` | `ctrl+w`, `alt+backspace` | Delete word backward |
| `tui.editor.deleteWordForward` | `alt+d`, `alt+delete` | Delete word forward |
| `tui.editor.deleteToLineStart` | `ctrl+u` | Delete to line start |
| `tui.editor.deleteToLineEnd` | `ctrl+k` | Delete to line end |

### Editor Input

| ID | Default | Description |
|----|---------|-------------|
| `tui.input.newLine` | `shift+enter` | Insert new line |
| `tui.input.submit` | `enter` | Submit input |
| `tui.input.tab` | `tab` | Tab / autocomplete |
| `tui.input.copy` | `ctrl+c` | Copy selection |

### Selection Lists

| ID | Default | Description |
|----|---------|-------------|
| `tui.select.up` | `up` | Move selection up |
| `tui.select.down` | `down` | Move selection down |
| `tui.select.pageUp` | `pageUp` | Page selection up |
| `tui.select.pageDown` | `pageDown` | Page selection down |
| `tui.select.confirm` | `enter` | Confirm selection |
| `tui.select.cancel` | `escape`, `ctrl+c` | Cancel selection |

### Kill Ring

| ID | Default | Description |
|----|---------|-------------|
| `tui.editor.yank` | `ctrl+y` | Paste deleted text |
| `tui.editor.yankPop` | `alt+y` | Cycle deleted text |
| `tui.editor.undo` | `ctrl+-` | Undo last edit |

### Application

| ID | Default | Description |
|----|---------|-------------|
| `app.interrupt` | `escape` | Cancel / abort |
| `app.clear` | `ctrl+c` | Clear editor |
| `app.exit` | `ctrl+d` | Exit (when editor empty) |
| `app.suspend` | `ctrl+z` | Suspend to background |
| `app.editor.external` | `ctrl+g` | Open external editor |
| `app.clipboard.pasteImage` | `ctrl+v` | Paste image |
| `app.mode.cycle` | `shift+tab` | Cycle workflow mode |
| `app.thinking.cycle` | `alt+t` | Cycle thinking level |
| `app.thinking.toggle` | *(none)* | Toggle thinking blocks |
| `app.transcript.view` | `ctrl+t` | View transcript/tool output |
| `app.task.background` | `ctrl+b` | Background current shell task |
| `app.tasks.open` | *(none)* | Show background tasks |
| `app.model.select` | `ctrl+l` | Open model selector |
| `app.model.cycleForward` | `ctrl+p` | Cycle model forward |
| `app.model.cycleBackward` | `shift+ctrl+p` | Cycle model backward |
| `app.tools.expand` | `ctrl+o` | Expand/collapse tool output |
| `app.message.followUp` | `alt+enter` | Queue follow-up message |
| `app.message.dequeue` | `alt+up` | Restore queued messages |

### Sessions

| ID | Default | Description |
|----|---------|-------------|
| `app.session.new` | *(none)* | Start new session |
| `app.session.tree` | *(none)* | Open tree navigator |
| `app.session.fork` | *(none)* | Fork session |
| `app.session.resume` | *(none)* | Open resume picker |
| `app.session.rename` | `ctrl+r` | Rename session |
| `app.session.delete` | `ctrl+d` | Delete session |
| `app.session.deleteNoninvasive` | `ctrl+backspace` | Delete session when query is empty |
| `app.session.togglePath` | `ctrl+p` | Toggle path display |
| `app.session.toggleSort` | `ctrl+s` | Toggle sort mode |
| `app.session.toggleNamedFilter` | `ctrl+n` | Toggle named filter |

### Tree Navigation

| ID | Default | Description |
|----|---------|-------------|
| `app.tree.foldOrUp` | `ctrl+left`, `alt+left` | Fold branch or jump up |
| `app.tree.unfoldOrDown` | `ctrl+right`, `alt+right` | Unfold branch or jump down |
| `app.tree.editLabel` | `shift+l` | Edit label |
| `app.tree.toggleLabelTimestamp` | `shift+t` | Toggle label timestamps |
| `app.tree.filter.default` | `ctrl+d` | Default filter |
| `app.tree.filter.noTools` | `ctrl+h` | Hide tool results |
| `app.tree.filter.userOnly` | `ctrl+u` | User messages only |
| `app.tree.filter.labeledOnly` | `ctrl+l` | Labeled entries only |
| `app.tree.filter.all` | `ctrl+a` | Show all entries |
| `app.tree.filter.cycleForward` | `ctrl+o` | Cycle filter forward |
| `app.tree.filter.cycleBackward` | `shift+ctrl+o` | Cycle filter backward |

### Scoped Models Selector

| ID | Default | Description |
|----|---------|-------------|
| `app.models.save` | `ctrl+s` | Save selection |
| `app.models.enableAll` | `ctrl+a` | Enable all models |
| `app.models.clearAll` | `ctrl+x` | Clear all models |
| `app.models.toggleProvider` | `ctrl+p` | Toggle provider |
| `app.models.reorderUp` | `alt+up` | Move model up |
| `app.models.reorderDown` | `alt+down` | Move model down |

## Custom Configuration

Create `~/.neo-code/agent/keybindings.json`:

```json
{
  "tui.editor.cursorUp": ["up", "ctrl+p"],
  "tui.editor.cursorDown": ["down", "ctrl+n"],
  "app.interrupt": "escape"
}
```

Each action can have a single key or an array of keys. User config overrides defaults.
