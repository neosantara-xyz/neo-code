# Changelog

## [Unreleased]

### Changed

- Keep this package changelog in sync with `releases/NOTES.md` before each release.

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
- Added `@neosantara/code/hooks` export shim.

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
