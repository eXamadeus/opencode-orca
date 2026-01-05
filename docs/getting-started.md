# Getting Started

Get up and running with opencode-orca in under 30 seconds.

## Prerequisites

- [OpenCode](https://opencode.ai) ^1.0.0
- [Bun](https://bun.sh) runtime

## Quick Start

### 1. Install the plugin

Run this command in your project directory:

```bash
bunx @ex-machina/opencode-orca@latest install
```

This command:
- Adds `@ex-machina/opencode-orca` to the `plugin` array in your `opencode.jsonc`
- Creates a default configuration file at `.opencode/orca.json`

### 2. Verify installation

Check that the plugin was added to your OpenCode config:

```bash
cat opencode.jsonc
```

You should see:

```json
{
  "plugin": ["@ex-machina/opencode-orca"]
}
```

### 3. Start OpenCode

Launch OpenCode in your project:

```bash
opencode
```

### 4. Talk to Orca

In the OpenCode chat, try:

```
@orca Help me refactor the authentication module
```

Orca will analyze your request, create a plan, and coordinate specialist agents to execute it.

## What happens next

When you interact with Orca:

1. **Strategist** analyzes your request and creates an execution plan
2. **You approve** the plan (or request changes)
3. **Specialist agents** execute each step (coder, tester, reviewer, etc.)
4. **Orca** coordinates the workflow and reports results

## Next steps

- [Configuration](./configuration.md) - Customize models, validation, and agent behavior
- [Custom Agents](./custom-agents.md) - Create your own specialist agents
- [Supervision](./supervision.md) - Configure approval gates for agent actions
