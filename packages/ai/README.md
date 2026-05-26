# @neosantara/ai

Unified LLM transport for the Neosantara platform. OpenAI SDK-only, single
provider, with automatic model discovery, token/cost tracking in IDR, and
streaming support.

**Note**: Only models that support tool calling (function calling) are included,
as this is essential for the Neo Code agent workflow.

## Provider

- **Neosantara** — All models routed through `https://api.neosantara.xyz/v1`

Supported APIs:
- `openai-responses` — OpenAI Responses API format
- `openai-completions` — OpenAI Chat Completions API format

## Installation

```bash
# Part of the neo-code monorepo
npm install @neosantara/ai
```

TypeBox exports are re-exported: `Type`, `Static`, and `TSchema`.

## Quick Start

```typescript
import { getModel, streamSimple, completeSimple, Type } from "@neosantara/ai";

// Get a model (auto-complete supported)
const model = getModel("neosantara", "grok-4.1-fast-non-reasoning");

// Stream a response
const stream = streamSimple(model, {
  systemPrompt: "You are a helpful assistant.",
  messages: [{ role: "user", content: "What is TypeScript?" }],
});

for await (const event of stream) {
  if (event.type === "text_delta") {
    process.stdout.write(event.delta);
  }
}

const message = await stream.result();
console.log(`Tokens: ${message.usage.input} in, ${message.usage.output} out`);
console.log(`Cost: Rp ${message.usage.cost.total}`);
```

## Tools

Define tools with TypeBox schemas for type safety and validation:

```typescript
import { Type, Tool } from "@neosantara/ai";

const tools: Tool[] = [{
  name: "read_file",
  description: "Read a file from disk",
  parameters: Type.Object({
    path: Type.String({ description: "File path to read" }),
    startLine: Type.Optional(Type.Number()),
    endLine: Type.Optional(Type.Number()),
  }),
}];

const response = await completeSimple(model, {
  messages: [{ role: "user", content: "Read package.json" }],
  tools,
});

// Handle tool calls
for (const block of response.content) {
  if (block.type === "toolCall") {
    console.log(`Tool: ${block.name}(${JSON.stringify(block.arguments)})`);
  }
}
```

### Validating Tool Arguments

```typescript
import { validateToolArguments } from "@neosantara/ai";

// Returns validated args or throws with descriptive error
const args = validateToolArguments(tool.parameters, rawArgs);
```

## Streaming Events

| Event | Description |
| --- | --- |
| `start` | Stream begins |
| `text_start` | Text block starts |
| `text_delta` | Text chunk received |
| `text_end` | Text block complete |
| `thinking_start` | Thinking block starts |
| `thinking_delta` | Thinking chunk received |
| `thinking_end` | Thinking block complete |
| `toolcall_start` | Tool call begins |
| `toolcall_delta` | Tool arguments streaming (partial JSON) |
| `toolcall_end` | Tool call complete |
| `done` | Stream complete |
| `error` | Error occurred |

## Thinking/Reasoning

```typescript
const response = await completeSimple(model, context, {
  reasoning: "medium", // "minimal" | "low" | "medium" | "high" | "xhigh"
});

for (const block of response.content) {
  if (block.type === "thinking") {
    console.log("Thinking:", block.thinking);
  } else if (block.type === "text") {
    console.log("Response:", block.text);
  }
}
```

## Image Input

Models with vision support can process images via the `input` field:

```typescript
import { readFileSync } from "fs";

const model = getModel("neosantara", "grok-4.1-fast-non-reasoning");

if (model.input.includes("image")) {
  const response = await completeSimple(model, {
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "What is in this image?" },
        { type: "image", data: readFileSync("img.png").toString("base64"), mimeType: "image/png" },
      ],
    }],
  });
}
```

## Models

Models are auto-generated from `https://api.neosantara.xyz/v1/models`.

```typescript
import { getProviders, getModels, getModel } from "@neosantara/ai";

const providers = getProviders(); // ["neosantara"]
const models = getModels("neosantara");

for (const m of models) {
  console.log(`${m.id}: context=${m.contextWindow}, reasoning=${m.reasoning}`);
}
```

### Model Properties

| Field | Description |
| --- | --- |
| `id` | Model identifier |
| `name` | Display name |
| `api` | API format (openai-responses or openai-completions) |
| `provider` | Always "neosantara" |
| `baseUrl` | API endpoint |
| `reasoning` | Supports thinking/reasoning |
| `input` | Supported input types (["text"] or ["text", "image"]) |
| `cost` | Per-million-token costs in IDR |
| `contextWindow` | Max context tokens |
| `maxTokens` | Max output tokens |

## Stop Reasons

| Reason | Description |
| --- | --- |
| `stop` | Normal completion |
| `length` | Hit max token limit |
| `toolUse` | Model wants to call tools |
| `error` | Error during generation |
| `aborted` | Cancelled via AbortSignal |

## Error Handling & Abort

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

const stream = streamSimple(model, context, { signal: controller.signal });

for await (const event of stream) {
  if (event.type === "error") {
    console.error(`${event.reason}: ${event.error.errorMessage}`);
  }
}
```

## Authentication

```typescript
// Environment variable (preferred)
export NEOSANTARA_API_KEY=nsk_...

// Or pass explicitly
const response = await completeSimple(model, context, {
  apiKey: "nsk_...",
});
```

## Environment Variables

| Variable | Description |
| --- | --- |
| `NEOSANTARA_API_KEY` | API key for authentication |
| `NEOSANTARA_API_BASE_URL` | Override API base URL (default: `https://api.neosantara.xyz/v1`) |

## Faux Provider (Testing)

```typescript
import {
  completeSimple,
  fauxAssistantMessage,
  fauxText,
  fauxToolCall,
  registerFauxProvider,
} from "@neosantara/ai";

const faux = registerFauxProvider();
const model = faux.getModel();

faux.setResponses([
  fauxAssistantMessage([fauxText("Hello!")]),
]);

const response = await completeSimple(model, {
  messages: [{ role: "user", content: "Hi" }],
});

faux.unregister();
```

## Adding Models

Update `scripts/generate-models.ts` then run:

```bash
npm --prefix packages/ai run generate-models
```

The generator fetches from `https://api.neosantara.xyz/v1/models` and includes
only non-deprecated text models with `function_calling` capability.

## License

MIT
