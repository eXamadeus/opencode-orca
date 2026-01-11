import { z } from 'zod'

export const ErrorCode = z.enum([
  'VALIDATION_ERROR',
  'UNKNOWN_AGENT',
  'SESSION_NOT_FOUND',
  'AGENT_ERROR',
  'TIMEOUT',
])
export type ErrorCode = z.infer<typeof ErrorCode>
