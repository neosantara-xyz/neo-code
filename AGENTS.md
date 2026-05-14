# Development Rules

This repository is intentionally scoped to a Neosantara-first, OpenAI-SDK-only build.

## Conversational Style

- Keep answers short and concise.
- No emojis in commits, issues, PR comments, or code.
- No fluff or cheerful filler text.
- Technical prose only, be kind but direct.

## Neosantara Scope

- Do not add vendor SDK providers.
- Keep built-in runtime transport to `openai-responses` and `openai-completions`.
- Keep built-in provider identity as `neosantara`.
- Prefer `NAI_API_KEY` or `NEOSANTARA_API_KEY` for credentials.
- Use `https://api.neosantara.xyz/v1` as the default API base URL.
- Model prices shown by the CLI should follow Neosantara billing and be represented in IDR.

## Code Quality

- Read files in full before making wide-ranging changes, before editing files you have not already fully inspected, and when the user asks you to investigate or audit something. Do not rely only on search snippets for broad changes.
- No `any` types unless absolutely necessary.
- Check `node_modules` for external API type definitions instead of guessing.
- NEVER use inline imports: no `await import("./foo.js")`, no `import("pkg").Type` in type positions, no dynamic imports for types. Always use standard top-level imports.
- NEVER remove or downgrade code to fix type errors from outdated dependencies; upgrade the dependency instead.
- Always ask before removing functionality or code that appears to be intentional.
- Do not preserve backward compatibility unless the user explicitly asks for it.
- Never hardcode key checks with examples like `matchesKey(keyData, "ctrl+x")`. All keybindings must be configurable. Add defaults to the matching object, such as `DEFAULT_EDITOR_KEYBINDINGS` or `DEFAULT_APP_KEYBINDINGS`.
- NEVER modify `packages/ai/src/models.generated.ts` directly. Update `packages/ai/scripts/generate-models.ts` instead, then regenerate the file.

## Commands

- After code changes, run `npm run check` and read the full output. Fix all errors, warnings, and infos before committing.
- Documentation-only changes do not require `npm run check`.
- Note: `npm run check` does not run tests.
- NEVER run `npm run dev`.
- NEVER run full `npm run build` or `npm test` unless the user explicitly instructs it.
- For Termux installer artifacts, run `npm run build:termux-bundle` only when the user asks to build or refresh install assets.
- Only run specific tests when they are relevant or the user instructs it. Prefer package-root commands such as `npx tsx ../../node_modules/vitest/dist/cli.js --run test/specific.test.ts`.
- Run tests from the package root, not the repo root, unless the user explicitly asks for workspace-wide verification.
- If you create or modify a test file, you MUST run that test file and iterate until it passes.
- When writing tests, run them, identify issues in either the test or implementation, and iterate until fixed.
- For `packages/coding-agent/test/suite/`, use `test/suite/harness.ts` plus the faux provider. Do not use real provider APIs, real API keys, or paid tokens.
- Put issue-specific regressions under `packages/coding-agent/test/suite/regressions/` and name them `<issue-number>-<short-slug>.test.ts`.
- NEVER commit unless the user asks.

## Adding Models

- Add Neosantara model IDs through `packages/ai/scripts/generate-models.ts`.
- The generator should fetch `https://api.neosantara.xyz/v1/models`.
- Only include non-deprecated text models that advertise `function_calling`, because the coding agent depends on tool invocation.
- Keep the generated runtime transport OpenAI-compatible.
- It is fine to include `packages/ai/src/models.generated.ts` in a commit alongside the generator changes.

## Contribution Gate

- New issues from new contributors are auto-closed by `.github/workflows/issue-gate.yml`.
- New PRs from new contributors without PR rights are auto-closed by `.github/workflows/pr-gate.yml`.
- Maintainer approval comments are handled by `.github/workflows/approve-contributor.yml`.
- Maintainers review auto-closed issues daily.
- Issues that do not meet the quality bar in `CONTRIBUTING.md` are not reopened and do not receive a reply.
- `lgtmi` approves future issues.
- `lgtm` approves future issues and rights to submit PRs.

When creating issues:

- Add `pkg:*` labels to indicate which package or packages the issue affects.
- Available labels: `pkg:agent`, `pkg:ai`, `pkg:coding-agent`, `pkg:tui`, `pkg:web-ui`.
- If an issue spans multiple packages, add all relevant labels.

When posting issue or PR comments:

- Write the full comment to a temp file and use `gh issue comment --body-file` or `gh pr comment --body-file`.
- Never pass multi-line markdown directly via `--body` in shell commands.
- Preview the exact comment text before posting.
- Post exactly one final comment unless the user explicitly asks for multiple comments.
- If a comment is malformed, delete it immediately, then post one corrected comment.
- Keep comments concise, technical, and in the user's tone.

When closing issues via commit:

- Include `fixes #<number>` or `closes #<number>` in the commit message.
- This automatically closes the issue when the commit is merged.

## PR Workflow

- Analyze PRs without pulling locally first.
- If the user approves: create a feature branch, pull PR, rebase on `main`, apply adjustments, commit, merge into `main`, push, close PR, and leave a comment in the user's tone.
- You never open PRs yourself. Work in feature branches until everything matches the user's requirements, then merge into `main` and push.

## Testing Interactive Mode with tmux

To test `nai` TUI in a controlled terminal environment:

```bash
tmux new-session -d -s nai-test -x 80 -y 24
tmux send-keys -t nai-test "cd /root/nusantaraai/nai-code && ./packages/coding-agent/dist/cli.js" Enter
sleep 3 && tmux capture-pane -t nai-test -p
tmux send-keys -t nai-test "your prompt here" Enter
tmux send-keys -t nai-test Escape
tmux send-keys -t nai-test C-o
tmux kill-session -t nai-test
```

## Changelog

Location: `packages/*/CHANGELOG.md` for package-specific changes.

### Format

Use these sections under `## [Unreleased]`:

- `### Breaking Changes` for API changes requiring migration.
- `### Added` for new features.
- `### Changed` for changes to existing functionality.
- `### Fixed` for bug fixes.
- `### Removed` for removed features.

### Rules

- Before adding entries, read the full `[Unreleased]` section to see which subsections already exist.
- New entries ALWAYS go under `## [Unreleased]`.
- Append to existing subsections, do not create duplicates.
- NEVER modify already-released version sections.
- Each version section is immutable once released.

### Attribution

- Internal changes from issues: `Fixed foo bar ([#123](https://github.com/neosantara/nai-code/issues/123))`.
- External contributions: `Added feature X ([#456](https://github.com/neosantara/nai-code/pull/456) by [@username](https://github.com/username))`.

## Adding a New LLM Provider

Do not add new built-in vendor providers in this Neosantara edition. If the user explicitly requests a new provider, confirm the scope first because this conflicts with the Neosantara-first OpenAI-SDK-only constraint.

Allowed provider-related work:

- Update Neosantara model metadata in `packages/ai/scripts/generate-models.ts`.
- Update OpenAI-compatible transports in `packages/ai/src/providers/openai-responses.ts` or `packages/ai/src/providers/openai-completions.ts`.
- Update Neosantara credential detection in `packages/ai/src/env-api-keys.ts`.
- Update coding-agent defaults and UI labels for the built-in `neosantara` provider.

## Releasing

Lockstep versioning: all packages always share the same version number.

Version semantics:

- `patch`: bug fixes and new features.
- `minor`: API breaking changes.

Release steps:

1. Update changelogs under `packages/*/CHANGELOG.md`.
2. Run `npm run release:patch` or `npm run release:minor`.

The release script handles version bump, changelog finalization, commit, tag, publish, and adding new `[Unreleased]` sections.

## CRITICAL Git Rules for Parallel Agents

Multiple agents may work on different files in the same worktree simultaneously. Follow these rules.

### Committing

- ONLY commit files YOU changed in THIS session.
- ALWAYS include `fixes #<number>` or `closes #<number>` in the commit message when there is a related issue or PR.
- NEVER use `git add -A` or `git add .`; these sweep up changes from other agents.
- ALWAYS use `git add <specific-file-paths>` listing only files you modified.
- Before committing, run `git status` and verify you are only staging YOUR files.
- Track which files you created, modified, or deleted during the session.
- It is always fine to include `packages/ai/src/models.generated.ts` in a commit alongside the generator changes.

### Forbidden Git Operations

These commands can destroy other agents' work:

- `git reset --hard`
- `git checkout .`
- `git clean -fd`
- `git stash`
- `git add -A`
- `git add .`
- `git commit --no-verify`

### Safe Workflow

```bash
git status
git add packages/ai/scripts/generate-models.ts
git add packages/ai/src/models.generated.ts
git commit -m "fix(ai): description"
git pull --rebase
git push
```

### If Rebase Conflicts Occur

- Resolve conflicts in YOUR files only.
- If conflict is in a file you did not modify, abort and ask the user.
- NEVER force push.

### User Override

If the user instructions conflict with rules in this file, ask for confirmation that they want to override the rules. Only then execute their instructions.
