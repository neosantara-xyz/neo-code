# @neosantara/agent-core

Core agent runtime primitives used by the Neosantara coding-agent build.

This package is provider-agnostic at the runtime layer, but the monorepo ships only the Neosantara built-in provider through the OpenAI-compatible AI package.

Typical model selection happens in `@neosantara/code` or `@neosantara/ai`:

```ts
import { getModel } from "@neosantara/ai";

const model = getModel("neosantara", "grok-4.1-fast-non-reasoning");
```
