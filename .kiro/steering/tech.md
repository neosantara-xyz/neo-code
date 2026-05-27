---
inclusion: always
---

# Technology Stack

Repository shape:

- npm workspaces under `packages/*`.
- TypeScript-first codebase.
- Next.js App Router in `packages/web`.
- Biome and `tsgo` are the required repo-wide check gate.
- Vitest is used inside package roots for targeted tests.

Commands:

- After non-documentation code changes, run `npm run check` from the repo root and read the full output.
- `npm run check` does not run tests.
- Do not run `npm run dev`.
- Do not run full `npm run build` or `npm test` unless explicitly requested.
- If a test file is created or modified, run that specific test file from its package root.
- After verified non-doc fixes/features, run `npm run bump -- <patch|minor> --notes "<semantic note>"` unless explicitly told not to bump.

Dependency/type rules:

- Check `node_modules` for external API type definitions before guessing.
- Do not use `any` unless absolutely necessary.
- Do not use inline or dynamic imports for types or runtime code.
- Do not remove or downgrade intentional functionality to fix outdated dependency types; upgrade the dependency instead.

Relevant files:

#[[file:package.json]]
#[[file:packages/web/package.json]]
#[[file:.kiro/settings/lsp.json]]

