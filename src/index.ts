/**
 * OpenCode Orca Plugin
 *
 * Provides the Orca + Specialists agent orchestration system.
 *
 * @packageDocumentation
 */

// =============================================================================
// IMPORTANT: OpenCode Plugin Export Rules
// =============================================================================
//
// OpenCode's plugin loader iterates ALL exports and calls each as a function:
//
//   for (const [_name, fn] of Object.entries(mod)) {
//     const init = await fn(input)  // <-- Calls EVERY export!
//   }
//
// Therefore:
// - DO NOT export functions (except the default plugin)
// - DO NOT export objects, schemas, or constants
// - Type-only exports (export type { ... }) are safe (erased at runtime)
//
// If you need to expose utilities for external use, create a separate entry
// point (e.g., "./schemas") in package.json exports.
// =============================================================================

/**
 * Default plugin instance for OpenCode registration
 * Add to your opencode.jsonc: "plugin": ["@ex-machina/opencode-orca"]
 */
export { default } from './plugin'

// -----------------------------------------------------------------------------
// Type-only exports for TypeScript consumers
// These are erased at runtime and won't interfere with plugin loading
// -----------------------------------------------------------------------------

// Config types (for user configuration files)
export type {
  AgentConfig,
  OrcaSettings,
  OrcaUserConfig,
  PermissionConfig,
} from './plugin/config'

// Message types (for understanding the protocol)
export type {
  AnswerMessage,
  CheckpointMessage,
  EscalationMessage,
  FailureMessage,
  InterruptMessage,
  MessageEnvelope,
  MessageType,
  PlanMessage,
  QuestionMessage,
  TaskMessage,
  UserInputMessage,
} from './schemas/messages'

// Payload types
export type {
  AnswerPayload,
  Annotation,
  CheckpointPayload,
  EscalationOption,
  EscalationPayload,
  FailurePayload,
  InterruptPayload,
  PlanContext,
  PlanPayload,
  PlanStep,
  QuestionPayload,
  Source,
  TaskPayload,
  UserInputPayload,
} from './schemas/payloads'

// Common types
export type {
  AgentId,
  BaseEnvelope,
  SessionId,
  Timestamp,
} from './schemas/common'

// Error code type (the enum type, not the value)
export type { ErrorCode as ErrorCodeType } from './schemas/errors'

// Dispatch types
export type { DispatchContext } from './plugin/dispatch'

// Validation types
export type { ValidationConfig } from './plugin/types'
export type { ValidationResult } from './plugin/validation'
