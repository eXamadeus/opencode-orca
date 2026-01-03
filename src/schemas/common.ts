import { z } from 'zod'

/**
 * Session ID - UUID format string
 */
export const SessionIdSchema = z.string().uuid()
export type SessionId = z.infer<typeof SessionIdSchema>

/**
 * Timestamp - ISO 8601 datetime string
 */
export const TimestampSchema = z.string().datetime()
export type Timestamp = z.infer<typeof TimestampSchema>

/**
 * Agent ID - non-empty string identifier for agents
 */
export const AgentIdSchema = z.string().min(1)
export type AgentId = z.infer<typeof AgentIdSchema>

/**
 * Base envelope fields shared by all messages
 */
export const BaseEnvelopeSchema = z.strictObject({
  session_id: SessionIdSchema,
  timestamp: TimestampSchema,
})

export type BaseEnvelope = z.infer<typeof BaseEnvelopeSchema>
