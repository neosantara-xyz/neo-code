# TUI Components

Neo Code's TUI framework (`@neosantara/tui`) provides components for building
extension UIs. Full API reference is in the
[TUI package README](https://github.com/neosantara-xyz/neo-code/blob/main/packages/tui/README.md).

## Quick Reference

### Available Components

| Component | Purpose |
| --- | --- |
| `Text` | Multi-line text with word wrap |
| `TruncatedText` | Single-line with truncation |
| `Container` | Groups child components |
| `Box` | Container with padding and background |
| `Editor` | Multi-line input with autocomplete |
| `Input` | Single-line input |
| `Markdown` | Rendered markdown |
| `Loader` | Animated spinner |
| `CancellableLoader` | Spinner with Escape to cancel |
| `SelectList` | Interactive selection |
| `SettingsList` | Settings with value cycling |
| `Spacer` | Vertical spacing |
| `Image` | Inline images (Kitty/iTerm2) |

### Component Interface

```typescript
interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  invalidate?(): void;
}
```

Each line from `render()` must not exceed `width`.

### Key Detection

```typescript
import { matchesKey, Key } from "@neosantara/tui";

if (matchesKey(data, Key.enter)) submit();
if (matchesKey(data, Key.escape)) cancel();
if (matchesKey(data, Key.ctrl("c"))) exit();
```

### Utilities

```typescript
import { visibleWidth, truncateToWidth, wrapTextWithAnsi } from "@neosantara/tui";

visibleWidth("\x1b[31mHello\x1b[0m");     // 5
truncateToWidth("Hello World", 8);         // "Hello..."
wrapTextWithAnsi("Long text...", 20);      // ["Long", "text..."]
```

### Extension UI Pattern

```typescript
import { Text } from "@neosantara/tui";

// In renderCall or renderResult:
renderResult(result, options, theme, context) {
  const text = theme.fg("success", "Done");
  return new Text(text, 0, 0);
}

// In ctx.ui.custom():
const result = await ctx.ui.custom<boolean>((tui, theme, keybindings, done) => {
  const component = new Text("Press Enter or Escape", 1, 1);
  component.onKey = (key) => {
    if (matchesKey(key, Key.enter)) done(true);
    if (matchesKey(key, Key.escape)) done(false);
    return true;
  };
  return component;
});
```

### Overlays

```typescript
const handle = tui.showOverlay(component, {
  anchor: "center",
  width: "80%",
  margin: 2,
});
handle.hide();
```
