# Agent Notes — Neosantara Edition

This repository is intentionally scoped to a Neosantara-first, OpenAI-SDK-only build.

## Hard constraints

- Do not add vendor SDK providers.
- Keep built-in runtime transport to `openai-responses` and `openai-completions`.
- Keep built-in provider identity as `neosantara`.
- Prefer `NAI_API_KEY` or `NEOSANTARA_API_KEY` for credentials.
- Use `https://api.neosantara.xyz/v1` as the default base URL.

## Adding models

Add Neosantara model IDs in `packages/ai/src/models.generated.ts`. Use the existing `neosantaraModel()` helper and keep the transport OpenAI-compatible.

## Validation

Run:

```sh
npm run check
npm run build
npm test --workspaces --if-present
npm ls --all
```

The final dependency tree should not contain removed vendor SDK packages.
