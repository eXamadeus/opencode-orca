import type { ZodError } from 'zod'
import type { AgentId } from '../schemas/common'
import type { ErrorCode } from '../schemas/errors'
import { type AnswerMessage, type FailureMessage, MessageEnvelope } from '../schemas/messages'
import type { ValidationConfig } from './types'
import { DEFAULT_VALIDATION_CONFIG } from './types'

export type ValidationResult =
  | { success: true; message: MessageEnvelope }
  | { success: false; error: string; retryable: boolean }

function nowTimestamp(): string {
  return new Date().toISOString()
}

export function formatZodErrors(error: ZodError): string {
  const issues = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
      return `- ${path}: ${issue.message}`
    })
    .join('\n')

  return `Message validation failed:\n${issues}\n\nPlease correct the message format and try again.`
}

export function wrapAsAnswerMessage(content: string, agentId: string): AnswerMessage {
  return {
    type: 'answer',
    timestamp: nowTimestamp(),
    agent_id: agentId,
    content,
  }
}

export function createFailureMessage(
  code: ErrorCode,
  message: string,
  cause?: string,
): FailureMessage {
  return {
    type: 'failure',
    timestamp: nowTimestamp(),
    code,
    message,
    cause,
  }
}

export function validateMessage(raw: string): ValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      success: false,
      error: 'Response is not valid JSON. Please respond with a valid JSON message envelope.',
      retryable: true,
    }
  }

  const result = MessageEnvelope.safeParse(parsed)
  if (result.success) {
    return { success: true, message: result.data }
  }

  return {
    success: false,
    error: formatZodErrors(result.error),
    retryable: true,
  }
}

function isPlainText(raw: string): boolean {
  const trimmed = raw.trim()
  // JSON must start with { or [
  return !trimmed.startsWith('{') && !trimmed.startsWith('[')
}

/**
 * Validate a response with retry logic and optional plain text wrapping
 *
 * @param raw - Raw response string from agent
 * @param agentId - ID of the agent that produced the response
 * @param config - Validation configuration
 * @param retrySender - Optional callback to request a corrected response
 * @returns Validated MessageEnvelope or FailureMessage after retries exhausted
 */
export async function validateWithRetry(
  raw: string,
  agentId: string,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG,
  retrySender?: (correctionPrompt: string) => Promise<string>,
): Promise<MessageEnvelope> {
  let currentRaw = raw
  let attempts = 0

  while (attempts <= config.maxRetries) {
    // Check for plain text wrapping
    if (config.wrapPlainText && isPlainText(currentRaw)) {
      return wrapAsAnswerMessage(currentRaw, agentId)
    }

    const result = validateMessage(currentRaw)

    if (result.success) {
      return result.message
    }

    // Can't retry without a sender, or exhausted retries
    if (!retrySender || attempts >= config.maxRetries) {
      return createFailureMessage(
        'VALIDATION_ERROR',
        `Message validation failed after ${attempts + 1} attempt(s)`,
        result.error,
      )
    }

    // Request correction
    attempts++
    currentRaw = await retrySender(result.error)
  }

  // Should not reach here, but safety fallback
  return createFailureMessage(
    'VALIDATION_ERROR',
    'Message validation failed',
    'Exceeded maximum retry attempts',
  )
}
