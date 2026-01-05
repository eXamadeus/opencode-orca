# Supervision

Supervision provides human-in-the-loop approval gates that prevent agents from executing tasks without explicit user consent. This safety mechanism protects against unintended destructive operations or external side effects.

## How It Works

When an agent is supervised, Orca cannot dispatch tasks directly. Instead, the plugin returns a **checkpoint** message that pauses execution and asks the user to approve before proceeding.

```
    Orca                  Plugin                  Agent
      |                     |                      |
      |--- dispatch task -->|                      |
      |                     |-- check supervised --|
      |<-- checkpoint ------|                      |
      |                     |                      |
   [User approves]          |                      |
      |                     |                      |
      |--- re-dispatch ---->|                      |
      |  (approved: true)   |--- execute task ---->|
      |                     |<---- response -------|
      |<--- response -------|                      |
```

## Enabling Supervision

### Per-Agent

Set `supervised: true` on specific agents:

```json
{
  "agents": {
    "coder": {
      "supervised": true
    }
  }
}
```

### Globally

Enable supervision for all agents by default:

```json
{
  "settings": {
    "defaultSupervised": true
  }
}
```

### Resolution Order

1. Agent's explicit `supervised` setting (if defined)
2. Global `defaultSupervised` setting (if defined)
3. Default: `false` (no supervision)

Per-agent settings always take precedence over global defaults.

## Checkpoint Flow

1. **Orca dispatches task** to a specialist agent via `orca_dispatch`
2. **Plugin checks supervision** using `isAgentSupervised()` in dispatch.ts
3. **If supervised and not pre-approved**, plugin returns a `checkpoint` message
4. **Orca presents checkpoint** to the user, explaining what will run and why
5. **User responds** with one of:
   - Approve this step
   - Deny this step
   - Approve all remaining steps in this plan
6. **If approved**, Orca re-dispatches with `plan_context.approved_remaining: true`
7. **Agent executes** and returns its response

## Plan Context

The `plan_context` field in task messages tracks approval state across multi-step plans.

| Field | Type | Description |
|-------|------|-------------|
| `goal` | string | The overall plan objective |
| `step_index` | number | Current step number (0-based) |
| `approved_remaining` | boolean | If true, skip checkpoints for remaining steps |

When `approved_remaining` is true, subsequent supervised agents in the same plan execute without additional checkpoints.

## Checkpoint Message Structure

When a checkpoint is returned, it contains:

| Field | Type | Description |
|-------|------|-------------|
| `agent_id` | string | The agent awaiting approval |
| `prompt` | string | What the agent would execute |
| `step_index` | number (optional) | Current step in the plan |
| `plan_goal` | string (optional) | Overall objective of the plan |

## When to Use Supervision

Enable supervision for agents that perform potentially risky operations:

| Use Case | Risk Level | Recommendation |
|----------|------------|----------------|
| File modifications (coder) | High | Supervise |
| Shell command execution | High | Supervise |
| External API calls | Medium | Consider supervising |
| Code review (read-only) | Low | Usually not needed |
| Research (read-only) | Low | Usually not needed |

## Example Configuration

Supervise high-risk agents while allowing read-only agents to run freely:

```json
{
  "agents": {
    "coder": { "supervised": true },
    "tester": { "supervised": true },
    "reviewer": { "supervised": false },
    "researcher": { "supervised": false }
  }
}
```

## See Also

- [Configuration](configuration.md) - Full configuration reference
- [Custom Agents](custom-agents.md) - Creating supervised custom agents
