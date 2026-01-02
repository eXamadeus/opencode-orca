import { describe, expect, test } from 'bun:test'
import { ErrorCode } from '../schemas/errors'
import type { ResultMessage } from '../schemas/messages'
import {
  createFailureMessage,
  formatZodErrors,
  validateMessage,
  validateWithRetry,
  wrapAsResultMessage,
} from './validation'

describe('validation', () => {
  describe('validateMessage', () => {
    test('parses valid JSON message envelope', () => {
      const validMessage = {
        type: 'result',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: '2024-01-01T00:00:00.000Z',
        payload: {
          agent_id: 'coder',
          content: 'Task completed successfully',
        },
      }

      const result = validateMessage(JSON.stringify(validMessage))

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.message.type).toBe('result')
      }
    })

    test('returns error for invalid JSON', () => {
      const result = validateMessage('not valid json {{{')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('not valid JSON')
        expect(result.retryable).toBe(true)
      }
    })

    test('returns error for invalid schema', () => {
      const invalidMessage = {
        type: 'result',
        // missing session_id, timestamp, payload
      }

      const result = validateMessage(JSON.stringify(invalidMessage))

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.retryable).toBe(true)
      }
    })
  })

  describe('wrapAsResultMessage', () => {
    test('wraps plain text as ResultMessage envelope', () => {
      const text = 'Here is my response'
      const agentId = 'researcher'

      const result = wrapAsResultMessage(text, agentId)

      expect(result.type).toBe('result')
      expect(result.payload.agent_id).toBe(agentId)
      expect(result.payload.content).toBe(text)
      expect(result.session_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('createFailureMessage', () => {
    test('creates failure envelope with all fields', () => {
      const result = createFailureMessage(
        ErrorCode.VALIDATION_ERROR,
        'Something went wrong',
        'Detailed cause',
      )

      expect(result.type).toBe('failure')
      expect(result.payload.code).toBe('VALIDATION_ERROR')
      expect(result.payload.message).toBe('Something went wrong')
      expect(result.payload.cause).toBe('Detailed cause')
    })

    test('creates failure envelope without cause', () => {
      const result = createFailureMessage(ErrorCode.TIMEOUT, 'Request timed out')

      expect(result.type).toBe('failure')
      expect(result.payload.code).toBe('TIMEOUT')
      expect(result.payload.message).toBe('Request timed out')
      expect(result.payload.cause).toBeUndefined()
    })
  })

  describe('formatZodErrors', () => {
    test('formats Zod errors into readable message', async () => {
      // Create a Zod error by parsing invalid data
      const { z } = await import('zod')
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })

      const result = schema.safeParse({ name: 123, age: 'not a number' })
      if (result.success) throw new Error('Expected parse to fail')

      const formatted = formatZodErrors(result.error)

      expect(formatted).toContain('Message validation failed')
      expect(formatted).toContain('name:')
      expect(formatted).toContain('age:')
    })
  })

  describe('validateWithRetry', () => {
    test('returns valid message on first attempt', async () => {
      const validMessage: ResultMessage = {
        type: 'result',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: '2024-01-01T00:00:00.000Z',
        payload: {
          agent_id: 'coder',
          content: 'Done',
        },
      }

      const result = await validateWithRetry(JSON.stringify(validMessage), 'coder')

      expect(result.type).toBe('result')
    })

    test('wraps plain text when wrapPlainText is enabled', async () => {
      const plainText = 'Just a simple response'

      const result = await validateWithRetry(plainText, 'researcher', {
        maxRetries: 2,
        wrapPlainText: true,
      })

      expect(result.type).toBe('result')
      if (result.type === 'result') {
        expect(result.payload.content).toBe(plainText)
        expect(result.payload.agent_id).toBe('researcher')
      }
    })

    test('does not wrap plain text when wrapPlainText is disabled', async () => {
      const plainText = 'Just a simple response'

      const result = await validateWithRetry(plainText, 'researcher', {
        maxRetries: 0,
        wrapPlainText: false,
      })

      expect(result.type).toBe('failure')
    })

    test('retries on invalid JSON and succeeds on correction', async () => {
      let attempts = 0
      const validMessage: ResultMessage = {
        type: 'result',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: '2024-01-01T00:00:00.000Z',
        payload: {
          agent_id: 'coder',
          content: 'Corrected response',
        },
      }

      const retrySender = async (_correction: string): Promise<string> => {
        attempts++
        return JSON.stringify(validMessage)
      }

      const result = await validateWithRetry(
        '{ invalid json',
        'coder',
        { maxRetries: 2, wrapPlainText: false },
        retrySender,
      )

      expect(attempts).toBe(1)
      expect(result.type).toBe('result')
    })

    test('returns failure after maxRetries exhausted', async () => {
      let attempts = 0

      const retrySender = async (_correction: string): Promise<string> => {
        attempts++
        return '{ still invalid'
      }

      const result = await validateWithRetry(
        '{ invalid json',
        'coder',
        { maxRetries: 2, wrapPlainText: false },
        retrySender,
      )

      expect(attempts).toBe(2)
      expect(result.type).toBe('failure')
      if (result.type === 'failure') {
        expect(result.payload.code).toBe('VALIDATION_ERROR')
      }
    })

    test('returns failure immediately without retrySender', async () => {
      const result = await validateWithRetry('{ invalid json', 'coder', {
        maxRetries: 2,
        wrapPlainText: false,
      })

      expect(result.type).toBe('failure')
    })
  })
})
