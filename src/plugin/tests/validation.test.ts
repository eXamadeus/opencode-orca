import { describe, expect, test } from 'bun:test'
import type { AnswerMessage } from '../../schemas/messages'
import {
  createFailureMessage,
  formatZodErrors,
  validateMessage,
  validateWithRetry,
  wrapAsAnswerMessage,
} from '../validation'

describe('validation', () => {
  const agentId = 'researcher'

  describe('validateMessage', () => {
    test('parses valid JSON message envelope', () => {
      const validMessage: AnswerMessage = {
        type: 'answer',
        content: 'Task completed successfully',
      }

      const result = validateMessage(JSON.stringify(validMessage))

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.message.type).toBe('answer')
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
        type: 'answer',
        // missing timestamp, content
      }

      const result = validateMessage(JSON.stringify(invalidMessage))

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.retryable).toBe(true)
      }
    })
  })

  describe('wrapAsAnswerMessage', () => {
    test('wraps plain text as AnswerMessage envelope', () => {
      const text = 'Here is my response'
      const result = wrapAsAnswerMessage(text)

      expect(result.type).toBe('answer')
      expect(result.content).toBe(text)
      // Response messages don't have session_id
      expect((result as Record<string, unknown>).session_id).toBeUndefined()
    })
  })

  describe('createFailureMessage', () => {
    test('creates failure envelope with all fields', () => {
      const result = createFailureMessage({
        code: 'VALIDATION_ERROR',
        message: 'Something went wrong',
        cause: 'Detailed cause',
      })

      expect(result.type).toBe('failure')
      expect(result.code).toBe('VALIDATION_ERROR')
      expect(result.message).toBe('Something went wrong')
      expect(result.cause).toBe('Detailed cause')
      // Response messages don't have session_id
      expect((result as Record<string, unknown>).session_id).toBeUndefined()
    })

    test('creates failure envelope without cause', () => {
      const result = createFailureMessage({
        code: 'TIMEOUT',
        message: 'Request timed out',
      })

      expect(result.type).toBe('failure')
      expect(result.code).toBe('TIMEOUT')
      expect(result.message).toBe('Request timed out')
      expect(result.cause).toBeUndefined()
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
      const validMessage: AnswerMessage = {
        type: 'answer',
        content: 'Done',
      }

      const result = await validateWithRetry(JSON.stringify(validMessage))

      expect(result.type).toBe('answer')
    })

    test('strips markdown code fence and parses JSON', async () => {
      const validMessage: AnswerMessage = {
        type: 'answer',
        content: 'Done',
      }

      const wrapped = `\`\`\`json\n${JSON.stringify(validMessage)}\n\`\`\``
      const result = await validateWithRetry(wrapped)

      expect(result.type).toBe('answer')
      if (result.type === 'answer') {
        expect(result.content).toBe('Done')
      }
    })

    test('strips markdown code fence without language specifier', async () => {
      const validMessage: AnswerMessage = {
        type: 'answer',
        content: 'Done',
      }

      const wrapped = `\`\`\`\n${JSON.stringify(validMessage)}\n\`\`\``
      const result = await validateWithRetry(wrapped)

      expect(result.type).toBe('answer')
    })

    test('wraps plain text when wrapPlainText is enabled', async () => {
      const plainText = 'Just a simple response'

      const result = await validateWithRetry(plainText, {
        maxRetries: 2,
        wrapPlainText: true,
      })

      expect(result.type).toBe('answer')
      if (result.type === 'answer') {
        expect(result.content).toBe(plainText)
      }
    })

    test('does not wrap plain text when wrapPlainText is disabled', async () => {
      const plainText = 'Just a simple response'

      const result = await validateWithRetry(plainText, {
        maxRetries: 0,
        wrapPlainText: false,
      })

      expect(result.type).toBe('failure')
    })

    test('retries on invalid JSON and succeeds on correction', async () => {
      let attempts = 0
      const validMessage: AnswerMessage = {
        type: 'answer',
        content: 'Corrected response',
      }

      const retrySender = async (_correction: string): Promise<string> => {
        attempts++
        return JSON.stringify(validMessage)
      }

      const result = await validateWithRetry(
        '{ invalid json',
        { maxRetries: 2, wrapPlainText: false },
        retrySender,
      )

      expect(attempts).toBe(1)
      expect(result.type).toBe('answer')
    })

    test('returns failure after maxRetries exhausted', async () => {
      let attempts = 0

      const retrySender = async (_correction: string): Promise<string> => {
        attempts++
        return '{ still invalid'
      }

      const result = await validateWithRetry(
        '{ invalid json',
        { maxRetries: 2, wrapPlainText: false },
        retrySender,
      )

      expect(attempts).toBe(2)
      expect(result.type).toBe('failure')
      if (result.type === 'failure') {
        expect(result.code).toBe('VALIDATION_ERROR')
      }
    })

    test('returns failure immediately without retrySender', async () => {
      const result = await validateWithRetry('{ invalid json', {
        maxRetries: 2,
        wrapPlainText: false,
      })

      expect(result.type).toBe('failure')
    })
  })
})
