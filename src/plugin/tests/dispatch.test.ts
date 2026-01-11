import { describe, expect, mock, test } from 'bun:test'
import type { OpencodeClient } from '@opencode-ai/sdk'
import type {
  AnswerMessage,
  DispatchPayload,
  PlanContext,
  TaskMessage,
} from '../../schemas/messages'
import {
  type DispatchContext,
  createCheckpointMessage,
  dispatchToAgent,
  isAgentSupervised,
} from '../dispatch'
import { DEFAULT_VALIDATION_CONFIG } from '../types'

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

function createTaskDispatch(
  overrides?: Partial<Omit<TaskMessage, 'type' | 'session_id' | 'timestamp'>> & {
    plan_context?: PlanContext
    agent_id?: string
  },
) {
  const { agent_id = 'coder', ...rest } = overrides ?? {}

  return {
    agent_id,
    message: {
      type: 'task',
      prompt: 'Write a function',
      ...rest,
    } satisfies TaskMessage,
  } satisfies DispatchPayload
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

    const result = await dispatchToAgent(
      { agent_id: 'coder', message: 'not valid json' as unknown as TaskMessage },
      ctx,
    )
    const parsed = JSON.parse(result)

    // Early failure - no session_id
    expect(parsed.session_id).toBeUndefined()
    expect(parsed.message.type).toBe('failure')
    expect(parsed.message.code).toBe('VALIDATION_ERROR')
  })

  test('returns failure when session creation fails', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({ createSessionError: true }),
      agents: testAgents,
      validationConfig: DEFAULT_VALIDATION_CONFIG,
    }

    const result = await dispatchToAgent(createTaskDispatch(), ctx)
    const parsed = JSON.parse(result)

    // Session creation failed - no session_id
    expect(parsed.session_id).toBeUndefined()
    expect(parsed.message.type).toBe('failure')
    expect(parsed.message.code).toBe('SESSION_NOT_FOUND')
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

    const result = await dispatchToAgent(createTaskDispatch(), ctx)
    const parsed = JSON.parse(result)

    // Error after session creation - has session_id
    expect(parsed.session_id).toBe('test-session')
    expect(parsed.message.type).toBe('failure')
    expect(parsed.message.code).toBe('AGENT_ERROR')
    expect(parsed.message.message).toContain('empty response')
  })

  test('wraps plain text response as answer message', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({ promptResponse: 'Here is my plain text response' }),
      agents: testAgents,
      validationConfig: { maxRetries: 2, wrapPlainText: true },
    }

    const result = JSON.parse(await dispatchToAgent(createTaskDispatch(), ctx))

    expect(result.session_id).toBe('test-session-id')
    expect(result.message).toMatchInlineSnapshot(`
      {
        "content": "Here is my plain text response",
        "type": "answer",
      }
    `)
  })

  test('returns valid JSON response from agent', async () => {
    const validResponse = JSON.stringify({
      type: 'answer',
      content: 'Task completed',
    } satisfies AnswerMessage)

    const ctx: DispatchContext = {
      client: createMockClient({ promptResponse: validResponse }),
      agents: testAgents,
      validationConfig: { maxRetries: 2, wrapPlainText: false },
    }

    const result = JSON.parse(await dispatchToAgent(createTaskDispatch(), ctx))

    expect(result.session_id).toBe('test-session-id')
    expect(result.message).toMatchInlineSnapshot(`
      {
        "content": "Task completed",
        "type": "answer",
      }
    `)
  })

  test('returns failure when agent throws error', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({ promptError: new Error('Agent crashed') }),
      agents: testAgents,
      validationConfig: DEFAULT_VALIDATION_CONFIG,
    }

    const result = await dispatchToAgent(createTaskDispatch(), ctx)
    const parsed = JSON.parse(result)

    // Error during dispatch - no session_id (error thrown before we can track it)
    expect(parsed.message.type).toBe('failure')
    expect(parsed.message.code).toBe('AGENT_ERROR')
    expect(parsed.message.cause).toContain('Agent crashed')
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

    const result = await dispatchToAgent(createTaskDispatch(), ctx)
    const parsed = JSON.parse(result)

    // Timeout - no session_id in error response
    expect(parsed.message.type).toBe('failure')
    expect(parsed.message.code).toBe('TIMEOUT')
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
    const task = createTaskDispatch()
    const checkpoint = createCheckpointMessage(task.message)

    expect(checkpoint.type).toBe('checkpoint')
    // Checkpoint is a response message, so no session_id
    expect((checkpoint as Record<string, unknown>).session_id).toBeUndefined()
    expect(task.agent_id).toBe('coder')
    expect(checkpoint.prompt).toBe('Write a function')
    expect(checkpoint.step_index).toBeUndefined()
    expect(checkpoint.plan_goal).toBeUndefined()
  })

  test('includes plan context fields when present', () => {
    const task = createTaskDispatch({
      plan_context: {
        goal: 'Build feature X',
        step_index: 2,
        approved_remaining: false,
      },
    })
    const checkpoint = createCheckpointMessage(task.message)

    expect(checkpoint.step_index).toBe(2)
    expect(checkpoint.plan_goal).toBe('Build feature X')
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

    const result = await dispatchToAgent(createTaskDispatch({ agent_id: 'coder' }), ctx)
    const parsed = JSON.parse(result)

    // Checkpoint has session_id for resumption after approval
    expect(parsed.session_id).toBe('test-session-id')
    expect(parsed.message.type).toBe('checkpoint')
    expect(parsed.message.prompt).toBe('Write a function')
  })

  test('proceeds with dispatch when approved_remaining is true', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({ promptResponse: 'Done' }),
      agents: supervisedAgents,
      validationConfig: { maxRetries: 2, wrapPlainText: true },
    }

    const result = await dispatchToAgent(
      createTaskDispatch({
        plan_context: { goal: 'Test', step_index: 0, approved_remaining: true },
      }),
      ctx,
    )
    const parsed = JSON.parse(result)

    // Should proceed to dispatch and return answer, not checkpoint
    expect(parsed.session_id).toBe('test-session-id')
    expect(parsed.message.type).toBe('answer')
    expect(parsed.message.content).toBe('Done')
  })

  test('proceeds with dispatch for non-supervised agent', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({ promptResponse: 'Research complete' }),
      agents: supervisedAgents,
      validationConfig: { maxRetries: 2, wrapPlainText: true },
    }

    const result = await dispatchToAgent(createTaskDispatch({ agent_id: 'researcher' }), ctx)
    const parsed = JSON.parse(result)

    expect(parsed.session_id).toBe('test-session-id')
    expect(parsed.message.type).toBe('answer')
    expect(parsed.message.content).toBe('Research complete')
  })

  test('uses defaultSupervised from settings', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({}),
      agents: { coder: { mode: 'subagent' as const } }, // No explicit supervised flag
      validationConfig: DEFAULT_VALIDATION_CONFIG,
      settings: { defaultSupervised: true },
    }

    const result = await dispatchToAgent(createTaskDispatch({ agent_id: 'coder' }), ctx)
    const parsed = JSON.parse(result)

    expect(parsed.session_id).toBe('test-session-id')
    expect(parsed.message.type).toBe('checkpoint')
  })
})
