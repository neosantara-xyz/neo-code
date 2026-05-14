# @neosantara/ai

OpenAI-compatible AI transport package for the Neosantara-first build.

This package intentionally ships only the `openai` SDK and the built-in Neosantara provider. It supports:

- `openai-responses`
- `openai-completions`

Default endpoint:

```txt
https://api.neosantara.xyz/v1
```

Credential environment variables:

```sh
export NEOSANTARA_API_KEY=nsk_...
# or
export NEOSANTARA_API_KEY=nsk_...
```

Default built-in model:

```txt
grok-4.1-fast-non-reasoning
```

Additional Neosantara model IDs can be added to `src/models.generated.ts` without adding vendor SDKs.
