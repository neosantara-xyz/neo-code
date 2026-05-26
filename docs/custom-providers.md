# Custom Providers

Extensions can register custom model providers via `neo.registerProvider()`, and
users can add providers via `~/.neo-code/agent/models.json`.

## Via Extensions

```typescript
import type { ExtensionAPI } from "@neosantara/code";

export default function (neo: ExtensionAPI) {
  neo.registerProvider("my-proxy", {
    name: "My Proxy",
    baseUrl: "https://proxy.example.com/v1",
    apiKey: "MY_PROXY_API_KEY",
    api: "openai-completions",
    models: [
      {
        id: "llama-3.1-70b",
        name: "Llama 3.1 70B",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
      },
    ],
  });
}
```

### ProviderConfig Options

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | Display name in UI |
| `baseUrl` | string | API endpoint URL |
| `apiKey` | string | Env var name, literal value, or `!command` |
| `api` | string | `"openai-responses"` or `"openai-completions"` |
| `headers` | object | Custom request headers |
| `authHeader` | boolean | Add `Authorization: Bearer` automatically |
| `models` | array | Model definitions (replaces all existing for this provider) |
| `streamSimple` | function | Custom streaming implementation |
| `oauth` | object | OAuth config for `/login` support |

### Model Definition

| Field | Required | Description |
| --- | --- | --- |
| `id` | yes | Model identifier |
| `name` | yes | Display name |
| `reasoning` | yes | Supports thinking/reasoning |
| `input` | yes | `["text"]` or `["text", "image"]` |
| `cost` | yes | `{ input, output, cacheRead, cacheWrite }` per million tokens |
| `contextWindow` | yes | Max context tokens |
| `maxTokens` | yes | Max output tokens |
| `api` | no | Override provider API |
| `baseUrl` | no | Override provider URL |
| `headers` | no | Override provider headers |
| `thinkingLevelMap` | no | Custom thinking level mapping |
| `compat` | no | OpenAI compatibility settings |

### OAuth Provider

```typescript
neo.registerProvider("corporate-ai", {
  baseUrl: "https://ai.corp.com/v1",
  api: "openai-responses",
  models: [...],
  oauth: {
    name: "Corporate AI (SSO)",
    async login(callbacks) {
      callbacks.onAuth({ url: "https://sso.corp.com/..." });
      const code = await callbacks.onPrompt({ message: "Enter code:" });
      return { refresh: code, access: code, expires: Date.now() + 3600000 };
    },
    async refreshToken(credentials) {
      return credentials;
    },
    getApiKey(credentials) {
      return credentials.access;
    },
  },
});
```

### Behavior

- During extension load: registrations are queued, applied after startup
- After startup: takes effect immediately (no `/reload` needed)
- If `models` provided: replaces ALL existing models for that provider
- If only `baseUrl` provided: overrides URL for existing models
- `neo.unregisterProvider(name)` removes provider and restores built-in models

## Via models.json

Add providers and models without writing an extension. File location:
`~/.neo-code/agent/models.json`

Supports `//` comments and trailing commas.

```json
{
  "providers": {
    "ollama": {
      "name": "Ollama",
      "baseUrl": "http://localhost:11434/v1",
      "apiKey": "OLLAMA_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "llama3.1:70b",
          "name": "Llama 3.1 70B",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 4096
        }
      ]
    }
  }
}
```

### apiKey Field

The `apiKey` field supports three formats:

- **Env var name**: `"MY_API_KEY"` — reads from environment
- **Literal value**: `"sk-abc123"` — used directly
- **Command**: `"!my-command --get-key"` — executes command, uses stdout

### Model Overrides

Override properties of built-in models without redefining them:

```json
{
  "providers": {
    "neosantara": {
      "modelOverrides": {
        "deepseek-v4-0324": {
          "contextWindow": 200000,
          "maxTokens": 32000
        }
      }
    }
  }
}
```

### Validation Rules

- Non-built-in providers with models require `baseUrl` and `apiKey`
- Built-in providers can add models without baseUrl/apiKey (inherited)
- Override-only configs need at least one of: `baseUrl`, `headers`, `compat`, `modelOverrides`
- Each model needs `api` at provider or model level (unless built-in provider)
