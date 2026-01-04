/**
 * OpenCode Orca Plugin
 *
 * Provides the Orca + Specialists agent orchestration system with:
 * - Type-enforced contracts via discriminated union validation
 * - State machine orchestration with HITL gates
 * - Session continuity between agents
 * - Per-agent supervision with checkpoint protocol
 *
 * @packageDocumentation
 */

// -----------------------------------------------------------------------------
// Plugin exports (primary)
// -----------------------------------------------------------------------------

/**
 * Default plugin instance for OpenCode registration
 * Add to your opencode.jsonc: "plugin": ["opencode-orca"]
 */
export { default } from './plugin'

/**
 * Plugin factory for custom configuration
 */
export { createOrcaPlugin } from './plugin'

// -----------------------------------------------------------------------------
// Config types (for user configuration)
// -----------------------------------------------------------------------------

export type {
  AgentConfig,
  OrcaSettings,
  OrcaUserConfig,
  PermissionConfig,
} from './plugin/config'

export {
  AgentConfigSchema,
  OrcaSettingsSchema,
  OrcaUserConfigSchema,
  PermissionConfigSchema,
  USER_CONFIG_PATH,
} from './plugin/config'

// -----------------------------------------------------------------------------
// Agent definitions (for extension/reference)
// -----------------------------------------------------------------------------

export { DEFAULT_AGENTS, PROTOCOL_INJECTION, mergeAgentConfigs } from './plugin/agents'

// -----------------------------------------------------------------------------
// Contract schemas (for message validation)
// -----------------------------------------------------------------------------

// Error codes
export { ErrorCode, ErrorCodeSchema } from './schemas/errors'
export type { ErrorCode as ErrorCodeType } from './schemas/errors'

// Common primitives
export {
  AgentIdSchema,
  BaseEnvelopeSchema,
  SessionIdSchema,
  TimestampSchema,
} from './schemas/common'
export type {
  AgentId,
  BaseEnvelope,
  SessionId,
  Timestamp,
} from './schemas/common'

// Payload schemas
export {
  AnswerPayloadSchema,
  CheckpointPayloadSchema,
  EscalationOptionSchema,
  EscalationPayloadSchema,
  FailurePayloadSchema,
  InterruptPayloadSchema,
  PlanContextSchema,
  PlanPayloadSchema,
  PlanStepSchema,
  QuestionPayloadSchema,
  ResultPayloadSchema,
  TaskPayloadSchema,
  UserInputPayloadSchema,
} from './schemas/payloads'
export type {
  AnswerPayload,
  CheckpointPayload,
  EscalationOption,
  EscalationPayload,
  FailurePayload,
  InterruptPayload,
  PlanContext,
  PlanPayload,
  PlanStep,
  QuestionPayload,
  ResultPayload,
  TaskPayload,
  UserInputPayload,
} from './schemas/payloads'

// Message schemas
export {
  AnswerMessageSchema,
  CheckpointMessageSchema,
  EscalationMessageSchema,
  FailureMessageSchema,
  InterruptMessageSchema,
  MessageEnvelopeSchema,
  PlanMessageSchema,
  QuestionMessageSchema,
  ResultMessageSchema,
  TaskMessageSchema,
  UserInputMessageSchema,
} from './schemas/messages'

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
  ResultMessage,
  TaskMessage,
  UserInputMessage,
} from './schemas/messages'

// -----------------------------------------------------------------------------
// Dispatch and validation (for advanced usage)
// -----------------------------------------------------------------------------

export {
  createCheckpointMessage,
  dispatchToAgent,
  isAgentSupervised,
  type DispatchContext,
} from './plugin/dispatch'

export {
  createFailureMessage,
  formatZodErrors,
  validateMessage,
  validateWithRetry,
  wrapAsResultMessage,
  type ValidationResult,
} from './plugin/validation'

export {
  DEFAULT_VALIDATION_CONFIG,
  resolveValidationConfig,
  type ValidationConfig,
} from './plugin/types'
