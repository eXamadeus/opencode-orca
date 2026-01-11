import type { ZodError } from 'zod'
import type { AgentId } from '../schemas/common'
import type { ErrorCode } from '../schemas/errors'
import { type AnswerMessage, type FailureMessage, Message } from '../schemas/messages'
import type { ValidationConfig } from './types'
import { DEFAULT_VALIDATION_CONFIG } from './types'

export type ValidationResult =
  | { success: true; message: Message }
  | { success: false; error: string; retryable: boolean }

export function formatZodErrors(error: ZodError): string {
  const issues = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
      return `- ${path}: ${issue.message}`
    })
    .join('\n')

  return `Message validation failed:\n${issues}\n\nPlease correct the message format and try again.`
}

export function wrapAsAnswerMessage(content: string): AnswerMessage {
  return {
    type: 'answer',
    content,
  }
}

export function createFailureMessage({
  code,
  message,
  cause,
}: {
  code: ErrorCode
  message: string
  cause?: string
}): FailureMessage {
  return {
    type: 'failure',
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

  const result = Message.safeParse(parsed)
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

function stripMarkdownCodeFence(raw: string): string {
  const trimmed = raw.trim()
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i)
  return match ? match[1].trim() : trimmed
}

/**
 * Validate a response with retry logic and optional plain text wrapping
 *
 * @param raw - Raw response string from agent
 * @param config - Validation configuration
 * @param retrySender - Optional callback to request a corrected response
 * @returns Validated DispatchMessage or FailureMessage after retries exhausted
 */
export async function validateWithRetry(
  raw: string,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG,
  retrySender?: (correctionPrompt: string) => Promise<string>,
): Promise<Message> {
  let currentRaw = stripMarkdownCodeFence(raw)
  let attempts = 0

  while (attempts <= config.maxRetries) {
    // Check for plain text wrapping
    if (config.wrapPlainText && isPlainText(currentRaw)) {
      return wrapAsAnswerMessage(currentRaw)
    }

    const result = validateMessage(currentRaw)

    if (result.success) {
      return result.message
    }

    // Can't retry without a sender, or exhausted retries
    if (!retrySender || attempts >= config.maxRetries) {
      return createFailureMessage({
        code: 'VALIDATION_ERROR',
        message: `Message validation failed after ${attempts + 1} attempt(s)`,
        cause: result.error,
      })
    }

    // Request correction
    attempts++
    currentRaw = stripMarkdownCodeFence(await retrySender(result.error))
  }

  // Should not reach here, but safety fallback
  return createFailureMessage({
    code: 'VALIDATION_ERROR',
    message: 'Message validation failed',
    cause: 'Exceeded maximum retry attempts',
  })
}
