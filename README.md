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

## Configuration

Create `.opencode/orca.json` to customize behavior:

```json
{
  "settings": {
    "autonomy": "assisted",
    "defaultModel": "claude-sonnet-4-20250514"
  },
  "agents": {
    "coder": {
      "model": "claude-sonnet-4-20250514",
      "temperature": 0.3
    }
  }
}
```

### Autonomy Levels

Control how much human oversight is required during orchestration:

| Level        | Description       | Behavior                                                                                                    |
|--------------|-------------------|-------------------------------------------------------------------------------------------------------------|
| `supervised` | Maximum oversight | All significant actions require approval. Dangerous operations blocked.                                     |
| `assisted`   | Balanced          | Routine operations auto-approved. Significant actions require approval. Auto-retries on transient failures. |
| `autonomous` | Minimal gates     | Most operations auto-approved. Only dangerous operations require approval.                                  |

**Action Classifications:**

- **Routine**: Research, reviews, questions - low risk operations
- **Significant**: Coding, testing, document writing - operations that modify state
- **Dangerous**: Destructive patterns like `delete`, `rm -rf`, `--force`, `reset --hard`

**Gate Decision Matrix:**

| Autonomy Level | Routine  | Significant | Dangerous |
|----------------|----------|-------------|-----------|
| supervised     | approval | approval    | block     |
| assisted       | proceed  | approval    | block     |
| autonomous     | proceed  | proceed     | approval  |

### Example Configurations

**Supervised mode (default)** - for critical production work:
```json
{
  "settings": {
    "autonomy": "supervised"
  }
}
```

**Assisted mode** - for typical development:
```json
{
  "settings": {
    "autonomy": "assisted"
  }
}
```

**Autonomous mode** - for rapid prototyping (use with caution):
```json
{
  "settings": {
    "autonomy": "autonomous"
  }
}
```

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

### Autonomy Flow

```
Task Message
    │
    ▼
┌─────────────────────┐
│ Classify Action     │ → routine / significant / dangerous
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Determine Gate      │ → proceed / require_approval / block
└─────────────────────┘
    │
    ├── [proceed] ──────────► Execute dispatch
    │
    ├── [require_approval] ─► Return escalation message
    │                         (Orca presents to user)
    │
    └── [block] ────────────► Return failure message
                              (Operation not permitted)
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
