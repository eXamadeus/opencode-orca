import type { OrcaSettings, ResponseType } from './config'

/**
 * Validation configuration for message handling
 */
export interface ValidationConfig {
  /** Max retries for validation failures before returning error (default: 2) */
  maxRetries: number
  /** Wrap plain text responses as AnswerMessage envelopes (default: true) */
  wrapPlainText: boolean
}

/**
 * Default response types for specialist agents
 */
export const DEFAULT_RESPONSE_TYPES: ResponseType[] = ['answer', 'failure']

/**
 * Default validation configuration
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  maxRetries: 2,
  wrapPlainText: false, // TODO: we need to test this out more
}

/**
 * Resolve validation config from user settings with defaults
 */
export function resolveValidationConfig(settings?: OrcaSettings): ValidationConfig {
  return {
    maxRetries: settings?.validation?.maxRetries ?? DEFAULT_VALIDATION_CONFIG.maxRetries,
    wrapPlainText: settings?.validation?.wrapPlainText ?? DEFAULT_VALIDATION_CONFIG.wrapPlainText,
  }
}
