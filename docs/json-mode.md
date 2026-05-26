# JSON Event Stream Mode

```bash
neo --mode json "Your prompt"
```

Outputs all session events as JSON lines to stdout. Useful for integrating Neo
Code into other tools or custom UIs.

## Event Types

```typescript
type AgentSessionEvent =
  | AgentEvent
  | { type: "queue_update"; steering: readonly string[]; followUp: readonly string[] }
  | { type: "compaction_start"; reason: "manual" | "threshold" | "overflow" | "input_rate_limit" }
  | { type: "compaction_end"; reason: string; result: CompactionResult | undefined; aborted: boolean; willRetry: boolean; errorMessage?: string }
  | { type: "auto_retry_start"; attempt: number; maxAttempts: number; delayMs: number; errorMessage: string }
  | { type: "auto_retry_end"; success: boolean; attempt: number; finalError?: string }
  | { type: "session_info_changed"; name: string | undefined }
  | { type: "thinking_level_changed"; level: ThinkingLevel }
  | { type: "agent_mode_changed"; mode: AgentWorkMode }
  | { type: "tool_approval_request"; request: ToolApprovalRequest }
  | { type: "tool_approval_result"; request: ToolApprovalRequest; decision: ToolApprovalDecision }
  | { type: "background_task_update"; event: string; task: BackgroundShellTaskSnapshot }
  | { type: "rate_limit_action_required"; limitType: "RPM" | "ITPM" | "OTPM" | "BALANCE"; message: string; retryAfterSeconds?: number; canCompact: boolean };
```

Base events from `AgentEvent`:

```typescript
type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end"; messages: AgentMessage[] }
  | { type: "turn_start" }
  | { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }
  | { type: "message_start"; message: AgentMessage }
  | { type: "message_update"; message: AgentMessage; assistantMessageEvent: AssistantMessageEvent }
  | { type: "message_end"; message: AgentMessage }
  | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
  | { type: "tool_execution_update"; toolCallId: string; toolName: string; args: any; partialResult: any }
  | { type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean };
```

## Message Types

Base messages (`@neosantara-xyz/ai`):
- `UserMessage` — user input with text/image content
- `AssistantMessage` — model response with text/thinking/toolCall content
- `ToolResultMessage` — tool execution result

Extended messages (`@neosantara-xyz/code`):
- `BashExecutionMessage` — user `!` / `!!` command execution
- `CustomMessage` — extension-injected messages
- `BranchSummaryMessage` — branch navigation summary
- `CompactionSummaryMessage` — compaction summary

## Output Format

Each line is a JSON object. Events stream as they occur:

```json
{"type":"agent_start"}
{"type":"turn_start"}
{"type":"message_start","message":{"role":"assistant","content":[]}}
{"type":"message_update","message":{},"assistantMessageEvent":{"type":"text_delta","delta":"Hello"}}
{"type":"message_end","message":{}}
{"type":"turn_end","message":{},"toolResults":[]}
{"type":"agent_end","messages":[]}
```

## Example

```bash
neo --mode json "List files" 2>/dev/null | jq -c 'select(.type == "message_end")'
```
