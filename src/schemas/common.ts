import { z } from 'zod'

export const AgentId = z.string().min(1).describe('Non-empty unique string identifier for agents')
export type AgentId = z.infer<typeof AgentId>

export const SessionId = z.uuid().describe('UUID format string')
export type SessionId = z.infer<typeof SessionId>

export const Timestamp = z.iso.datetime().describe('ISO 8601 datetime string')
export type Timestamp = z.infer<typeof Timestamp>

export const ResponseEnvelope = z.strictObject({ agent_id: AgentId, timestamp: Timestamp })
export type ResponseEnvelope = z.infer<typeof ResponseEnvelope>

export const RequestEnvelope = ResponseEnvelope.extend({ session_id: SessionId })
export type RequestEnvelope = z.infer<typeof RequestEnvelope>
