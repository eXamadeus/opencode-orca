import { describe, expect, test } from 'bun:test'
import { generateMessageJsonSchema, generateProtocolDocumentation } from '../jsonschema'

describe('generateMessageJsonSchema', () => {
  test('generates valid JSON Schema', () => {
    const schema = generateMessageJsonSchema() as Record<string, unknown>

    expect(schema).toHaveProperty('$schema')
    expect(schema).toHaveProperty('oneOf') // discriminatedUnion becomes oneOf in Zod 4.x
  })

  test('includes all message types', () => {
    const schema = generateMessageJsonSchema() as {
      oneOf: Array<{ properties: { type: { const: string } } }>
    }

    const types = schema.oneOf.map((opt) => opt.properties?.type?.const).filter(Boolean)

    expect(types).toContain('task')
    expect(types).toContain('plan')
    expect(types).toContain('answer')
    expect(types).toContain('question')
    expect(types).toContain('escalation')
    expect(types).toContain('user_input')
    expect(types).toContain('interrupt')
    expect(types).toContain('failure')
    expect(types).toContain('checkpoint')
    // Note: 'result' type has been removed (collapsed into 'answer')
  })

  test('schema includes required envelope fields', () => {
    const schema = generateMessageJsonSchema() as {
      oneOf: Array<{ properties: Record<string, unknown>; required: string[] }>
    }

    // Find a request type (task) - has session_id
    const taskType = schema.oneOf.find(
      (opt) => (opt.properties?.type as { const: string })?.const === 'task',
    )
    expect(taskType?.properties).toHaveProperty('session_id')
    expect(taskType?.properties).toHaveProperty('timestamp')
    expect(taskType?.required).toContain('session_id')
    expect(taskType?.required).toContain('timestamp')

    // Find a response type (answer) - no session_id
    const answerType = schema.oneOf.find(
      (opt) => (opt.properties?.type as { const: string })?.const === 'answer',
    )
    expect(answerType?.properties).toHaveProperty('timestamp')
    expect(answerType?.properties).toHaveProperty('type')
    expect(answerType?.properties).toHaveProperty('payload')
    expect(answerType?.required).toContain('timestamp')
    expect(answerType?.required).not.toContain('session_id')
  })
})

describe('generateProtocolDocumentation', () => {
  test('returns valid JSON string', () => {
    const docs = generateProtocolDocumentation()

    expect(() => JSON.parse(docs)).not.toThrow()
  })

  test('includes schema draft version', () => {
    const docs = generateProtocolDocumentation()

    expect(docs).toContain('$schema')
    expect(docs).toContain('draft')
  })
})
