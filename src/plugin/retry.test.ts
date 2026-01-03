import { describe, expect, mock, test } from 'bun:test'
import type { FailureMessage, ResultMessage } from '../schemas/messages'
import type { AutonomyLevel } from './config'
import { executeWithRetry, type RetryContext, shouldAutoRetry } from './retry'

/**
 * Create a failure message for testing
 */
function createFailure(code: string, message = 'Test failure'): FailureMessage {
  return {
    type: 'failure',
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    timestamp: '2024-01-01T00:00:00.000Z',
    payload: {
      code: code as FailureMessage['payload']['code'],
      message,
    },
  }
}

/**
 * Create a result message for testing
 */
function createResult(content = 'Success'): ResultMessage {
  return {
    type: 'result',
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    timestamp: '2024-01-01T00:00:00.000Z',
    payload: {
      agent_id: 'coder',
      content,
    },
  }
}

/**
 * Create a retry context for testing
 */
function createRetryContext(
  overrides: Partial<{
    errorCode: string
    autonomyLevel: AutonomyLevel
    attempts: number
    maxRetries: number
  }> = {},
): RetryContext {
  return {
    failure: createFailure(overrides.errorCode ?? 'AGENT_ERROR'),
    autonomyLevel: overrides.autonomyLevel ?? 'assisted',
    attempts: overrides.attempts ?? 0,
    maxRetries: overrides.maxRetries ?? 2,
  }
}

describe('shouldAutoRetry', () => {
  describe('max retries', () => {
    test('does not retry when max retries exceeded', () => {
      const ctx = createRetryContext({
        errorCode: 'AGENT_ERROR',
        autonomyLevel: 'assisted',
        attempts: 2,
        maxRetries: 2,
      })

      const result = shouldAutoRetry(ctx)

      expect(result.shouldRetry).toBe(false)
      expect(result.reason).toContain('Maximum retry attempts')
    })

    test('allows retry when under max retries', () => {
      const ctx = createRetryContext({
        errorCode: 'AGENT_ERROR',
        autonomyLevel: 'assisted',
        attempts: 1,
        maxRetries: 2,
      })

      const result = shouldAutoRetry(ctx)

      expect(result.shouldRetry).toBe(true)
    })
  })

  describe('non-retryable error codes', () => {
    const nonRetryableCodes = [
      'UNKNOWN_AGENT',
      'SESSION_NOT_FOUND',
      'AUTONOMY_BLOCKED',
      'APPROVAL_REQUIRED',
    ]

    for (const code of nonRetryableCodes) {
      test(`does not retry ${code} in assisted mode`, () => {
        const ctx = createRetryContext({
          errorCode: code,
          autonomyLevel: 'assisted',
        })

        const result = shouldAutoRetry(ctx)

        expect(result.shouldRetry).toBe(false)
        expect(result.reason).toContain('not retryable')
      })

      test(`does not retry ${code} in autonomous mode`, () => {
        const ctx = createRetryContext({
          errorCode: code,
          autonomyLevel: 'autonomous',
        })

        const result = shouldAutoRetry(ctx)

        expect(result.shouldRetry).toBe(false)
        expect(result.reason).toContain('not retryable')
      })
    }
  })

  describe('retryable error codes', () => {
    const retryableCodes = ['AGENT_ERROR', 'TIMEOUT', 'VALIDATION_ERROR']

    for (const code of retryableCodes) {
      test(`retries ${code} in assisted mode`, () => {
        const ctx = createRetryContext({
          errorCode: code,
          autonomyLevel: 'assisted',
        })

        const result = shouldAutoRetry(ctx)

        expect(result.shouldRetry).toBe(true)
        expect(result.reason).toContain('Auto-retrying')
      })

      test(`retries ${code} in autonomous mode`, () => {
        const ctx = createRetryContext({
          errorCode: code,
          autonomyLevel: 'autonomous',
        })

        const result = shouldAutoRetry(ctx)

        expect(result.shouldRetry).toBe(true)
        expect(result.reason).toContain('Auto-retrying')
      })
    }
  })

  describe('supervised mode', () => {
    test('never retries in supervised mode', () => {
      const ctx = createRetryContext({
        errorCode: 'AGENT_ERROR',
        autonomyLevel: 'supervised',
      })

      const result = shouldAutoRetry(ctx)

      expect(result.shouldRetry).toBe(false)
      expect(result.reason).toContain('Supervised mode')
    })

    test('never retries timeout in supervised mode', () => {
      const ctx = createRetryContext({
        errorCode: 'TIMEOUT',
        autonomyLevel: 'supervised',
      })

      const result = shouldAutoRetry(ctx)

      expect(result.shouldRetry).toBe(false)
      expect(result.reason).toContain('Supervised mode')
    })
  })

  describe('assisted mode', () => {
    test('retries retryable errors', () => {
      const ctx = createRetryContext({
        errorCode: 'AGENT_ERROR',
        autonomyLevel: 'assisted',
      })

      const result = shouldAutoRetry(ctx)

      expect(result.shouldRetry).toBe(true)
      expect(result.reason).toContain('assisted mode')
    })

    test('includes attempt count in reason', () => {
      const ctx = createRetryContext({
        errorCode: 'AGENT_ERROR',
        autonomyLevel: 'assisted',
        attempts: 1,
        maxRetries: 3,
      })

      const result = shouldAutoRetry(ctx)

      expect(result.reason).toContain('attempt 2/3')
    })
  })

  describe('autonomous mode', () => {
    test('retries retryable errors aggressively', () => {
      const ctx = createRetryContext({
        errorCode: 'TIMEOUT',
        autonomyLevel: 'autonomous',
      })

      const result = shouldAutoRetry(ctx)

      expect(result.shouldRetry).toBe(true)
      expect(result.reason).toContain('autonomous mode')
    })
  })
})

describe('executeWithRetry', () => {
  test('returns failure immediately if not retryable', async () => {
    const failure = createFailure('UNKNOWN_AGENT')
    const executor = mock(async () => createResult())

    const result = await executeWithRetry(failure, 'assisted', 2, executor)

    expect(result.type).toBe('failure')
    expect(executor).not.toHaveBeenCalled()
  })

  test('returns success on first retry attempt', async () => {
    const failure = createFailure('AGENT_ERROR')
    const executor = mock(async () => createResult('Retry succeeded'))

    const result = await executeWithRetry(failure, 'assisted', 2, executor)

    expect(result.type).toBe('result')
    if (result.type === 'result') {
      expect(result.payload.content).toBe('Retry succeeded')
    }
    expect(executor).toHaveBeenCalledTimes(1)
  })

  test('retries multiple times before success', async () => {
    const failure = createFailure('AGENT_ERROR')
    let callCount = 0

    const executor = mock(async () => {
      callCount++
      if (callCount < 2) {
        return createFailure('AGENT_ERROR', `Attempt ${callCount} failed`)
      }
      return createResult('Final success')
    })

    const result = await executeWithRetry(failure, 'assisted', 3, executor)

    expect(result.type).toBe('result')
    expect(executor).toHaveBeenCalledTimes(2)
  })

  test('returns last failure when max retries exhausted', async () => {
    const failure = createFailure('AGENT_ERROR')
    let callCount = 0

    const executor = mock(async () => {
      callCount++
      return createFailure('AGENT_ERROR', `Attempt ${callCount} failed`)
    })

    const result = await executeWithRetry(failure, 'assisted', 2, executor)

    expect(result.type).toBe('failure')
    if (result.type === 'failure') {
      expect(result.payload.message).toContain('Attempt 2')
    }
    expect(executor).toHaveBeenCalledTimes(2)
  })

  test('does not retry in supervised mode', async () => {
    const failure = createFailure('AGENT_ERROR')
    const executor = mock(async () => createResult())

    const result = await executeWithRetry(failure, 'supervised', 2, executor)

    expect(result.type).toBe('failure')
    expect(executor).not.toHaveBeenCalled()
  })

  test('retries in autonomous mode', async () => {
    const failure = createFailure('TIMEOUT')
    const executor = mock(async () => createResult('Recovered'))

    const result = await executeWithRetry(failure, 'autonomous', 2, executor)

    expect(result.type).toBe('result')
    expect(executor).toHaveBeenCalledTimes(1)
  })
})
