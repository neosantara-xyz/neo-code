# Skills

Skills are installable packages that extend Neo Code with specialized
instructions, workflows, and tools.

## Installing Skills

```
/skills install <source>          Install globally (user scope)
/skills install <source> --local  Install for current project only
```

Sources can be:
- GitHub URLs
- Local directories
- npm-style package references

## Using Skills

Skills are loaded automatically when a task matches their description. They can
also be invoked explicitly:

```
/skill:<name>              Invoke a skill as a slash command
```

The `/skill:name` commands are available when `enableSkillCommands` is true in
settings (default: true).

Skills can also opt out of automatic invocation via frontmatter:

```yaml
---
name: skill-name
description: Use when [conditions]
disable-model-invocation: true
---
```

## Skill Structure

```
skill-name/
  SKILL.md              Required — frontmatter + instructions
  agents/
    openai.yaml         Optional — UI metadata (display name, icon, prompt)
  scripts/              Optional — executable tools
  references/           Optional — documentation loaded on demand
  assets/               Optional — templates, images
```

## SKILL.md Format

```yaml
---
name: skill-name
description: Use when [triggering conditions]
---

# Skill Name

Instructions for the agent...
```

## Policy

In `agents/openai.yaml`:

```yaml
policy:
  allow_implicit_invocation: false  # Only invoke explicitly
```

## Listing Skills

```
/skills list    Show all loaded skills with source and path
```

## Token Budget

Skill metadata in the system prompt is limited to 2% of the context window.
Skills are prioritized: project > user > path. Excess skills are omitted with
a notice.
