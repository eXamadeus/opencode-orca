import { describe, expect, test } from 'bun:test'
import { generateMessageJsonSchema, generateProtocolDocumentation } from './jsonschema'

describe('generateMessageJsonSchema', () => {
  test('generates valid JSON Schema', () => {
    const schema = generateMessageJsonSchema() as Record<string, unknown>

    expect(schema).toHaveProperty('$schema')
    expect(schema).toHaveProperty('anyOf') // discriminatedUnion becomes anyOf
  })

  test('includes all message types', () => {
    const schema = generateMessageJsonSchema() as {
      anyOf: Array<{ properties: { type: { const: string } } }>
    }

    const types = schema.anyOf.map((opt) => opt.properties?.type?.const).filter(Boolean)

    expect(types).toContain('task')
    expect(types).toContain('result')
    expect(types).toContain('plan')
    expect(types).toContain('answer')
    expect(types).toContain('question')
    expect(types).toContain('escalation')
    expect(types).toContain('user_input')
    expect(types).toContain('interrupt')
    expect(types).toContain('failure')
  })

  test('schema includes required base envelope fields', () => {
    const schema = generateMessageJsonSchema() as {
      anyOf: Array<{ properties: Record<string, unknown>; required: string[] }>
    }

    // Check the first message type for base envelope fields
    const firstType = schema.anyOf[0]
    expect(firstType.properties).toHaveProperty('session_id')
    expect(firstType.properties).toHaveProperty('timestamp')
    expect(firstType.properties).toHaveProperty('type')
    expect(firstType.properties).toHaveProperty('payload')
    expect(firstType.required).toContain('session_id')
    expect(firstType.required).toContain('timestamp')
    expect(firstType.required).toContain('type')
    expect(firstType.required).toContain('payload')
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
