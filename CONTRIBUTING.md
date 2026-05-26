# Contributing to Neo Code

## Getting Started

```bash
git clone https://github.com/neosantara-xyz/neo-code.git
cd neo-code
npm install --ignore-scripts
npm run build
npm run check
```

Link the CLI for local testing:

```bash
npm link --workspace @neosantara/code
neo login
```

## Development Workflow

1. Create a feature branch from `main`
2. Make changes
3. Run `npm run check` — this runs Biome (lint) + tsgo (typecheck)
4. Run relevant tests from the package root:
   ```bash
   cd packages/coding-agent
   npx vitest --run test/your-test.ts
   ```
5. Open a pull request

## Code Standards

- TypeScript strict mode, no `any` types unless absolutely necessary
- Top-level ESM imports only — no inline `require()` or dynamic `import()`
- Use existing patterns and libraries; don't introduce new ones without discussion
- All keybindings must be configurable (no hardcoded key checks)
- Never modify `packages/ai/src/models.generated.ts` directly — update the generator script instead

## Commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Build all packages in dependency order |
| `npm run check` | Biome lint + tsgo typecheck (no tests) |
| `npm test` | Run tests across all packages (vitest) |
| `npm run bump -- patch --notes "..."` | Bump version (maintainers only) |

## Commit Messages

Format: `<type>(<scope>): <description>`

Types: `fix`, `feat`, `chore`, `docs`, `refactor`, `test`

Scopes: `coding-agent`, `ai`, `tui`, `web`, `agent`

Examples:
```
fix(coding-agent): restore resume tree visibility
feat(web): add pricing page with tier cards
docs: add sessions and subagents documentation
```

## Pull Requests

- Keep PRs focused on a single change
- Include a summary of what changed and why
- Add `pkg:*` labels to indicate affected packages (`pkg:agent`, `pkg:ai`, `pkg:coding-agent`, `pkg:tui`, `pkg:web-ui`)
- PRs from new contributors require maintainer approval before merge

## Issues

Issues must include:
- Clear description of the problem or feature request
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Neo Code version (`neo --version`)
- OS and terminal (if TUI-related)

Add `pkg:*` labels to indicate which package the issue affects.

## Project Structure

```
packages/
  coding-agent/    Main CLI agent (neo command)
  ai/              OpenAI-compatible transport for Neosantara
  agent-core/      Agent loop/runtime primitives
  tui/             Terminal UI framework
  web/             Landing page + docs (Next.js static export)
docs/              Documentation markdown (rendered on website)
scripts/           Build, release, and utility scripts
.github/workflows/ CI (check + test), binary builds, Pages deploy
```

## Testing

- Tests use vitest with `--run` (no watch mode in CI)
- Run specific tests from the package root, not the repo root
- Use `test/suite/harness.ts` + faux provider for integration tests
- Never use real API keys or paid tokens in tests
- Regression tests: `packages/coding-agent/test/suite/regressions/<issue>-<slug>.test.ts`

## Versioning

All packages share the same version (lockstep):
- `patch` — bug fixes and new features
- `minor` — breaking API changes

Version bumps are done by maintainers after changes are verified.

## Neosantara Scope

This is a Neosantara-first, OpenAI-SDK-only build:
- Built-in provider is `neosantara` only
- Transport is OpenAI-compatible (`openai-responses` / `openai-completions`)
- Do not add vendor SDK providers without explicit maintainer approval

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
