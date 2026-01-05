# opencode-orca Documentation

OpenCode plugin for safe agent orchestration with human-in-the-loop supervision.

## What is opencode-orca?

A plugin that adds multi-agent orchestration to OpenCode with:

- **Supervised execution** - Checkpoint-based approval gates before agent actions
- **Built-in specialists** - Coder, Tester, Reviewer, Researcher, Document Writer, Architect
- **Custom agents** - Define project-specific agents via `orca.json`
- **Session continuity** - State tracking across agent handoffs

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](getting-started.md) | Installation, first run, basic usage |
| [Configuration](configuration.md) | `orca.json` schema and options reference |
| [Architecture](architecture.md) | System design, message flow, state machine |
| [Custom Agents](custom-agents.md) | Defining and configuring custom specialists |
| [Supervision](supervision.md) | Checkpoint protocol and HITL approval model |
| [Troubleshooting](troubleshooting.md) | Common issues and solutions |

## Quick Navigation

**I want to...**

- **Install the plugin** - See [Getting Started](getting-started.md)
- **Configure agent behavior** - See [Configuration](configuration.md)
- **Add a custom agent** - See [Custom Agents](custom-agents.md)
- **Require approval for agents** - See [Supervision](supervision.md)
- **Understand how it works** - See [Architecture](architecture.md)
- **Fix an error** - See [Troubleshooting](troubleshooting.md)

## Quick Install

```bash
bunx @ex-machina/opencode-orca@latest install
```

See [Getting Started](getting-started.md) for details.
