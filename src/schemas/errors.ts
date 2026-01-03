import { z } from 'zod'

/**
 * Error codes for agent communication failures
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_AGENT: 'UNKNOWN_AGENT',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  AGENT_ERROR: 'AGENT_ERROR',
  TIMEOUT: 'TIMEOUT',
  AUTONOMY_BLOCKED: 'AUTONOMY_BLOCKED',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
} as const

export const ErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'UNKNOWN_AGENT',
  'SESSION_NOT_FOUND',
  'AGENT_ERROR',
  'TIMEOUT',
  'AUTONOMY_BLOCKED',
  'APPROVAL_REQUIRED',
])

export type ErrorCode = z.infer<typeof ErrorCodeSchema>
