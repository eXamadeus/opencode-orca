# opencode-orca 🪼

OpenCode plugin for safe and effective agent orchestration.

## Requirements

- [OpenCode](https://opencode.ai) ^1.0.0
- [Bun](https://bun.sh) runtime

## Features

- **Type-enforced contracts** - Zod discriminated union validation for all agent messages
- **State machine orchestration** - IDLE/EXECUTING states with human-in-the-loop gates
- **Session continuity** - Persistent context between agents via session_id tracking
- **Per-agent supervision** - Checkpoint protocol for approval gates on sensitive operations

## Architecture

```
User Input
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

## Installation

```bash
bunx @ex-machina/opencode-orca@latest install
```

See [Getting Started](docs/getting-started.md) for verification steps and first use.

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
    }
  }
}
```

See [Configuration](docs/configuration.md) for the full reference.

## Documentation

- [Getting Started](docs/getting-started.md) - Quick start guide
- [Configuration](docs/configuration.md) - Full orca.json reference
- [Architecture](docs/architecture.md) - System design and decisions
- [Custom Agents](docs/custom-agents.md) - Creating custom agents
- [Supervision](docs/supervision.md) - Checkpoint and HITL model
- [Troubleshooting](docs/troubleshooting.md) - Common issues

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
