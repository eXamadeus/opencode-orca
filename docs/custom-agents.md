# Custom Agents

Create specialized agents tailored to your project needs.

## How Custom Agents Work

Custom agents are defined in `.opencode/orca.json` under the `agents` key. Configurations merge with defaults, allowing you to override built-in agents (same name) or add new ones (unique name).

Built-in agents: `orca`, `strategist`, `coder`, `tester`, `reviewer`, `researcher`, `document-writer`, `architect`

## Configuration Fields

For overrides, all fields are optional (they merge). For new agents, include:

| Field | Purpose |
|-------|---------|
| `mode` | Set to `'subagent'` for agents dispatched by Orca |
| `description` | Shown in UI; helps Orca select the right agent |
| `prompt` | System prompt defining agent behavior |
| `responseTypes` | Message types the agent can return |

See [Configuration Reference](configuration.md) for all fields.

## Protocol Requirements

Agents respond with a JSON message envelope:

```json
{ "type": "answer", "timestamp": "2025-01-05T10:30:00Z", "payload": { ... } }
```

The `responseTypes` array determines valid message types. Default for subagents: `['answer', 'failure']`

## Response Types

| Type | Purpose | Key Payload Fields |
|------|---------|-------------------|
| `answer` | Content response | `agent_id`, `content`, `sources?`, `annotations?` |
| `plan` | Execution plan | `agent_id`, `goal`, `steps[]` |
| `question` | Ask clarification | `agent_id`, `question`, `options?`, `blocking` |
| `escalation` | Escalate decision | `agent_id`, `decision_id`, `decision`, `options[]`, `context` |
| `failure` | Report error | `agent_id?`, `code`, `message`, `cause?` |

Error codes: `VALIDATION_ERROR`, `UNKNOWN_AGENT`, `SESSION_NOT_FOUND`, `AGENT_ERROR`, `TIMEOUT`

### Example: Answer Response

```json
{
  "type": "answer",
  "payload": {
    "agent_id": "security-reviewer",
    "content": "Found 2 potential vulnerabilities...",
    "sources": [{ "type": "file", "ref": "src/auth.ts" }]
  }
}
```

### Example: Question Response

```json
{
  "type": "question",
  "payload": {
    "agent_id": "security-reviewer",
    "question": "Which auth method should I evaluate?",
    "options": ["OAuth2", "JWT", "Session-based"],
    "blocking": true
  }
}
```

## Complete Example: Security Reviewer

```json
{
  "agents": {
    "security-reviewer": {
      "description": "Reviews code for security vulnerabilities",
      "mode": "subagent",
      "model": "claude-sonnet-4-20250514",
      "supervised": true,
      "responseTypes": ["answer", "question", "failure"],
      "prompt": "You are a security specialist. Analyze code for vulnerabilities including injection attacks, authentication flaws, and data exposure. Cite file locations. Ask questions if scope is unclear.",
      "permission": { "edit": "deny", "bash": "deny" }
    }
  }
}
```

Use it: `@orca Review the auth module for security issues`

## Overriding Built-in Agents

Use the same name; only specify fields to change:

```json
{
  "agents": {
    "coder": {
      "supervised": true,
      "model": "claude-sonnet-4-20250514",
      "maxSteps": 30
    }
  }
}
```

This adds supervision to coder while keeping its default prompt and tools.

## Testing Custom Agents

1. Verify config loads without errors (check OpenCode startup)
2. Dispatch to your agent via `@orca` with a relevant task
3. Confirm responses match your `responseTypes` list
4. Check supervision gates appear if `supervised: true`

Failed validations retry up to `validation.maxRetries` times before returning failure.

## See Also

- [Configuration Reference](configuration.md) - All configuration options
- [Supervision](supervision.md) - Approval checkpoints
