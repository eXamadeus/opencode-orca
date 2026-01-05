# Architecture

This document describes the system design and architecture decisions behind opencode-orca.

## High-Level Architecture

```
                              +-------------------+
                              |    User Input     |
                              +--------+----------+
                                       |
                                       v
                    +------------------+------------------+
                    |           Orca (Orchestrator)       |
                    |           mode: 'primary'           |
                    +------------------+------------------+
                                       |
            +-----------+--------------+--------------+-----------+
            |           |              |              |           |
            v           v              v              v           v
     +------+----+ +----+-----+ +-----+----+ +------+-----+ +-----+------+
     | Strategist| |  Coder   | |  Tester  | | Researcher | |  Reviewer  |
     |  (plans)  | | (code)   | | (tests)  | |  (search)  | | (quality)  |
     +-----------+ +----------+ +----------+ +------------+ +------------+
                          |                         |
                          v                         v
                   +------+------+          +------+-------+
                   | Doc Writer  |          |  Architect   |
                   |   (docs)    |          |  (design)    |
                   +-------------+          +--------------+
```

## Agent Hierarchy

**Orca (Orchestrator)** - Mode: `primary`. Receives all user messages, routes to specialists, synthesizes results. Uses strategist for 3+ step tasks.

**Strategist** - Mode: `subagent`. Plans complex multi-step tasks before execution. Outputs structured plans with goals, steps, assumptions.

**Specialists** - All `subagent` mode, invoked by Orca:

| Agent | Purpose |
|-------|---------|
| coder | Implements code changes, features, fixes |
| tester | Writes and runs tests |
| reviewer | Reviews code for issues and improvements |
| researcher | Investigates codebases, APIs, documentation |
| document-writer | Creates technical documentation |
| architect | Advises on system design decisions |

## Message Protocol

All inter-agent communication uses typed message envelopes validated by Zod discriminated unions.

| Type | Direction | Purpose |
|------|-----------|---------|
| `task` | Orca -> Agent | Assigns work to a specialist |
| `plan` | Strategist -> Orca | Returns execution plan |
| `answer` | Agent -> Orca | Response with content, sources, annotations |
| `question` | Agent -> Orca | Asks for clarification |
| `escalation` | Agent -> Orca | Escalates decision to orchestrator |
| `user_input` | User -> Orca | User provides input |
| `interrupt` | User -> Orca | User interrupts execution |
| `failure` | Agent -> Orca | Reports error with code |
| `checkpoint` | System -> Orca | Requires user approval |

### Envelope Structure

Request messages (task, user_input, interrupt):
```typescript
{ type, session_id: UUID, timestamp: ISO8601, payload }
```

Response messages (answer, plan, question, escalation, failure, checkpoint):
```typescript
{ type, timestamp: ISO8601, payload }
```

Response messages omit `session_id` - Orca manages sessions externally.

## Session Continuity

Sessions maintain context across agent handoffs:

- **session_id**: UUID identifying the conversation session
- **parent_session_id**: Links child tasks to parent session for context
- **plan_context**: Tracks plan execution state (goal, step_index, approved_remaining)

```
User Request -> Orca creates session -> Dispatches task with parent_session_id
             -> Agent responds in same context -> Orca synthesizes and continues
```

## State Machine

```
          +--------+                    +------------+
          |  IDLE  |  <-- checkpoint    | EXECUTING  |
          |        |      approval -->  |            |
          +---+----+                    +-----+------+
              |                               |
              | user_input                    | task dispatch
              v                               v
         [Route to Orca]              [Agent processing]
```

- **IDLE**: Waiting for user input or checkpoint approval
- **EXECUTING**: Processing task through agent pipeline
- Checkpoint pauses execution until user approves
- Completion returns to IDLE state

## Design Decisions

### Zod Discriminated Unions for Validation

Type-safe message handling with runtime validation. Compile-time type inference from schemas, runtime validation catches malformed messages early, single source of truth for message structure, discriminant field enables exhaustive switch handling.

### Checkpoint Protocol for Supervision

Human-in-the-loop safety for sensitive operations. Supervised agents require explicit approval before execution. Users can approve individual steps or "approve all remaining" via `plan_context.approved_remaining`.

### Session-Based Context Passing

Maintains conversation state across agent handoffs. Agents see relevant history from parent session. Parent-child linking preserves execution trace for coherent multi-step task completion.

### Response Validation with Retry

Ensures agents respond in correct format. Validates all agent responses against expected schemas. On validation failure, re-prompts agent with correction guidance. Configurable retry count prevents infinite loops.
