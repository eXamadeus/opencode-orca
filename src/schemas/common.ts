import { z } from 'zod'

/**
 * Session ID - UUID format string
 */
export const SessionIdSchema = z.uuid()
export type SessionId = z.infer<typeof SessionIdSchema>

/**
 * Timestamp - ISO 8601 datetime string
 */
export const TimestampSchema = z.iso.datetime()
export type Timestamp = z.infer<typeof TimestampSchema>

/**
 * Agent ID - non-empty string identifier for agents
 */
export const AgentIdSchema = z.string().min(1)
export type AgentId = z.infer<typeof AgentIdSchema>

/**
 * Base envelope fields for request messages (includes session_id)
 * Used by: task, user_input, interrupt
 */
export const BaseEnvelopeSchema = z.strictObject({
  session_id: SessionIdSchema,
  timestamp: TimestampSchema,
})

export type BaseEnvelope = z.infer<typeof BaseEnvelopeSchema>

/**
 * Response envelope fields (no session_id - Orca manages sessions externally)
 * Used by: answer, plan, question, escalation, failure, checkpoint
 */
export const ResponseEnvelopeSchema = z.strictObject({
  timestamp: TimestampSchema,
})

export type ResponseEnvelope = z.infer<typeof ResponseEnvelopeSchema>
