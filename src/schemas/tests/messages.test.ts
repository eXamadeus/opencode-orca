import { describe, expect, test } from 'bun:test'
import { MessageEnvelopeSchema } from '../messages'

// Request messages require session_id
const requestEnvelope = {
  session_id: '550e8400-e29b-41d4-a716-446655440000',
  timestamp: '2024-01-15T10:30:00Z',
}

// Response messages do not require session_id
const responseEnvelope = {
  timestamp: '2024-01-15T10:30:00Z',
}

describe('MessageEnvelopeSchema discriminated union', () => {
  test('rejects unknown message type', () => {
    expect(() =>
      MessageEnvelopeSchema.parse({
        ...requestEnvelope,
        type: 'unknown_type',
        payload: {},
      }),
    ).toThrow()
  })

  test('rejects mismatched payload for type', () => {
    // Task type expects { agent_id, prompt }, not { content }
    expect(() =>
      MessageEnvelopeSchema.parse({
        ...requestEnvelope,
        type: 'task',
        payload: { content: 'wrong payload shape' },
      }),
    ).toThrow()
  })

  test('rejects extra fields on envelope (strict mode propagates)', () => {
    expect(() =>
      MessageEnvelopeSchema.parse({
        ...requestEnvelope,
        type: 'task',
        payload: { agent_id: 'a', prompt: 'p' },
        extra: 'field',
      }),
    ).toThrow()
  })

  test('enables type narrowing after parse', () => {
    const msg = MessageEnvelopeSchema.parse({
      ...requestEnvelope,
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

  test('accepts checkpoint message type (response envelope - no session_id)', () => {
    const msg = MessageEnvelopeSchema.parse({
      ...responseEnvelope,
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
      ...responseEnvelope,
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

describe('Response messages (no session_id)', () => {
  test('accepts answer message without session_id', () => {
    const msg = MessageEnvelopeSchema.parse({
      ...responseEnvelope,
      type: 'answer',
      payload: { agent_id: 'researcher', content: 'Found it' },
    })

    expect(msg.type).toBe('answer')
  })

  test('accepts answer message with sources and annotations', () => {
    const msg = MessageEnvelopeSchema.parse({
      ...responseEnvelope,
      type: 'answer',
      payload: {
        agent_id: 'researcher',
        content: 'Found the implementation',
        sources: [{ type: 'file', ref: 'src/index.ts', excerpt: 'lines 1-10' }],
        annotations: [{ type: 'note', content: 'This is well-documented' }],
      },
    })

    expect(msg.type).toBe('answer')
    if (msg.type === 'answer') {
      expect(msg.payload.sources).toHaveLength(1)
      expect(msg.payload.annotations).toHaveLength(1)
    }
  })

  test('accepts plan message without session_id', () => {
    const msg = MessageEnvelopeSchema.parse({
      ...responseEnvelope,
      type: 'plan',
      payload: {
        agent_id: 'strategist',
        goal: 'Implement feature',
        steps: [{ description: 'Write code' }],
      },
    })

    expect(msg.type).toBe('plan')
  })

  test('accepts question message without session_id', () => {
    const msg = MessageEnvelopeSchema.parse({
      ...responseEnvelope,
      type: 'question',
      payload: {
        agent_id: 'coder',
        question: 'Which approach?',
        blocking: true,
      },
    })

    expect(msg.type).toBe('question')
  })

  test('accepts escalation message without session_id', () => {
    const msg = MessageEnvelopeSchema.parse({
      ...responseEnvelope,
      type: 'escalation',
      payload: {
        agent_id: 'strategist',
        decision_id: 'arch-choice',
        decision: 'Choose architecture',
        options: [{ label: 'Option A', value: 'a' }],
        context: 'Need human input',
      },
    })

    expect(msg.type).toBe('escalation')
  })

  test('accepts failure message without session_id', () => {
    const msg = MessageEnvelopeSchema.parse({
      ...responseEnvelope,
      type: 'failure',
      payload: {
        code: 'AGENT_ERROR',
        message: 'Something went wrong',
      },
    })

    expect(msg.type).toBe('failure')
  })
})

describe('Request messages (require session_id)', () => {
  test('accepts task message with session_id', () => {
    const msg = MessageEnvelopeSchema.parse({
      ...requestEnvelope,
      type: 'task',
      payload: { agent_id: 'coder', prompt: 'Write code' },
    })

    expect(msg.type).toBe('task')
    if (msg.type === 'task') {
      expect(msg.session_id).toBe(requestEnvelope.session_id)
    }
  })

  test('accepts user_input message with session_id', () => {
    const msg = MessageEnvelopeSchema.parse({
      ...requestEnvelope,
      type: 'user_input',
      payload: { content: 'User says hello' },
    })

    expect(msg.type).toBe('user_input')
  })

  test('accepts interrupt message with session_id', () => {
    const msg = MessageEnvelopeSchema.parse({
      ...requestEnvelope,
      type: 'interrupt',
      payload: { reason: 'User cancelled' },
    })

    expect(msg.type).toBe('interrupt')
  })

  test('rejects task message without session_id', () => {
    expect(() =>
      MessageEnvelopeSchema.parse({
        ...responseEnvelope, // Missing session_id
        type: 'task',
        payload: { agent_id: 'coder', prompt: 'Write code' },
      }),
    ).toThrow()
  })
})
