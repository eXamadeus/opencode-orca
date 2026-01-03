# opencode-orca

OpenCode plugin for Orca + Specialists agent orchestration.

## Overview

This plugin provides a structured agent orchestration system with:

- **Type-enforced contracts** via Zod discriminated union validation
- **State machine orchestration** (IDLE/EXECUTING) with human-in-the-loop gates
- **Session continuity** between agents via session_id tracking
- **Configurable autonomy levels** (supervised, assisted, autonomous)

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
