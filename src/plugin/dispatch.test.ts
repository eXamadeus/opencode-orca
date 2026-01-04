import { describe, expect, mock, test } from 'bun:test'
import type { OpencodeClient } from '@opencode-ai/sdk'
import type { TaskMessage } from '../schemas/messages'
import type { PlanContext } from '../schemas/payloads'
import {
  type DispatchContext,
  createCheckpointMessage,
  dispatchToAgent,
  isAgentSupervised,
} from './dispatch'
import { DEFAULT_VALIDATION_CONFIG } from './types'

/**
 * Create a mock OpenCode client for testing
 * Uses unknown -> OpencodeClient cast to avoid complex SDK type matching
 */
function createMockClient(options: {
  createSessionId?: string
  createSessionError?: boolean
  promptResponse?: string
  promptError?: Error
}): OpencodeClient {
  const mockSession = {
    create: mock(async () => {
      if (options.createSessionError) {
        return { data: null }
      }
      return { data: { id: options.createSessionId ?? 'test-session-id' } }
    }),
    prompt: mock(async () => {
      if (options.promptError) {
        throw options.promptError
      }
      return {
        data: {
          parts: [
            {
              id: 'part-1',
              sessionID: 'test-session',
              messageID: 'msg-1',
              type: 'text' as const,
              text: options.promptResponse ?? 'Default response',
            },
          ],
        },
      }
    }),
  }

  return { session: mockSession } as unknown as OpencodeClient
}

/**
 * Create a valid TaskMessage for testing
 */
function createTaskMessage(
  overrides?: Partial<TaskMessage['payload']> & { plan_context?: PlanContext },
): string {
  const message: TaskMessage = {
    type: 'task',
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    timestamp: '2024-01-01T00:00:00.000Z',
    payload: {
      agent_id: 'coder',
      prompt: 'Write a function',
      ...overrides,
    },
  }
  return JSON.stringify(message)
}

/**
 * Create a TaskMessage object for testing helper functions
 */
function createTaskMessageObject(
  overrides?: Partial<TaskMessage['payload']> & { plan_context?: PlanContext },
): TaskMessage {
  return {
    type: 'task',
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    timestamp: '2024-01-01T00:00:00.000Z',
    payload: {
      agent_id: 'coder',
      prompt: 'Write a function',
      ...overrides,
    },
  }
}

describe('dispatchToAgent', () => {
  const testAgents = {
    coder: { mode: 'subagent' as const, description: 'Codes things' },
    researcher: { mode: 'subagent' as const, description: 'Researches things' },
  }

  test('returns failure for invalid task message format', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({}),
      agents: testAgents,
      validationConfig: DEFAULT_VALIDATION_CONFIG,
    }

    const result = await dispatchToAgent('not valid json', ctx)
    const parsed = JSON.parse(result)

    expect(parsed.type).toBe('failure')
    expect(parsed.payload.code).toBe('VALIDATION_ERROR')
  })

  test('returns failure for unknown agent', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({}),
      agents: testAgents,
      validationConfig: DEFAULT_VALIDATION_CONFIG,
    }

    const result = await dispatchToAgent(createTaskMessage({ agent_id: 'unknown-agent' }), ctx)
    const parsed = JSON.parse(result)

    expect(parsed.type).toBe('failure')
    expect(parsed.payload.code).toBe('UNKNOWN_AGENT')
    expect(parsed.payload.cause).toContain('coder')
    expect(parsed.payload.cause).toContain('researcher')
  })

  test('returns failure when session creation fails', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({ createSessionError: true }),
      agents: testAgents,
      validationConfig: DEFAULT_VALIDATION_CONFIG,
    }

    const result = await dispatchToAgent(createTaskMessage(), ctx)
    const parsed = JSON.parse(result)

    expect(parsed.type).toBe('failure')
    expect(parsed.payload.code).toBe('SESSION_NOT_FOUND')
  })

  test('returns failure when agent returns empty response', async () => {
    const mockClient = {
      session: {
        create: mock(async () => ({ data: { id: 'test-session' } })),
        prompt: mock(async () => ({ data: { parts: [] } })),
      },
    } as unknown as OpencodeClient

    const ctx: DispatchContext = {
      client: mockClient,
      agents: testAgents,
      validationConfig: DEFAULT_VALIDATION_CONFIG,
    }

    const result = await dispatchToAgent(createTaskMessage(), ctx)
    const parsed = JSON.parse(result)

    expect(parsed.type).toBe('failure')
    expect(parsed.payload.code).toBe('AGENT_ERROR')
    expect(parsed.payload.message).toContain('empty response')
  })

  test('wraps plain text response as result message', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({ promptResponse: 'Here is my plain text response' }),
      agents: testAgents,
      validationConfig: { maxRetries: 2, wrapPlainText: true },
    }

    const result = await dispatchToAgent(createTaskMessage(), ctx)
    const parsed = JSON.parse(result)

    expect(parsed.type).toBe('result')
    expect(parsed.payload.content).toBe('Here is my plain text response')
    expect(parsed.payload.agent_id).toBe('coder')
  })

  test('returns valid JSON response from agent', async () => {
    const validResponse = JSON.stringify({
      type: 'result',
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2024-01-01T00:00:00.000Z',
      payload: {
        agent_id: 'coder',
        content: 'Task completed',
      },
    })

    const ctx: DispatchContext = {
      client: createMockClient({ promptResponse: validResponse }),
      agents: testAgents,
      validationConfig: { maxRetries: 2, wrapPlainText: false },
    }

    const result = await dispatchToAgent(createTaskMessage(), ctx)
    const parsed = JSON.parse(result)

    expect(parsed.type).toBe('result')
    expect(parsed.payload.content).toBe('Task completed')
  })

  test('returns failure when agent throws error', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({ promptError: new Error('Agent crashed') }),
      agents: testAgents,
      validationConfig: DEFAULT_VALIDATION_CONFIG,
    }

    const result = await dispatchToAgent(createTaskMessage(), ctx)
    const parsed = JSON.parse(result)

    expect(parsed.type).toBe('failure')
    expect(parsed.payload.code).toBe('AGENT_ERROR')
    expect(parsed.payload.cause).toContain('Agent crashed')
  })

  test('returns timeout failure when abort signal is triggered', async () => {
    const abortController = new AbortController()
    abortController.abort()

    const mockClient = {
      session: {
        create: mock(async () => ({ data: { id: 'test-session' } })),
        prompt: mock(async () => {
          throw new Error('Request aborted')
        }),
      },
    } as unknown as OpencodeClient

    const ctx: DispatchContext = {
      client: mockClient,
      agents: testAgents,
      validationConfig: DEFAULT_VALIDATION_CONFIG,
      abort: abortController.signal,
    }

    const result = await dispatchToAgent(createTaskMessage(), ctx)
    const parsed = JSON.parse(result)

    expect(parsed.type).toBe('failure')
    expect(parsed.payload.code).toBe('TIMEOUT')
  })

  test('uses parent_session_id when provided', async () => {
    const promptMock = mock(async () => ({
      data: {
        parts: [
          {
            id: 'p1',
            sessionID: 's1',
            messageID: 'm1',
            type: 'text' as const,
            text: 'Response',
          },
        ],
      },
    }))

    const createMock = mock(async () => ({ data: { id: 'new-session' } }))

    const mockClient = {
      session: {
        create: createMock,
        prompt: promptMock,
      },
    } as unknown as OpencodeClient

    const ctx: DispatchContext = {
      client: mockClient,
      agents: testAgents,
      validationConfig: { maxRetries: 2, wrapPlainText: true },
    }

    const taskWithParent = createTaskMessage({
      parent_session_id: '550e8400-e29b-41d4-a716-446655440000', // Must be valid UUID
    })

    const result = await dispatchToAgent(taskWithParent, ctx)
    const parsed = JSON.parse(result)

    // Should succeed with wrapped plain text response
    expect(parsed.type).toBe('result')

    // Should not create a new session when parent_session_id is provided
    expect(createMock).not.toHaveBeenCalled()

    // Should call prompt with the parent session ID
    expect(promptMock).toHaveBeenCalled()
  })
})

describe('isAgentSupervised', () => {
  test('returns false when agent has no supervised flag and no default', () => {
    const agents = { coder: { mode: 'subagent' as const } }
    expect(isAgentSupervised('coder', agents)).toBe(false)
  })

  test('returns true when agent has supervised: true', () => {
    const agents = { coder: { mode: 'subagent' as const, supervised: true } }
    expect(isAgentSupervised('coder', agents)).toBe(true)
  })

  test('returns false when agent has supervised: false', () => {
    const agents = { coder: { mode: 'subagent' as const, supervised: false } }
    expect(isAgentSupervised('coder', agents)).toBe(false)
  })

  test('uses defaultSupervised when agent has no supervised flag', () => {
    const agents = { coder: { mode: 'subagent' as const } }
    expect(isAgentSupervised('coder', agents, { defaultSupervised: true })).toBe(true)
    expect(isAgentSupervised('coder', agents, { defaultSupervised: false })).toBe(false)
  })

  test('agent supervised flag overrides defaultSupervised', () => {
    const agents = { coder: { mode: 'subagent' as const, supervised: false } }
    expect(isAgentSupervised('coder', agents, { defaultSupervised: true })).toBe(false)

    const agents2 = { coder: { mode: 'subagent' as const, supervised: true } }
    expect(isAgentSupervised('coder', agents2, { defaultSupervised: false })).toBe(true)
  })

  test('returns false for unknown agent', () => {
    const agents = { coder: { mode: 'subagent' as const } }
    expect(isAgentSupervised('unknown', agents)).toBe(false)
  })
})

describe('createCheckpointMessage', () => {
  test('creates checkpoint from task message', () => {
    const task = createTaskMessageObject()
    const checkpoint = createCheckpointMessage(task)

    expect(checkpoint.type).toBe('checkpoint')
    expect(checkpoint.session_id).toBe(task.session_id)
    expect(checkpoint.payload.agent_id).toBe('coder')
    expect(checkpoint.payload.prompt).toBe('Write a function')
    expect(checkpoint.payload.step_index).toBeUndefined()
    expect(checkpoint.payload.plan_goal).toBeUndefined()
  })

  test('includes plan context fields when present', () => {
    const task = createTaskMessageObject({
      plan_context: {
        goal: 'Build feature X',
        step_index: 2,
        approved_remaining: false,
      },
    })
    const checkpoint = createCheckpointMessage(task)

    expect(checkpoint.payload.step_index).toBe(2)
    expect(checkpoint.payload.plan_goal).toBe('Build feature X')
  })
})

describe('dispatchToAgent with supervision', () => {
  const supervisedAgents = {
    coder: { mode: 'subagent' as const, supervised: true },
    researcher: { mode: 'subagent' as const, supervised: false },
  }

  test('returns checkpoint for supervised agent without approved_remaining', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({}),
      agents: supervisedAgents,
      validationConfig: DEFAULT_VALIDATION_CONFIG,
    }

    const result = await dispatchToAgent(createTaskMessage({ agent_id: 'coder' }), ctx)
    const parsed = JSON.parse(result)

    expect(parsed.type).toBe('checkpoint')
    expect(parsed.payload.agent_id).toBe('coder')
    expect(parsed.payload.prompt).toBe('Write a function')
  })

  test('proceeds with dispatch when approved_remaining is true', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({ promptResponse: 'Done' }),
      agents: supervisedAgents,
      validationConfig: { maxRetries: 2, wrapPlainText: true },
    }

    const result = await dispatchToAgent(
      createTaskMessage({
        agent_id: 'coder',
        plan_context: { goal: 'Test', step_index: 0, approved_remaining: true },
      }),
      ctx,
    )
    const parsed = JSON.parse(result)

    // Should proceed to dispatch and return result, not checkpoint
    expect(parsed.type).toBe('result')
    expect(parsed.payload.content).toBe('Done')
  })

  test('proceeds with dispatch for non-supervised agent', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({ promptResponse: 'Research complete' }),
      agents: supervisedAgents,
      validationConfig: { maxRetries: 2, wrapPlainText: true },
    }

    const result = await dispatchToAgent(createTaskMessage({ agent_id: 'researcher' }), ctx)
    const parsed = JSON.parse(result)

    expect(parsed.type).toBe('result')
    expect(parsed.payload.content).toBe('Research complete')
  })

  test('uses defaultSupervised from settings', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({}),
      agents: { coder: { mode: 'subagent' as const } }, // No explicit supervised flag
      validationConfig: DEFAULT_VALIDATION_CONFIG,
      settings: { defaultSupervised: true },
    }

    const result = await dispatchToAgent(createTaskMessage({ agent_id: 'coder' }), ctx)
    const parsed = JSON.parse(result)

    expect(parsed.type).toBe('checkpoint')
  })
})
