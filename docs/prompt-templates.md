# Prompt Templates

Prompt templates are Markdown snippets that expand into full prompts. Type
`/name` in the editor to invoke a template, where `name` is the filename
without `.md`.

## Locations

Neo Code loads prompt templates from:

- Global: `~/.neo-code/agent/prompts/*.md`
- Project: `.neo-code/prompts/*.md`
- Packages: `prompts/` directories or `neosantara.prompts` entries in `package.json`
- Settings: `prompts` array with files or directories
- CLI: `--prompt-template <path>` (repeatable)

Disable discovery with `--no-prompt-templates`.

## Format

```markdown
---
description: Review staged git changes
---
Review the staged changes (`git diff --cached`). Focus on:
- Bugs and logic errors
- Security issues
- Error handling gaps
```

- The filename becomes the command name. `review.md` → `/review`.
- `description` is optional. If missing, the first non-empty line is used.
- `argument-hint` is optional. Displayed before description in autocomplete.

### Argument Hints

Use `argument-hint` in frontmatter to show expected arguments:

```markdown
---
description: Review PRs from URLs with structured analysis
argument-hint: "<PR-URL>"
---
```

Renders in autocomplete as:

```
→ pr   <PR-URL>       — Review PRs from URLs with structured analysis
  wr   [instructions] — Finish the current task end-to-end
```

Use `<angle brackets>` for required, `[square brackets]` for optional.

## Usage

Type `/` followed by the template name. Autocomplete shows available templates.

```
/review                           # Expands review.md
/component Button                 # Expands with argument
/component Button "click handler" # Multiple arguments
```

## Arguments

Templates support positional arguments and slicing:

| Syntax | Description |
| --- | --- |
| `$1`, `$2`, ... | Positional arguments |
| `$@` or `$ARGUMENTS` | All args joined |
| `${@:N}` | Args from Nth position (1-indexed) |
| `${@:N:L}` | L args starting at N |

Example:

```markdown
---
description: Create a component
---
Create a React component named $1 with features: $@
```

Usage: `/component Button "onClick handler" "disabled support"`

## Loading Rules

- Template discovery in `prompts/` is non-recursive.
- For templates in subdirectories, add them explicitly via `prompts` settings or a package manifest.
