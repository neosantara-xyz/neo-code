# Neo Code Release Notes

## v0.74.2 (2026-05-15)
- mode: patch
- notes: fix(update): prefer self-hosted installer for private Neo Code updates

## v0.74.3 (2026-05-15)
- mode: patch
- notes: feat(skills): add interactive skills install and list commands

## v0.74.4 (2026-05-15)
- mode: patch
- notes: fix(release): use lockstep package version and local npm cache for bumps

## v0.74.5 (2026-05-15)
- mode: patch
- notes: fix(changelog): merge package changelog with release notes for /changelog

## v0.74.6 (2026-05-15)
- mode: patch
- notes: fix(ai): avoid DeepSeek reasoning payloads during tool calls

## v0.74.7 (2026-05-15)
- mode: patch
- notes: feat(skills): support Codex-style metadata and stabilize working loader shimmer

## v0.74.8 (2026-05-15)
- mode: patch
- notes: feat(agents): add Codex-style init command for AGENTS.md

## v0.74.9 (2026-05-15)
- mode: patch
- notes: fix(changelog): ship release notes with package assets

## v0.74.10 (2026-05-15)
- mode: patch
- notes: fix(tui): restore @ file suggestions without fd and remove redundant memory alias

## v0.74.11 (2026-05-15)
- mode: patch
- notes: fix(approval): freeze tool activity shimmer while permission prompts are focused

## v0.74.12 (2026-05-15)
- mode: patch
- notes: feat(mode): add Claude-style Shift+Tab mode cycling and approval copy

## v0.74.13 (2026-05-15)
- mode: patch
- notes: fix(plan-mode): align plan mode inspection permissions and system prompt with Claude-style planning

## v0.74.14 (2026-05-15)
- mode: patch
- notes: feat(plan): add ExitPlanMode approval handoff for plan-mode implementation flow

## v0.74.15 (2026-05-16)
- mode: patch
- notes: feat(plan): add Claude-style ExitPlanMode approval dialog and reliable changelog rendering

## v0.74.16 (2026-05-16)
- mode: patch
- notes: feat(welcome): adapt Claude-style startup welcome with context and changelog

## v0.74.17 (2026-05-16)
- mode: patch
- notes: fix(permissions): expose read-only inspection tools in default and accept-edits modes

## v0.74.18 (2026-05-16)
- mode: patch
- notes: fix(permissions): prefer dedicated read-only tools over bash inspection

## v0.74.19 (2026-05-16)
- mode: patch
- notes: feat(welcome): warn when Neo Code starts in the home directory and align approval cards with Claude-style permission copy

## v0.74.20 (2026-05-16)
- mode: patch
- notes: fix(activity): collapse duplicate read/search/list tool activity and add duplicate-call guardrails

## v0.74.21 (2026-05-16)
- mode: patch
- notes: fix(activity): make tool activity rendering closer to Claude Code collapsed read/search summaries

## v0.74.22 (2026-05-16)
- mode: patch
- notes: fix(activity): collapse tool activity into unified Claude-style groups without tree noise

## v0.74.23 (2026-05-16)
- mode: patch
- notes: fix(activity): shorten workspace and home paths in collapsed tool activity

## v0.74.24 (2026-05-16)
- mode: patch
- notes: feat(activity): refine Claude-style activity grouping, context, and plan handoff UI

## v0.74.25 (2026-05-16)
- mode: patch
- notes: fix(welcome): avoid duplicate changelog startup cards when welcome already shows update summary

## v0.74.26 (2026-05-16)
- mode: patch
- notes: feat(welcome): add Claude-style condensed and wide startup layouts

## v0.74.27 (2026-05-16)
- mode: patch
- notes: feat(welcome): add Neo Kanci mascot to startup and static web

## v0.74.28 (2026-05-16)
- mode: patch
- notes: feat(branding): ship Neo Kanci SVG icon assets

## v0.74.29 (2026-05-16)
- mode: patch
- notes: feat(welcome): render Neo Kanci as ANSI block mascot


## v0.74.30 (2026-05-17)
- mode: patch
- notes: fix(context): clarify current context versus cumulative session usage
## v0.74.31 (2026-05-16)
- mode: patch
- notes: fix(context): make post-compact display show active context instead of cumulative session input

## v0.74.32 (2026-05-16)
- mode: patch
- notes: fix(approval): show write and edit previews inside permission cards

## v0.74.33 (2026-05-17)
- mode: patch
- notes: feat(ui): align Neo loading flow with Claude Code-style progress details

## v0.74.34 (2026-05-17)
- mode: patch
- notes: feat(activity): render Claude-style collapsed tool activity tree for readable loading progress

## v0.74.35 (2026-05-17)
- mode: patch
- notes: feat(activity): show phase tree with current file target

## v0.74.36 (2026-05-17)
- mode: patch
- notes: fix(commands): keep compact as the only compaction slash command

## v0.74.37 (2026-05-17)
- mode: patch
- notes: fix(activity): show live tool tree and clear resolved approvals

## v0.74.38 (2026-05-17)
- mode: patch
- notes: fix(runtime): clarify AGENTS context scope and serialize unsafe tools

## v0.74.39 (2026-05-17)
- mode: patch
- notes: fix(approval): stop agent after plain permission denial

## v0.74.40 (2026-05-17)
- mode: patch
- notes: fix(prompt): align Neo Code system and tool guidance with Claude Code runtime UX

## v0.74.41 (2026-05-17)
- mode: patch
- notes: fix(compaction): align auto compact flow and post-compact context usage

## v0.74.42 (2026-05-17)
- mode: patch
- notes: feat(ui): improve Claude-style activity, bash progress, and compaction context display

## v0.74.43 (2026-05-20)
- mode: patch
- notes: fix(activity): render single tools as readable rows and stack parallel inspection batches

## v0.74.44 (2026-05-20)
- mode: patch
- notes: feat(ui): refine tool results, approval diffs, and raw output expansion

## v0.74.45 (2026-05-20)
- mode: patch
- notes: feat(background): add Claude-style shell background tasks

## v0.74.46 (2026-05-20)
- mode: patch
- notes: feat(ui): align footer context and welcome experience with Claude Code

## v0.74.47 (2026-05-20)
- mode: patch
- notes: feat(termux): add touch keyboard extra keys setup

## v0.75.0 (2026-05-20)
- mode: minor
- notes: feat(parity): add MCP subagent todo memory config and code navigation parity
## v0.76.0 (2026-05-21)
- mode: minor
- notes: feat(agent): add Claude-style subagents and stable shimmer behavior

## v0.76.1 (2026-05-21)
- mode: patch
- notes: fix(subagents): tighten subagent MCP scoping and navigation parity

## v0.76.2 (2026-05-21)
- mode: patch
- notes: fix(commands): hide redundant memory slash alias

## v0.76.3 (2026-05-21)
- mode: patch
- notes: fix(tui): curate slash palette and keep activity trees stacked after completion

## v0.76.4 (2026-05-21)
- mode: patch
- notes: fix(security): harden lifecycle and workspace file paths

## v0.76.5 (2026-05-21)
- mode: patch
- notes: fix(ui): align Claude-style glimmer behavior and filter sourceMappingURL noise

## v0.76.6 (2026-05-21)
- mode: patch
- notes: feat(usage): add Antigravity-style Neosantara usage screen

## v0.76.7 (2026-05-21)
- mode: patch
- notes: fix(activity): reveal stacked tool tree incrementally

## v0.76.8 (2026-05-21)
- mode: patch
- notes: fix(activity-tree): align ctrl-o expand reveal behavior

## v0.76.9 (2026-05-21)
- mode: patch
- notes: fix(compaction): align compact hints and nested-run guard

## v0.76.10 (2026-05-21)
- mode: patch
- notes: feat(theme): add Neosantara brand themes from CSS palette

## v0.76.13 (2026-05-22)
- mode: patch
- notes: fix(approval): ESC on permission prompt now correctly stops the agent loop

## v0.76.14 (2026-05-22)
- mode: patch
- notes: feat(approval): adopt claude-code card style - top-border-only, no side/bottom borders, cleaner hints

## v0.76.15 (2026-05-22)
- mode: patch
- notes: feat(agent): add dedicated tool activity kind for sub-agent dispatch with tree UI

## v0.76.16 (2026-05-22)
- mode: patch
- notes: fix(tui): ctrl+o now expands only active tool group, not entire chat history

## v0.76.17 (2026-05-22)
- mode: patch
- notes: feat(tui): add spinner tips and terminal focus-based away detection

## v0.76.18 (2026-05-22)
- mode: patch
- notes: fix(todo): improve prompt guidelines for proactive usage, match claude-code patterns

## v0.76.19 (2026-05-22)
- mode: patch
- notes: feat(todo): add verification nudge when all 3+ tasks completed without test/verify step

## v0.76.20 (2026-05-22)
- mode: patch
- notes: fix(tui): smoother activity tree - hold label flickers while committing structure changes immediately

## v0.76.21 (2026-05-22)
- mode: patch
- notes: feat(tui): add low-balance warning after agent turns when estimated balance < Rp5000

## v0.76.22 (2026-05-22)
- mode: patch
- notes: fix(tui): correct billing URL to app.neosantara.xyz/billing

## v0.76.23 (2026-05-22)
- mode: patch
- notes: fix(tui): Ctrl+C and ESC now abort during retry loops, show interrupt hint

## v0.76.24 (2026-05-22)
- mode: patch
- notes: feat(usage): add session duration to /usage screen

## v0.76.25 (2026-05-22)
- mode: patch
- notes: fix(interrupt): abort retry loop on Ctrl+C/ESC - was only aborting stream, not retry timer

## v0.76.26 (2026-05-22)
- mode: patch
- notes: fix(model): change default model to grok-4.1-fast-reasoning so thinking blocks are rendered

## v0.76.27 (2026-05-22)
- mode: patch
- notes: fix(ai): remove supportsReasoningWithTools:false for DeepSeek - backend handles reasoning+tools fine

## v0.76.28 (2026-05-22)
- mode: patch
- notes: fix(tui): always show 'Press Ctrl+C again to exit' hint on first Ctrl+C

## v0.76.29 (2026-05-22)
- mode: patch
- notes: feat(agent): add renderCall for sub-agent tool - shows @name with task description

## v0.76.30 (2026-05-22)
- mode: patch
- notes: feat(agent): single-line sub-agent activity display like claude-code

## v0.76.31 (2026-05-22)
- mode: patch
- notes: fix(agent): sub-agent tree UI matches claude-code style with header + tree connector

## v0.76.32 (2026-05-22)
- mode: patch
- notes: feat(agent): sub-agent tree shows tool use count like claude-code

## v0.76.33 (2026-05-22)
- mode: patch
- notes: feat(tui): add shortcut overlay popup on ? key (toggle with ? or ESC)

## v0.76.34 (2026-05-22)
- mode: patch
- notes: fix(tui): smoother shimmer animation - reduce interval from 200ms to 60ms

## v0.76.35 (2026-05-22)
- mode: patch
- notes: feat(tui): ctrl+o expands all tool groups when idle (transcript view), only current when streaming

## v0.76.36 (2026-05-22)
- mode: patch
- notes: fix(tui): ctrl+o hint only shows on active tool group, not completed ones

## v0.76.37 (2026-05-22)
- mode: patch
- notes: fix(tui): slower tool reveal stagger (300ms) for smoother tree build-up like codex

## v0.76.38 (2026-05-22)
- mode: patch
- notes: fix(interrupt): Ctrl+C now resolves pending tool approval before aborting - prevents stuck agent

## v0.76.39 (2026-05-22)
- mode: patch
- notes: fix(compaction): remove redundant _resolveRetry in input rate limit handler - _runAutoCompaction already retries

## v0.76.40 (2026-05-22)
- mode: patch
- notes: fix(footer): shorten mode pill to prevent truncation on narrow terminals (Termux)

## v0.76.41 (2026-05-22)
- mode: patch
- notes: feat(ui): claude-code style spinner glyphs and effort symbols in footer

## v0.76.42 (2026-05-22)
- mode: patch
- notes: feat(activity): use flat stacked format during gradual reveal for smoother tree build-up

## v0.76.43 (2026-05-22)
- mode: patch
- notes: fix(activity): tree builds up progressively per reveal (500ms stagger), no flat-to-tree jump

## v0.76.44 (2026-05-22)
- mode: patch
- notes: fix(activity): smoother tree growth - hide file targets during running, remove redundant Current line

## v0.76.45 (2026-05-22)
- mode: patch
- notes: fix(activity): summary as tree parent with targets indented below, cleaner hierarchy

## v0.76.46 (2026-05-22)
- mode: patch
- notes: fix(tui): show ctrl+o expand hint on completed tool groups too

## v0.76.47 (2026-05-22)
- mode: patch
- notes: fix(tui): ctrl+o only expands last tool group when idle, not entire history

## v0.76.48 (2026-05-22)
- mode: patch
- notes: feat(coding-agent): port Claude Code spinner-tip line below the working loader, gated by Neosantara-only catalog with per-tip session cooldowns and override settings

## v0.76.49 (2026-05-22)
- mode: patch
- notes: feat(coding-agent): port Codex-style /statusline picker, Nusantara subagent nicknames, and /rename alias

## v0.76.50 (2026-05-22)
- mode: patch
- notes: feat(coding-agent): add Codex/Claude-style /review with multi-target picker, prompt templates, and reviewer subagent

## v0.76.51 (2026-05-22)
- mode: patch
- notes: feat(coding-agent): add /fork slash, high-context tip override, and Codex-style fork-to-fresh-context plan handoff

## v0.76.52 (2026-05-24)
- mode: patch
- notes: fix(coding-agent): correct local opener and Termux notification settings behavior

## v0.76.53 (2026-05-24)
- mode: patch
- notes: fix(coding-agent): honor project settings for spinner tip selection

## v0.76.54 (2026-05-24)
- mode: patch
- notes: fix(activity): smooth loader glimmer and live tool activity buildup

## v0.76.55 (2026-05-24)
- mode: patch
- notes: fix(loader): keep spinner tips scoped and stabilize loading labels

## v0.76.56 (2026-05-24)
- mode: patch
- notes: fix(activity): align tool transcript hints with Codex flow

## v0.76.57 (2026-05-24)
- mode: patch
- notes: fix(coding-agent): deduplicate file counts in tool activity tree

## v0.76.58 (2026-05-24)
- mode: patch
- notes: feat(coding-agent): specify parallel and sequential tools in system prompt

## v0.76.59 (2026-05-24)
- mode: patch
- notes: feat(coding-agent): append Termux environment and capabilities to system prompt

## v0.76.60 (2026-05-24)
- mode: patch
- notes: feat(tui): add rate limit card with interactive billing and compact actions

## v0.76.61 (2026-05-24)
- mode: patch
- notes: feat(doctor): scrollable overlay with aggregate error/warning summary across all sections

## v0.76.62 (2026-05-24)
- mode: patch
- notes: feat(lsp): real Language Server Protocol integration with /lsp command, lazy-spawn manager, and graceful fallback when no server is installed

## v0.76.63 (2026-05-26)
- mode: patch
- notes: fix(tui): keep tabbed transcript overlays within terminal width

## v0.76.64 (2026-05-26)
- mode: patch
- notes: fix(coding-agent): hide raw reasoning by default and keep inspection file trees visible

## v0.76.65 (2026-05-26)
- mode: patch
- notes: fix(memory): replace require() with top-level ESM import to fix ReferenceError in /memory commands

## v0.76.66 (2026-05-26)
- mode: patch
- notes: feat(skills): add token budget, priority ordering, policy support, and progressive disclosure instructions

## v0.76.67 (2026-05-26)
- mode: patch
- notes: fix(tui): improve tool activity tree shimmer — wider band, faster sweep, better running/done contrast

## v0.76.69 (2026-05-26)
- mode: patch
- notes: fix(tui): keep tool activity group in running state until agent turn ends, not just until tools finish

## v0.76.70 (2026-05-26)
- mode: patch
- notes: fix(tui): show thinking status in loading indicator instead of conversation area during streaming

## v0.76.71 (2026-05-26)
- mode: patch
- notes: fix(tui): show directory targets in tree detail rows and fix read paths resolving to dot

## v0.76.72 (2026-05-26)
- mode: patch
- notes: fix(tui): keep shimmer animation running while model is still streaming after tools complete

## v0.76.74 (2026-05-26)
- mode: patch
- notes: fix(tui): match Claude Code thinking UI — show thinking in spinner during streaming, collapsed label after completion

## v0.76.75 (2026-05-26)
- mode: patch
- notes: fix(tui): fully suppress thinking from conversation when hidden — only show in loading indicator

## v0.76.76 (2026-05-26)
- mode: patch
- notes: feat(web): pricing page, 8bitcn skeleton/table, docs expansion (12 pages), deploy workflow, repo transfer to neosantara-xyz

## v0.76.77 (2026-05-27)
- mode: patch
- notes: feat(web): add rendered table of contents to documentation pages

## v0.76.78 (2026-05-27)
- mode: patch
- notes: feat(web): refine documentation navigation and table of contents

## v0.76.79 (2026-05-27)
- mode: patch
- notes: feat(web): refine landing page copy and structure

## v0.76.80 (2026-05-27)
- mode: patch
- notes: feat(web): render landing releases from release notes
