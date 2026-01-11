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
     |  Planner  | |  Coder   | |  Tester  | | Researcher | |  Reviewer  |
     |  (plans)  | | (code)   | | (tests)  | |  (search)  | | (quality)  |
     +-----------+ +----------+ +----------+ +------------+ +------------+
                          |                         |
                          v                         v
                   +------+------+          +------+-------+
                   | Doc Writer  |          |  Architect   |
                   |   (docs)    |          |  (design)    |
                   +-------------+          +--------------+
```

## Agent Classes

Agents are organized into three classes based on their role in the communication flow.

### Orchestrator (Orca)

The primary agent that receives all user messages and coordinates work.

| Sends                   | Receives                                                          | Responds with |
| ----------------------- | ----------------------------------------------------------------- | ------------- |
| `question` (to Planner) | `plan`, `answer`, `success`, `failure`, `checkpoint`, `interrupt` | (to user)     |
| `task` (to Specialists) |                                                                   |               |

**Key behavior**: Orca sends different message types to different agent classes:
- To Planner: `question` ("How should we do X?")
- To Specialists: `task` ("Do X")

### Planner

Plans complex multi-step tasks. Outputs structured plans with goals, steps, assumptions, and risks.

| Sends                       | Receives   | Responds with                             |
| --------------------------- | ---------- | ----------------------------------------- |
| `question` (to Specialists) | `question` | `plan`, `answer`, `failure`, `checkpoint` |

**Key behavior**: Planners plan, they don't execute. They may ask specialists questions while planning (e.g., "What's the current auth implementation?") but never dispatch tasks.

### Specialists

Execute specific types of work. Each specialist has a focused domain:

| Agent           | Purpose                                     |
| --------------- | ------------------------------------------- |
| coder           | Implements code changes, features, fixes    |
| tester          | Writes and runs tests                       |
| reviewer        | Reviews code for issues and improvements    |
| researcher      | Investigates codebases, APIs, documentation |
| document-writer | Creates technical documentation             |
| architect       | Advises on system design decisions          |

| Sends                | Receives | Responds with                                |
| -------------------- | -------- | -------------------------------------------- |
| `question` (to Orca) | `task`   | `success`, `answer`, `failure`, `checkpoint` |

**Key behavior**: Specialists respond with `success` for completed work or `answer` for information requests. They may ask clarifying questions back to Orca.

### Communication Flow

```
                    User
                      │
                      ▼
              ┌──────────────┐
              │     Orca     │
              └──────┬───────┘
         question    │    task
              ┌──────┴──────┐
              ▼             ▼
        ┌─────────┐   ┌───────────┐
        │ Planner │   │Specialists│
        └────┬────┘   └─────┬─────┘
             │              │
        plan/answer    success/answer
        failure        failure
        checkpoint     checkpoint
```

### Checkpoint Capability

**Checkpoints are about RISK, not work type.** Any agent performing operations with risk (not just write operations) can emit checkpoints:

- Writing/modifying files
- Executing shell commands
- Sending data to external services (even read-only, e.g., PII exposure risk)
- Making irreversible changes

Supervised agents require explicit user approval before proceeding past checkpoints.

## Message Protocol

All inter-agent communication uses typed messages validated by Zod discriminated unions. Messages use a **flattened structure** where fields go directly on the message with a `type` discriminant (no `payload` wrapper).

### Message Types

**Request types** (sent to agents):

| Type        | Sender        | Recipient            | Purpose                   |
| ----------- | ------------- | -------------------- | ------------------------- |
| `question`  | Orca, Planner | Planner, Specialists | Request information       |
| `task`      | Orca          | Specialists          | Assign work for execution |
| `interrupt` | User          | Orca                 | Cancel ongoing execution  |

**Response types** (returned by agents):

| Type         | Sender      | Recipient | Purpose                     |
| ------------ | ----------- | --------- | --------------------------- |
| `answer`     | Any agent   | Caller    | Information response        |
| `success`    | Specialists | Caller    | Work completed successfully |
| `plan`       | Planner     | Orca      | Execution plan proposal     |
| `checkpoint` | Any agent   | Caller    | Requires user approval      |
| `failure`    | Any agent   | Caller    | Reports error               |

### Two Communication Patterns

The protocol distinguishes between **information retrieval** and **work execution**:

```
Question/Answer (information):
  Orca/Planner --question--> Agent --answer--> Caller

Task/Success (execution):
  Orca --task--> Specialist --success/failure--> Orca
```

This separation ensures:
- Planners never execute work (they ask questions, they don't dispatch tasks)
- The response type reflects what was requested (information vs. completion)
- Clear semantics for each message type

### Message Structure

All messages share common fields:

```typescript
{
  type: 'answer' | 'success' | 'plan' | ...,
  timestamp: ISO8601,
  agent_id: string,
  // ... type-specific fields directly on message
}
```

Request messages include `session_id` for routing:

```typescript
{
  type: 'task' | 'question',
  session_id: UUID,
  timestamp: ISO8601,
  // ... type-specific fields
}
```

### Schema Examples

```typescript
// Answer - information response
{
  type: 'answer',
  agent_id: 'researcher',
  content: 'The API uses OAuth2...',
  sources: [{ type: 'file', ref: 'src/auth.ts' }],
  annotations: [{ type: 'caveat', content: 'Docs may be outdated' }]
}

// Success - work completion
{
  type: 'success',
  agent_id: 'coder',
  summary: 'Implemented OAuth2 flow',
  artifacts: ['src/auth.ts', 'src/middleware/auth.ts'],
  verification: ['tests pass', 'lint clean'],
  notes: ['Added dependency: passport-oauth2']
}

// Plan - execution proposal
{
  type: 'plan',
  agent_id: 'planner',
  goal: 'Implement OAuth2 authentication',
  steps: [{ description: 'Add passport dependency' }, ...],
  assumptions: ['Using Express.js'],
  files_touched: ['src/auth.ts', 'package.json'],
  verification: ['Run auth tests', 'Manual login test'],
  risks: ['Breaking change to existing sessions']
}
```

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
              | user message                  | task/question dispatch
              v                               v
         [Route to Orca]              [Agent processing]
```

- **IDLE**: Waiting for user input or checkpoint approval
- **EXECUTING**: Processing request through agent pipeline
- Checkpoint pauses execution until user approves
- Completion returns to IDLE state

## Design Decisions

### Zod Discriminated Unions for Validation

Type-safe message handling with runtime validation:
- Compile-time type inference from schemas
- Runtime validation catches malformed messages early
- Single source of truth for message structure
- Discriminant field enables exhaustive switch handling

### Question/Answer vs Task/Success

Two distinct communication patterns serve different purposes:

| Pattern     | Request    | Response            | Purpose            |
| ----------- | ---------- | ------------------- | ------------------ |
| Information | `question` | `answer`            | Research, analysis |
| Execution   | `task`     | `success`/`failure` | Work completion    |

This ensures semantic clarity: questions get answers, tasks get results.

### Checkpoint Protocol for Supervision

Human-in-the-loop safety for risky operations:
- Any agent can emit checkpoints (not just execution agents)
- Risk includes read operations (e.g., PII exposure to untrusted services)
- Users can approve individual steps or "approve all remaining"
- Checkpoints pause execution until explicit approval

### Session-Based Context Passing

Maintains conversation state across agent handoffs:
- Agents see relevant history from parent session
- Parent-child linking preserves execution trace
- Enables coherent multi-step task completion

### Response Validation with Retry

Ensures agents respond in correct format:
- Validates all agent responses against expected schemas
- On validation failure, re-prompts agent with correction guidance
- Configurable retry count prevents infinite loops
