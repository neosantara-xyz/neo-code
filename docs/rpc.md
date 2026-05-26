# RPC Mode

RPC mode enables headless operation via a JSON protocol over stdin/stdout.
Useful for embedding Neo Code in IDEs, custom UIs, or automated workflows.

```bash
neo --mode rpc
```

## Protocol

- **Transport**: JSON Lines (one JSON object per line)
- **Commands** (stdin): JSON objects with `type` field, optional `id` for correlation
- **Responses** (stdout): `{ type: "response", command, success, data?, error? }`
- **Events** (stdout): `AgentSessionEvent` objects streamed as they occur
- **Extension UI** (stdout/stdin): UI requests emitted, client responds

## Commands

### Prompting

```json
{"type":"prompt","message":"Fix the bug","id":"1"}
{"type":"steer","message":"Focus on error handling","id":"2"}
{"type":"follow_up","message":"Then run tests","id":"3"}
{"type":"abort","id":"4"}
```

`prompt` accepts optional `images` (ImageContent[]) and `streamingBehavior`
(`"steer"` or `"followUp"`) for queuing when already streaming.

### Session

```json
{"type":"new_session","id":"5"}
{"type":"get_state","id":"6"}
{"type":"get_messages","id":"7"}
{"type":"get_session_stats","id":"8"}
{"type":"export_html","outputPath":"/tmp/out.html","id":"9"}
{"type":"switch_session","sessionPath":"/path/to/session.jsonl","id":"10"}
{"type":"fork","entryId":"entry-uuid","id":"11"}
{"type":"clone","id":"12"}
{"type":"get_fork_messages","id":"13"}
{"type":"get_last_assistant_text","id":"14"}
{"type":"set_session_name","name":"My Session","id":"15"}
```

### Model

```json
{"type":"set_model","provider":"neosantara","modelId":"deepseek-v4-0324","id":"16"}
{"type":"cycle_model","id":"17"}
{"type":"get_available_models","id":"18"}
```

### Thinking

```json
{"type":"set_thinking_level","level":"high","id":"19"}
{"type":"cycle_thinking_level","id":"20"}
```

### Queue Modes

```json
{"type":"set_steering_mode","mode":"all","id":"21"}
{"type":"set_follow_up_mode","mode":"one-at-a-time","id":"22"}
```

### Compaction

```json
{"type":"compact","customInstructions":"Focus on recent changes","id":"23"}
{"type":"set_auto_compaction","enabled":true,"id":"24"}
```

### Retry

```json
{"type":"set_auto_retry","enabled":true,"id":"25"}
{"type":"abort_retry","id":"26"}
```

### Bash

```json
{"type":"bash","command":"ls -la","id":"27"}
{"type":"abort_bash","id":"28"}
```

### Commands

```json
{"type":"get_commands","id":"29"}
```

## Responses

Every command gets a response with matching `id`:

```json
{"type":"response","command":"prompt","success":true,"id":"1"}
{"type":"response","command":"get_state","success":true,"data":{"model":{},"thinkingLevel":"medium","isStreaming":false,"sessionId":"..."},"id":"6"}
{"type":"response","command":"set_model","success":false,"error":"No API key for provider","id":"16"}
```

### Session State

`get_state` returns:

```typescript
{
  model?: Model;
  thinkingLevel: ThinkingLevel;
  isStreaming: boolean;
  isCompacting: boolean;
  steeringMode: "all" | "one-at-a-time";
  followUpMode: "all" | "one-at-a-time";
  sessionFile?: string;
  sessionId: string;
  sessionName?: string;
  autoCompactionEnabled: boolean;
  messageCount: number;
  pendingMessageCount: number;
}
```

## Events

Between responses, `AgentSessionEvent` objects stream as they occur:

```json
{"type":"agent_start"}
{"type":"message_start","message":{"role":"assistant","content":[]}}
{"type":"message_update","message":{},"assistantMessageEvent":{"type":"text_delta","delta":"Hello"}}
{"type":"message_end","message":{}}
{"type":"tool_execution_start","toolCallId":"...","toolName":"read","args":{"path":"file.ts"}}
{"type":"tool_execution_end","toolCallId":"...","toolName":"read","result":{},"isError":false}
{"type":"agent_end","messages":[]}
```

## Extension UI Protocol

Extensions that use `ctx.ui` methods emit requests to the RPC client:

### Requests (stdout → client)

```json
{"type":"extension_ui_request","id":"ui-1","method":"select","title":"Pick one:","options":["A","B","C"]}
{"type":"extension_ui_request","id":"ui-2","method":"confirm","title":"Delete?","message":"Are you sure?"}
{"type":"extension_ui_request","id":"ui-3","method":"input","title":"Name:","placeholder":"Enter name"}
{"type":"extension_ui_request","id":"ui-4","method":"notify","message":"Done!","notifyType":"info"}
{"type":"extension_ui_request","id":"ui-5","method":"setStatus","statusKey":"my-ext","statusText":"Working..."}
{"type":"extension_ui_request","id":"ui-6","method":"setWidget","widgetKey":"my-ext","widgetLines":["Line 1"]}
{"type":"extension_ui_request","id":"ui-7","method":"setTitle","title":"neo - project"}
{"type":"extension_ui_request","id":"ui-8","method":"set_editor_text","text":"prefill"}
```

### Responses (stdin → agent)

```json
{"type":"extension_ui_response","id":"ui-1","value":"A"}
{"type":"extension_ui_response","id":"ui-2","confirmed":true}
{"type":"extension_ui_response","id":"ui-3","value":"John"}
{"type":"extension_ui_response","id":"ui-1","cancelled":true}
```

Fire-and-forget methods (`notify`, `setStatus`, `setWidget`, `setTitle`,
`set_editor_text`) don't require a response.

## Example

```bash
# Start RPC mode
neo --mode rpc

# Send a prompt (stdin)
echo '{"type":"prompt","message":"List files","id":"1"}' | neo --mode rpc 2>/dev/null

# Parse events with jq
neo --mode rpc <<< '{"type":"prompt","message":"hello"}' 2>/dev/null | jq -c 'select(.type == "message_end")'
```
