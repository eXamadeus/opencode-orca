import { describe, expect, test } from 'bun:test'
import { MessageEnvelopeSchema } from '../../schemas/messages'
import type { ResponseType } from '../config'
import {
  RESPONSE_TYPE_EXAMPLES,
  TYPE_GUIDANCE,
  generateResponseFormatInstructions,
} from '../response-format'

describe('RESPONSE_TYPE_EXAMPLES', () => {
  const responseTypes: ResponseType[] = ['answer', 'plan', 'question', 'escalation', 'failure']

  test.each(responseTypes)('%s example is valid JSON', (type) => {
    const example = RESPONSE_TYPE_EXAMPLES[type]
    expect(() => JSON.parse(example.replace(/<agent_id>/g, 'test-agent'))).not.toThrow()
  })

  test.each(responseTypes)('%s example parses against MessageEnvelopeSchema', (type) => {
    const example = RESPONSE_TYPE_EXAMPLES[type].replace(/<agent_id>/g, 'test-agent')
    const parsed = JSON.parse(example)
    expect(() => MessageEnvelopeSchema.parse(parsed)).not.toThrow()
  })

  test('all examples use <agent_id> placeholder', () => {
    for (const [type, example] of Object.entries(RESPONSE_TYPE_EXAMPLES)) {
      expect(example).toContain('<agent_id>')
    }
  })

  test('no examples contain session_id', () => {
    for (const [type, example] of Object.entries(RESPONSE_TYPE_EXAMPLES)) {
      expect(example).not.toContain('session_id')
    }
  })
})

describe('TYPE_GUIDANCE', () => {
  test('has guidance for all response types', () => {
    const responseTypes: ResponseType[] = ['answer', 'plan', 'question', 'escalation', 'failure']
    for (const type of responseTypes) {
      expect(TYPE_GUIDANCE[type]).toBeDefined()
      expect(TYPE_GUIDANCE[type].length).toBeGreaterThan(10)
    }
  })
})

describe('generateResponseFormatInstructions', () => {
  test('returns empty string for empty responseTypes', () => {
    const result = generateResponseFormatInstructions('orca', [])
    expect(result).toBe('')
  })

  test('includes MUST respond directive', () => {
    const result = generateResponseFormatInstructions('coder', ['answer'])
    expect(result).toContain('MUST respond with a valid JSON message envelope')
  })

  test('includes only specified response types', () => {
    const result = generateResponseFormatInstructions('coder', ['answer', 'failure'])

    expect(result).toContain('"type": "answer"')
    expect(result).toContain('"type": "failure"')
    expect(result).not.toContain('"type": "plan"')
    expect(result).not.toContain('"type": "escalation"')
    expect(result).not.toContain('"type": "question"')
  })

  test('includes all types for strategist', () => {
    const types: ResponseType[] = ['plan', 'question', 'escalation', 'answer', 'failure']
    const result = generateResponseFormatInstructions('strategist', types)

    for (const type of types) {
      expect(result).toContain(`"type": "${type}"`)
    }
  })

  test('replaces agent_id placeholder', () => {
    const result = generateResponseFormatInstructions('my-agent', ['answer'])
    expect(result).toContain('"agent_id": "my-agent"')
    expect(result).not.toContain('<agent_id>')
  })

  test('includes type selection guidance', () => {
    const result = generateResponseFormatInstructions('strategist', ['plan', 'answer'])
    expect(result).toContain('Type Selection Guidance')
    expect(result).toContain('**plan**:')
    expect(result).toContain('**answer**:')
  })

  test('lists allowed response types', () => {
    const result = generateResponseFormatInstructions('coder', ['answer', 'failure'])
    expect(result).toContain('`answer`')
    expect(result).toContain('`failure`')
  })
})
