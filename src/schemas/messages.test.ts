import { describe, expect, test } from 'bun:test'
import { MessageEnvelopeSchema } from './messages'

const baseEnvelope = {
  session_id: '550e8400-e29b-41d4-a716-446655440000',
  timestamp: '2024-01-15T10:30:00Z',
}

describe('MessageEnvelopeSchema discriminated union', () => {
  test('rejects unknown message type', () => {
    expect(() =>
      MessageEnvelopeSchema.parse({
        ...baseEnvelope,
        type: 'unknown_type',
        payload: {},
      }),
    ).toThrow()
  })

  test('rejects mismatched payload for type', () => {
    // Task type expects { agent_id, prompt }, not { content }
    expect(() =>
      MessageEnvelopeSchema.parse({
        ...baseEnvelope,
        type: 'task',
        payload: { content: 'wrong payload shape' },
      }),
    ).toThrow()
  })

  test('rejects extra fields on envelope (strict mode propagates)', () => {
    expect(() =>
      MessageEnvelopeSchema.parse({
        ...baseEnvelope,
        type: 'task',
        payload: { agent_id: 'a', prompt: 'p' },
        extra: 'field',
      }),
    ).toThrow()
  })

  test('enables type narrowing after parse', () => {
    const msg = MessageEnvelopeSchema.parse({
      ...baseEnvelope,
      type: 'task',
      payload: { agent_id: 'researcher', prompt: 'find it' },
    })

    // TypeScript should narrow type after discriminator check
    if (msg.type === 'task') {
      // This compiles only if TS correctly infers payload shape
      const agentId: string = msg.payload.agent_id
      expect(agentId).toBe('researcher')
    } else {
      throw new Error('Type narrowing failed')
    }
  })

  test('accepts checkpoint message type', () => {
    const msg = MessageEnvelopeSchema.parse({
      ...baseEnvelope,
      type: 'checkpoint',
      payload: { agent_id: 'coder', prompt: 'Write tests' },
    })

    expect(msg.type).toBe('checkpoint')
    if (msg.type === 'checkpoint') {
      expect(msg.payload.agent_id).toBe('coder')
      expect(msg.payload.prompt).toBe('Write tests')
    }
  })

  test('accepts checkpoint message with optional fields', () => {
    const msg = MessageEnvelopeSchema.parse({
      ...baseEnvelope,
      type: 'checkpoint',
      payload: {
        agent_id: 'coder',
        prompt: 'Write tests',
        step_index: 2,
        plan_goal: 'Implement feature',
      },
    })

    expect(msg.type).toBe('checkpoint')
    if (msg.type === 'checkpoint') {
      expect(msg.payload.step_index).toBe(2)
      expect(msg.payload.plan_goal).toBe('Implement feature')
    }
  })
})
