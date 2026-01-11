import { z } from 'zod'

export const AgentId = z.string().min(1).describe('Non-empty unique string identifier for agents')
export type AgentId = z.infer<typeof AgentId>

export const SessionId = z
  .string()
  .describe('OpenCode session_id for resuming communication with a previous session.')
export type SessionId = z.infer<typeof SessionId>
