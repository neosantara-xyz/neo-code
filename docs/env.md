# Environment variables

All environment variables read by Neo Code at runtime. Server-side only —
nothing here should be exposed to a browser. A starter `.env.example` lives at
the repo root.

## Credentials

| Variable | Used by | Default |
| --- | --- | --- |
| `NEOSANTARA_API_KEY` | `@neosantara/ai` transports, coding-agent fallback resolver | required |
| `NEOSANTARA_API_BASE_URL` | `neo login` device flow, API base URL | `https://api.neosantara.xyz` |
| `NEO_CODE_NEOSANTARA_API_BASE_URL` | Fallback for `NEOSANTARA_API_BASE_URL` inside the CLI | falls back to `NEOSANTARA_API_BASE_URL` |

## Coding-agent runtime

| Variable | Effect |
| --- | --- |
| `NEO_CODE_CODING_AGENT_DIR` | Override the agent config dir (default: `~/.neo-code/agent`). |
| `NEO_CODE_CODING_AGENT_SESSION_DIR` | Override session storage dir; superseded by `--session-dir`. |
| `NEO_CODE_PACKAGE_DIR` | Override the package dir; useful for Nix/Guix store paths. |
| `NEO_CODE_SHARE_VIEWER_URL` | Base URL for `/share` (default: `https://app.neosantara.xyz/session/`). |
| `NEO_CODE_OFFLINE` | Disable startup network ops (`1`/`true`/`yes`). Same as `--offline`. |
| `NEO_CODE_SKIP_VERSION_CHECK` | Skip the version-check probe on startup. |
| `NEO_CODE_TELEMETRY` | Force-enable (`1`/`true`/`yes`) or disable (`0`/`false`/`no`) install telemetry. |
| `NEO_CODE_CACHE_RETENTION` | Set to `long` to opt-in to 24h prompt cache retention where supported. |
| `NEO_CODE_STARTUP_BENCHMARK` | Force a startup benchmark output (interactive mode only). |
| `NEO_CODE_TIMING` | Enable timing instrumentation (`1`). |
| `NEO_CODE_INSTALLER_URL` | Override installer URL for self-update. |

## TUI debug

| Variable | Effect |
| --- | --- |
| `NEO_CODE_HARDWARE_CURSOR` | Show hardware cursor position. |
| `NEO_CODE_CLEAR_ON_SHRINK` | Re-render to clear empty rows when content shrinks. |
| `NEO_CODE_DEBUG_REDRAW` | Log redraw reasons to stderr. |
| `NEO_CODE_TUI_DEBUG` | Dump TUI buffers to `/tmp/tui` for inspection. |

## Where flags are read

The `@neosantara/ai` package exposes accessors in
`packages/ai/src/env-flags.ts`. Coding-agent reads the rest from
`packages/coding-agent/src/config.ts` and `packages/coding-agent/src/main.ts`.
When you start reading a new flag, add it to one of those files (or to
`env-flags.ts` if it belongs in the AI layer) instead of sprinkling
`process.env.NEO_CODE_*` reads across the codebase.
