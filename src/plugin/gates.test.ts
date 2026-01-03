import { describe, expect, test } from 'bun:test'
import type { ResultMessage, TaskMessage } from '../schemas/messages'
import type { ActionClassification, GateDecision } from './autonomy'
import type { AutonomyLevel } from './config'
import { enforcePreDispatchGate, type GateContext, transformResponse } from './gates'

/**
 * Create a valid TaskMessage for testing
 */
function createTaskMessage(agentId: string, prompt: string): TaskMessage {
  return {
    type: 'task',
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    timestamp: '2024-01-01T00:00:00.000Z',
    payload: {
      agent_id: agentId,
      prompt,
    },
  }
}

/**
 * Create a gate context for testing
 */
function createGateContext(
  overrides: Partial<{
    agentId: string
    prompt: string
    autonomyLevel: AutonomyLevel
    classification: ActionClassification
    decision: GateDecision
  }> = {},
): GateContext {
  const task = createTaskMessage(overrides.agentId ?? 'coder', overrides.prompt ?? 'Do something')

  return {
    task,
    autonomyLevel: overrides.autonomyLevel ?? 'supervised',
    classification: overrides.classification ?? 'routine',
    decision: overrides.decision ?? 'proceed',
  }
}

describe('enforcePreDispatchGate', () => {
  describe('proceed decision', () => {
    test('allows dispatch when decision is proceed', () => {
      const ctx = createGateContext({ decision: 'proceed' })
      const result = enforcePreDispatchGate(ctx)

      expect(result.allowed).toBe(true)
    })
  })

  describe('require_approval decision', () => {
    test('returns escalation message when approval required', () => {
      const ctx = createGateContext({
        agentId: 'coder',
        prompt: 'Write some code',
        autonomyLevel: 'supervised',
        classification: 'significant',
        decision: 'require_approval',
      })

      const result = enforcePreDispatchGate(ctx)

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.response.type).toBe('escalation')
        if (result.response.type === 'escalation') {
          expect(result.response.payload.agent_id).toBe('orca')
          expect(result.response.payload.decision).toContain('significant')
          expect(result.response.payload.decision).toContain('coder')
          expect(result.response.payload.options).toHaveLength(3)
          expect(result.response.payload.options[0].value).toBe('approve')
          expect(result.response.payload.options[1].value).toBe('reject')
          expect(result.response.payload.options[2].value).toBe('approve_all')
          expect(result.response.payload.context).toContain('Write some code')
        }
      }
    })

    test('escalation includes autonomy level in context', () => {
      const ctx = createGateContext({
        autonomyLevel: 'assisted',
        decision: 'require_approval',
      })

      const result = enforcePreDispatchGate(ctx)

      expect(result.allowed).toBe(false)
      if (!result.allowed && result.response.type === 'escalation') {
        expect(result.response.payload.context).toContain('assisted')
      }
    })

    test('escalation decision_id includes session_id', () => {
      const ctx = createGateContext({ decision: 'require_approval' })
      const result = enforcePreDispatchGate(ctx)

      expect(result.allowed).toBe(false)
      if (!result.allowed && result.response.type === 'escalation') {
        expect(result.response.payload.decision_id).toContain(ctx.task.session_id)
      }
    })
  })

  describe('block decision', () => {
    test('returns failure message when blocked', () => {
      const ctx = createGateContext({
        agentId: 'coder',
        autonomyLevel: 'supervised',
        classification: 'dangerous',
        decision: 'block',
      })

      const result = enforcePreDispatchGate(ctx)

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.response.type).toBe('failure')
        if (result.response.type === 'failure') {
          expect(result.response.payload.code).toBe('AUTONOMY_BLOCKED')
          expect(result.response.payload.message).toContain('dangerous')
          expect(result.response.payload.message).toContain('supervised')
          expect(result.response.payload.cause).toContain('coder')
        }
      }
    })

    test('failure includes agent_id in payload', () => {
      const ctx = createGateContext({
        agentId: 'tester',
        decision: 'block',
      })

      const result = enforcePreDispatchGate(ctx)

      expect(result.allowed).toBe(false)
      if (!result.allowed && result.response.type === 'failure') {
        expect(result.response.payload.agent_id).toBe('tester')
      }
    })
  })

  describe('unknown decision', () => {
    test('defaults to require_approval for unknown decision', () => {
      const ctx = createGateContext({
        decision: 'unknown' as GateDecision,
      })

      const result = enforcePreDispatchGate(ctx)

      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.response.type).toBe('escalation')
      }
    })
  })
})

describe('transformResponse', () => {
  const createResultMessage = (): ResultMessage => ({
    type: 'result',
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    timestamp: '2024-01-01T00:00:00.000Z',
    payload: {
      agent_id: 'coder',
      content: 'Task completed',
    },
  })

  test('passes through response unchanged in current implementation', () => {
    const response = createResultMessage()

    const transformed = transformResponse(response, 'supervised', 'significant')

    expect(transformed).toEqual(response)
  })

  test('passes through for all autonomy levels', () => {
    const response = createResultMessage()

    expect(transformResponse(response, 'supervised', 'routine')).toEqual(response)
    expect(transformResponse(response, 'assisted', 'routine')).toEqual(response)
    expect(transformResponse(response, 'autonomous', 'routine')).toEqual(response)
  })

  test('passes through for all classifications', () => {
    const response = createResultMessage()

    expect(transformResponse(response, 'supervised', 'routine')).toEqual(response)
    expect(transformResponse(response, 'supervised', 'significant')).toEqual(response)
    expect(transformResponse(response, 'supervised', 'dangerous')).toEqual(response)
  })
})
