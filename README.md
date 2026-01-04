# opencode-orca &#x1FACD;

OpenCode plugin for safe and effective agent orchestration.

## Overview

This plugin provides a structured agent orchestration system with:

- **Type-enforced contracts** via Zod discriminated union validation
- **State machine orchestration** (IDLE/EXECUTING) with human-in-the-loop gates
- **Session continuity** between agents via session_id tracking
- **Per-agent supervision** with checkpoint protocol for approval gates

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


## Installation

The easiest way to install is using the CLI:

```bash
bunx @ex-machina/opencode-orca@latest install
```

This will:
1. Add `@ex-machina/opencode-orca` to the `plugin` array in your `opencode.jsonc`
2. Create a default configuration file at `.opencode/orca.json`

### Manual Installation

Alternatively, add to your `opencode.jsonc` manually:

```json
{
  "plugin": ["@ex-machina/opencode-orca"]
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

## CLI Commands

### `opencode-orca install`

Installs the Orca plugin into your OpenCode project.

```bash
bunx @ex-machina/opencode-orca install [options]

Options:
  --force, -f    Force reinstall even if already installed
```

### `opencode-orca uninstall`

Removes the Orca plugin from your OpenCode project.

```bash
bunx @ex-machina/opencode-orca uninstall [options]

Options:
  --remove-config, -r    Remove .opencode/orca.json without prompting
  --keep-config, -k      Keep .opencode/orca.json without prompting
```

### `opencode-orca init`

Creates only the `.opencode/orca.json` configuration file without modifying `opencode.jsonc`. Useful for customizing the config before installing.

```bash
bunx @ex-machina/opencode-orca init [options]

Options:
  --force, -f    Overwrite existing configuration
```

### `opencode-orca --help`

Shows help information.

### `opencode-orca --version`

Shows the installed version.

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
