import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { Message, type MessageType } from '../../schemas/messages'
import { DEFAULT_AGENTS } from '../agents'
import {
  RESPONSE_EXAMPLES,
  TYPE_GUIDANCE,
  generateResponseFormatInstructions,
} from '../response-format'

describe('createResponseExamples', () => {
  const messageTypes = ['answer', 'plan', 'question', 'failure'] as const satisfies MessageType[]

  test.each(messageTypes)('%s example validates against DispatchMessage', (type) => {
    const result = Message.safeParse(RESPONSE_EXAMPLES[type])

    if (!result.success) {
      console.error(`Validation errors for ${type}:`, z.treeifyError(result.error))
    }
    expect(result.success).toBe(true)
  })

  test('no examples contain session_id', () => {
    for (const [type, example] of Object.entries(RESPONSE_EXAMPLES)) {
      const json = JSON.stringify(example)
      expect(json).not.toContain('session_id')
    }
  })
})

describe('TYPE_GUIDANCE', () => {
  test('has guidance for all message types', () => {
    for (const messageType of Message.options) {
      const type = messageType.shape.type.value
      expect(TYPE_GUIDANCE[type]).toBeDefined()
      expect(TYPE_GUIDANCE[type].length).toBeGreaterThan(10)
    }
  })
})

describe('generateResponseFormatInstructions', () => {
  test('returns empty string for orca', () => {
    const result = generateResponseFormatInstructions('orca', {})
    expect(result).toBe('')
  })

  test.each(Object.keys(DEFAULT_AGENTS))(
    'generates correct format instructions for %s response type',
    (agentId) => {
      const agentConfig = DEFAULT_AGENTS[agentId]
      const result = generateResponseFormatInstructions(agentId, agentConfig)
      expect(result).toMatchSnapshot()
    },
  )
})
