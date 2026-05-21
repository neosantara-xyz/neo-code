# Models

The built-in provider is `neosantara`.

Default model:

```txt
grok-4.1-fast-non-reasoning
```

Add or adjust Neosantara model IDs in `packages/ai/scripts/generate-models.ts`, then regenerate `packages/ai/src/models.generated.ts`.

## Termux note

Model selection is unchanged on Termux. After installing Neo Code to `$PREFIX/bin`, use the same model commands:

```bash
neo --list-models neosantara
neo --provider neosantara --model grok-4.1-fast-non-reasoning
```

For Android touch-keyboard shortcuts, run `/termux-keys show`, `/termux-keys apply`, or `/termux-keys restore` inside the TUI.
