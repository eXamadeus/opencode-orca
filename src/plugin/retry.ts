import type { FailureMessage, MessageEnvelope } from '../schemas/messages'
import type { AutonomyLevel } from './config'

/**
 * Context for retry decisions
 */
export interface RetryContext {
  /** The failure message that triggered retry consideration */
  failure: FailureMessage
  /** Current autonomy level */
  autonomyLevel: AutonomyLevel
  /** Number of retry attempts already made */
  attempts: number
  /** Maximum allowed retry attempts */
  maxRetries: number
}

/**
 * Result of retry decision
 */
export type RetryDecision =
  | { shouldRetry: true; reason: string }
  | { shouldRetry: false; reason: string }

/**
 * Error codes that are considered retryable
 * These are transient failures that might succeed on retry
 */
const RETRYABLE_ERROR_CODES = new Set([
  'AGENT_ERROR', // Generic agent failure - might be transient
  'TIMEOUT', // Timeout - might succeed with more time
  'VALIDATION_ERROR', // Validation might succeed with reprompt
])

/**
 * Error codes that should never be retried
 * These are permanent failures or security-related blocks
 */
const NON_RETRYABLE_ERROR_CODES = new Set([
  'UNKNOWN_AGENT', // Agent doesn't exist - won't change
  'SESSION_NOT_FOUND', // Session gone - won't come back
  'AUTONOMY_BLOCKED', // Policy block - won't change without user action
  'APPROVAL_REQUIRED', // Needs user input - not a retry situation
])

/**
 * Determine whether a failure should be retried based on autonomy level
 *
 * In assisted mode:
 * - Auto-retry transient failures without user confirmation
 * - Respect max retry limits
 * - Don't retry permanent failures
 *
 * In supervised mode:
 * - Always surface failures to user (no auto-retry)
 *
 * In autonomous mode:
 * - Aggressive retry of transient failures
 * - Only surface after max retries exhausted
 *
 * @param ctx - Retry context with failure, level, and attempt info
 * @returns Retry decision with reason
 */
export function shouldAutoRetry(ctx: RetryContext): RetryDecision {
  const { failure, autonomyLevel, attempts, maxRetries } = ctx
  const errorCode = failure.payload.code

  // Check if max retries exceeded
  if (attempts >= maxRetries) {
    return {
      shouldRetry: false,
      reason: `Maximum retry attempts (${maxRetries}) exceeded`,
    }
  }

  // Check if error is non-retryable
  if (NON_RETRYABLE_ERROR_CODES.has(errorCode)) {
    return {
      shouldRetry: false,
      reason: `Error code ${errorCode} is not retryable`,
    }
  }

  // Check if error is retryable
  const isRetryable = RETRYABLE_ERROR_CODES.has(errorCode)

  // Supervised mode: never auto-retry, always surface to user
  if (autonomyLevel === 'supervised') {
    return {
      shouldRetry: false,
      reason: 'Supervised mode requires user confirmation for all failures',
    }
  }

  // Assisted mode: auto-retry retryable errors
  if (autonomyLevel === 'assisted') {
    if (isRetryable) {
      return {
        shouldRetry: true,
        reason: `Auto-retrying ${errorCode} in assisted mode (attempt ${attempts + 1}/${maxRetries})`,
      }
    }
    return {
      shouldRetry: false,
      reason: `Error code ${errorCode} requires user attention in assisted mode`,
    }
  }

  // Autonomous mode: aggressive retry of any retryable error
  if (autonomyLevel === 'autonomous') {
    if (isRetryable) {
      return {
        shouldRetry: true,
        reason: `Auto-retrying ${errorCode} in autonomous mode (attempt ${attempts + 1}/${maxRetries})`,
      }
    }
    return {
      shouldRetry: false,
      reason: `Error code ${errorCode} is a permanent failure`,
    }
  }

  // Unknown autonomy level - be conservative
  return {
    shouldRetry: false,
    reason: `Unknown autonomy level: ${autonomyLevel}`,
  }
}

/**
 * Callback type for executing a retry attempt
 */
export type RetryExecutor = () => Promise<MessageEnvelope>

/**
 * Execute retry logic for a failure in the given autonomy context
 *
 * @param failure - The failure to potentially retry
 * @param autonomyLevel - Current autonomy level
 * @param maxRetries - Maximum retry attempts
 * @param executor - Callback to execute retry attempt
 * @returns Final response (either successful retry or original failure)
 */
export async function executeWithRetry(
  failure: FailureMessage,
  autonomyLevel: AutonomyLevel,
  maxRetries: number,
  executor: RetryExecutor,
): Promise<MessageEnvelope> {
  let currentFailure = failure
  let attempts = 0

  while (attempts < maxRetries) {
    const decision = shouldAutoRetry({
      failure: currentFailure,
      autonomyLevel,
      attempts,
      maxRetries,
    })

    if (!decision.shouldRetry) {
      // Return the failure - no more retries
      return currentFailure
    }

    // Execute retry
    attempts++
    const result = await executor()

    // If successful, return the result
    if (result.type !== 'failure') {
      return result
    }

    // Update failure for next iteration
    currentFailure = result
  }

  // Max retries exhausted, return last failure
  return currentFailure
}
