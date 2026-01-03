import { describe, expect, mock, test } from 'bun:test'
import type { OpencodeClient } from '@opencode-ai/sdk'
import type { TaskMessage } from '../schemas/messages'
import { DEFAULT_AUTONOMY_CONFIG } from './autonomy'
import { type DispatchContext, dispatchToAgent } from './dispatch'
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
function createTaskMessage(overrides?: Partial<TaskMessage['payload']>): string {
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

describe('dispatchToAgent', () => {
  const testAgents = {
    coder: { mode: 'subagent' as const, description: 'Codes things' },
    researcher: { mode: 'subagent' as const, description: 'Researches things' },
  }

  // Use autonomous mode for most tests to avoid gate interference
  const autonomousConfig = { ...DEFAULT_AUTONOMY_CONFIG, level: 'autonomous' as const }

  test('returns failure for invalid task message format', async () => {
    const ctx: DispatchContext = {
      client: createMockClient({}),
      agents: testAgents,
      validationConfig: DEFAULT_VALIDATION_CONFIG,
      autonomyConfig: autonomousConfig,
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
      autonomyConfig: autonomousConfig,
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
      autonomyConfig: autonomousConfig,
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
      autonomyConfig: autonomousConfig,
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
      autonomyConfig: autonomousConfig,
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
      autonomyConfig: autonomousConfig,
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
      autonomyConfig: autonomousConfig,
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
      autonomyConfig: autonomousConfig,
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
      autonomyConfig: autonomousConfig,
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
