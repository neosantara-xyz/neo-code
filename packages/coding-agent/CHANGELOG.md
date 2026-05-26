# Changelog

## [Unreleased]

### Added

- Replaced the rotating spinner-tip slot with a Claude Code-style persistent tip line below the working loader, picked once per agent turn from a Neosantara-only catalog and gated by per-tip session cooldowns.
- Added `spinnerTipsEnabled` and `spinnerTipsOverride` settings so users can disable the tip line or supply custom strings (with optional `excludeDefault`).
- Added `/statusline` slash command and configurable footer items via `settings.statusline.items`. The picker lets users toggle visibility and reorder segments (`Space` to toggle, `[`/`]` to reorder, `Enter` to save). `/statusline reset` restores defaults.
- Added a Nusantara-themed nickname pool for spawned subagents. Nicknames are deterministic per invocation, surfaced in activity rendering and in the subagent's system prompt for stable identity.
- Added `/rename` as an alias for `/name` so users coming from Codex or Claude Code reach the same command.
- Added `/review` slash command with a Codex-style multi-step picker: review uncommitted changes, a base branch (PR-style), a specific commit, a GitHub PR (via `gh`), or custom free-form instructions. Direct shortcuts: `/review uncommitted`, `/review base <branch>`, `/review commit <sha>`, `/review pr <number>`, `/review <free text>`. Findings render with priority tags (P0–P3) and a verdict section.
- Added a built-in `reviewer` subagent definition for context-isolated reviews via the `agent` tool.
- Added `/fork` slash command. Spawns a new persisted session that records the current one as its parent so the session tree picker can navigate back. Falls back to a hint when the current session is in-memory.
- Added a high-context tip override that nudges toward `/compact` when the context window utilization crosses 70% (warning) and escalates to "urgent" wording above 90%. The override is rendered every turn until context drops, independent of the cooldown-based tip catalog.
- Added a "Yes, fork to fresh context" option to the ExitPlanMode approval popup. When selected, Neo waits for the current turn to drain, forks the persisted session, and re-submits the approved plan as the opening user message in the new thread so the implementation runs against a clean context window.
- Added real Language Server Protocol support through the new `/lsp` slash command (`status`, `init`, `logs`, `restart`, `stop`) and a rewritten `lsp` tool. Neo lazily spawns LSP servers detected on `PATH` (typescript-language-server, pyright-langserver, rust-analyzer, gopls, clangd, jdtls, solargraph) and reuses connections per workspace; when no matching server is installed the tool returns a clear install hint instead of fabricating results.
- Added a "Code intelligence" section to `/doctor` summarizing installed and running LSP servers.

### Changed

- Keep this package changelog in sync with `releases/NOTES.md` before each release.
- Smoothed live tool activity shimmer and shortened incremental reveal timing for parallel read-only tool batches.
- Matched Claude-style working loader behavior by picking one random default label per turn and hiding spinner tips after tool/custom activity takes over.
- Aligned read-only tool activity groups with Codex-style `Exploring` / `Explored` transcript hints while keeping `Ctrl+O` as an expand alias.
- Reworked `/doctor` into a scrollable overlay with an aggregate Summary line that counts errors and warnings across every section, not just resource loader diagnostics.
- Simplified `/usage` overlay: removed the ASCII mascot header and the per-model quota rows so the screen reflects PAYG billing only (balance, period spend, current session).
- Updated the default Termux touch-keyboard layout to follow community conventions: arrow keys on the right (inverted-T), modifiers (`TAB`, `CTRL`, `ALT`) on the left of row 2, and 7 keys per row.

### Fixed

- Hid raw assistant thinking blocks by default and kept completed inspection file details visible on standard 77-column terminals.

## [0.76.6] - 2026-05-21

### Added

- Added an Antigravity-style `/usage` overlay with Neosantara PAYG billing, session spend, model access rows, quota bars, and keyboard scrolling.

## [0.76.5] - 2026-05-21

### Fixed

- Filtered inline `sourceMappingURL` data lines from read/search tool output before truncation.
- Aligned activity-tree shimmer traversal with Claude-style visual-width glimmer behavior.

## [0.76.4] - 2026-05-21

### Fixed

- Installed global fatal error handlers for uncaught exceptions and unhandled promise rejections.
- Replaced clipboard/config `execSync` usage with safer process spawning.
- Added workspace path guards for local read, write, edit, list, grep, and find operations, including symlink escape checks.
- Routed CLI exits through cleanup-aware lifecycle helpers.

## [0.76.3] - 2026-05-21

### Fixed

- Curated the default slash command palette while keeping advanced handlers available.
- Kept completed multi-tool activity groups rendered as stacked trees instead of flattening after loading.

## [0.76.0] - 2026-05-21

### Added

- Added Claude-style named subagents with built-in and markdown custom agent definitions.
- Added `subagent_type` and optional model override support to the `agent` tool.

### Fixed

- Passed configured MCP servers into built-in MCP tool creation during agent sessions.

## [0.75.0] - 2026-05-20

### Added

- Added MCP server access through `settings.mcpServers`.
- Added a read-only `agent` subagent tool for focused codebase inspection.
- Added a `todo` planning tool backed by `.neo-code/todos.json`.
- Added `/config`, `/memory`, `/mcp`, and `/todo` slash commands.
- Added LSP-aware static code navigation for definitions, references, and workspace symbols.
- Added `@neosantara-xyz/code/hooks` export shim.

## [0.74.47] - 2026-05-20

### Added

- Added `/termux-keys show`, `/termux-keys apply`, and `/termux-keys restore` for Android/Termux touch-keyboard setup.
- Added backup and restore handling for `~/.termux/termux.properties`.

## [0.74.45] - 2026-05-20

### Added

- Added Claude-style shell background tasks.

## [0.74.43] - 2026-05-20

### Changed

- Improved tool activity rendering for readable single-tool rows and parallel inspection batches.
