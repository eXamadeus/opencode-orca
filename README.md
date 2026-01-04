# opencode-orca

OpenCode plugin for Orca + Specialists agent orchestration.

## Overview

This plugin provides a structured agent orchestration system with:

- **Type-enforced contracts** via Zod discriminated union validation
- **State machine orchestration** (IDLE/EXECUTING) with human-in-the-loop gates
- **Session continuity** between agents via session_id tracking
- **Per-agent supervision** with checkpoint protocol for approval gates

## Installation

```bash
bunx opencode-orca install
```

Or manually add to your `opencode.json`:

```json
{
  "plugin": ["opencode-orca"]
}
```

## Configuration

Create `.opencode/orca.json` to customize behavior:

```json
{
  "settings": {
    "defaultSupervised": false,
    "defaultModel": "anthropic/claude-sonnet-4-20250514"
  },
  "agents": {
    "coder": {
      "supervised": true
    },
    "my-specialist": {
      "mode": "subagent",
      "description": "Custom specialist agent",
      "prompt": "You are a custom specialist..."
    }
  }
}
```

### Supervision

Agents can be marked as "supervised" to require user approval before dispatch:

- **Per-agent**: Set `supervised: true` on specific agents
- **Global default**: Set `settings.defaultSupervised: true` for all agents

When dispatching to a supervised agent, the plugin returns a `checkpoint` message instead of executing. The orchestrator (Orca) presents this to the user for approval before proceeding.

## Architecture

```
User Inputa
    │
    ▼
  Orca (Orchestrator)
    │
    ├──► Strategist (Planning)
    │
    └──► Specialists (Execution)
         ├── Coder
         ├── Tester
         ├── Reviewer
         ├── Researcher
         ├── Document Writer
         └── Architect
```

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Watch mode
bun run dev

# Type check
bun run typecheck

# Test
bun test
```

## License

MIT
