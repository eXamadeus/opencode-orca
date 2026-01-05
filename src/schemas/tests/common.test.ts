import { describe, expect, test } from 'bun:test'
import { AgentIdSchema, BaseEnvelopeSchema, SessionIdSchema, TimestampSchema } from '../common'

describe('common schemas', () => {
  test('SessionIdSchema rejects invalid UUID format', () => {
    expect(() => SessionIdSchema.parse('not-a-uuid')).toThrow()
  })

  test('TimestampSchema rejects non-UTC timezone offset', () => {
    // Verifies our choice: UTC-only timestamps (Z suffix required)
    expect(() => TimestampSchema.parse('2024-01-15T10:30:00+05:00')).toThrow()
  })

  test('AgentIdSchema rejects empty string', () => {
    expect(() => AgentIdSchema.parse('')).toThrow()
  })

  test('BaseEnvelopeSchema rejects extra fields (strict mode)', () => {
    expect(() =>
      BaseEnvelopeSchema.parse({
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: '2024-01-15T10:30:00Z',
        extra_field: 'not allowed',
      }),
    ).toThrow()
  })
})
