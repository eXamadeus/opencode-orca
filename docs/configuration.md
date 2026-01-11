# Configuration Reference

Configure opencode-orca via `.opencode/orca.json` in your project root.

## File Structure

```json
{
  "settings": { ... },
  "agents": { ... }
}
```

Both top-level keys are optional. The file itself is optional.

## Settings

Global plugin settings under the `settings` key.

| Option                     | Type          | Default | Description                                            |
|----------------------------|---------------|---------|--------------------------------------------------------|
| `defaultSupervised`        | boolean       | `false` | Require user approval for all agents by default        |
| `defaultModel`             | string        |         | Default model for agents without explicit model config |
| `updateNotifier`           | boolean       | `true`  | Show notifications about plugin updates                |
| `validation.maxRetries`    | number (0-10) | `3`     | Max retries when agent response fails validation       |
| `validation.wrapPlainText` | boolean       | `true`  | Wrap plain text responses in result messages           |

## Agent Configuration

Override built-in agents or define custom ones under the `agents` key.

| Option         | Type                                | Description                                                    |
|----------------|-------------------------------------|----------------------------------------------------------------|
| `model`        | string                              | Model identifier (e.g., `claude-sonnet-4-20250514`)            |
| `temperature`  | number (0-2)                        | Sampling temperature                                           |
| `top_p`        | number (0-1)                        | Nucleus sampling parameter                                     |
| `prompt`       | string                              | System prompt (overrides built-in prompt)                      |
| `tools`        | `Record<string, boolean>`           | Enable/disable specific tools                                  |
| `disable`      | boolean                             | Disable this agent entirely                                    |
| `description`  | string                              | Agent description shown in UI                                  |
| `mode`         | `'subagent' \| 'primary'  \| 'all'` | Agent visibility mode                                          |
| `color`        | string                              | Hex color for UI display (`#RRGGBB`)                           |
| `maxSteps`     | number                              | Maximum steps before agent stops                               |
| `permission`   | PermissionConfig                    | Permission overrides (see below)                               |
| `supervised`   | boolean                             | Require user approval before dispatch                          |
| `messageTypes` | array                               | Message types that can be dispatched to this agent (see below) |

### Response Types

Allowed message types: `answer`, `plan`, `question`, `escalation`, `failure`. Default: `['answer', 'failure']`

### Permission Config

Fine-grained permission control per agent.

| Permission           | Type                            | Description              |
|----------------------|---------------------------------|--------------------------|
| `edit`               | `'ask' \| 'allow' \| 'deny'`    | File editing permission  |
| `bash`               | enum or `Record<pattern, enum>` | Shell command permission |
| `webfetch`           | `'ask' \| 'allow' \| 'deny'`    | Web fetch permission     |
| `doom_loop`          | `'ask' \| 'allow' \| 'deny'`    | Allow repeated failures  |
| `external_directory` | `'ask' \| 'allow' \| 'deny'`    | Access outside project   |

For `bash`, you can specify per-command patterns:

```json
{
  "bash": {
    "git *": "allow",
    "rm *": "deny",
    "*": "ask"
  }
}
```

## Examples

### Enable Supervision Globally

Require approval before any agent executes:

```json
{
  "settings": {
    "defaultSupervised": true
  }
}
```

### Override a Built-in Agent

Change the coder agent's model and temperature:

```json
{
  "agents": {
    "coder": {
      "model": "claude-sonnet-4-20250514",
      "temperature": 0.3,
      "maxSteps": 50
    }
  }
}
```

### Add a Custom Agent

Define a project-specific specialist:

```json
{
  "agents": {
    "api-designer": {
      "description": "Designs REST API endpoints",
      "model": "claude-sonnet-4-20250514",
      "mode": "subagent",
      "prompt": "You are an API design specialist...",
      "responseTypes": ["answer", "question", "failure"],
      "supervised": true,
      "permission": {
        "edit": "allow",
        "bash": "deny"
      }
    }
  }
}
```

### Customize Validation and Notifications

```json
{
  "settings": {
    "updateNotifier": false,
    "validation": {
      "maxRetries": 1,
      "wrapPlainText": false
    }
  }
}
```

## Validation

The plugin validates `orca.json` on load. Invalid configs produce clear error messages with paths and expected types. Fix all validation errors before the plugin will load.

## See Also

- [Custom Agents](custom-agents.md) - Detailed guide on creating agents
- [Supervision](supervision.md) - How approval checkpoints work
