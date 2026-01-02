import * as z from 'zod'
import { MessageEnvelopeSchema } from './messages'

/**
 * Generate JSON Schema from the MessageEnvelopeSchema
 * Used to create accurate protocol documentation
 */
export function generateMessageJsonSchema(): object {
  return z.toJSONSchema(MessageEnvelopeSchema, {
    target: 'draft-2020-12',
  })
}

/**
 * Generate compact protocol documentation for agent injection
 * Returns a formatted string describing the message types and structure
 */
export function generateProtocolDocumentation(): string {
  const schema = generateMessageJsonSchema()
  return JSON.stringify(schema, null, 2)
}
