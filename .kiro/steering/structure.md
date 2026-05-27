---
inclusion: always
---

# Project Structure

Package layout:

- `packages/ai/src/providers/*`: OpenAI-compatible Neosantara transports and provider registration.
- `packages/ai/scripts/generate-models.ts`: source for model metadata generation.
- `packages/ai/src/models.generated.ts`: generated file; do not edit directly.
- `packages/coding-agent/src/core/*`: session runtime, tools, settings, auth, telemetry, memories, model registry.
- `packages/coding-agent/src/modes/interactive/*`: TUI mode and React-like terminal components.
- `packages/tui/src/*`: low-level terminal renderer, editor, input, layout, width handling.
- `packages/agent/src/*`: agent loop, harness, compaction, session storage.
- `packages/web/src/app/*`: Next.js App Router pages for landing, docs, pricing.
- `docs/*.md`: markdown source for the web documentation pages.
- `releases/NOTES.md`: generated/read release notes used by the web landing page.

Editing rules:

- Follow existing package boundaries.
- Keep Neosantara public metadata separate from internal transport/routing details.
- Add Neosantara model IDs in `packages/ai/scripts/generate-models.ts`, then regenerate.
- For web docs, source content comes from root `docs/*.md`; rendering lives in `packages/web/src/app/docs/*`.
- For changelogs, add entries only under `## [Unreleased]`; never edit released sections.

Relevant files:

#[[file:docs/getting-started.md]]
#[[file:packages/web/src/app/docs/data.ts]]
#[[file:packages/ai/scripts/generate-models.ts]]

