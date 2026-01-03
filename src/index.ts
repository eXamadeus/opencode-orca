/**
 * OpenCode Orca Plugin
 *
 * Provides the Orca + Specialists agent orchestration system with:
 * - Type-enforced contracts via discriminated union validation
 * - State machine orchestration with HITL gates
 * - Session continuity between agents
 * - Configurable autonomy levels
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
  AutonomyLevel,
  OrcaSettings,
  OrcaUserConfig,
  PermissionConfig,
} from './plugin/config'

export {
  AgentConfigSchema,
  AutonomyLevelSchema,
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
  EscalationOptionSchema,
  EscalationPayloadSchema,
  FailurePayloadSchema,
  InterruptPayloadSchema,
  PlanPayloadSchema,
  PlanStepSchema,
  QuestionPayloadSchema,
  ResultPayloadSchema,
  TaskPayloadSchema,
  UserInputPayloadSchema,
} from './schemas/payloads'
export type {
  AnswerPayload,
  EscalationOption,
  EscalationPayload,
  FailurePayload,
  InterruptPayload,
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

export { dispatchToAgent, type DispatchContext } from './plugin/dispatch'

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

// -----------------------------------------------------------------------------
// Autonomy (for autonomy level enforcement)
// -----------------------------------------------------------------------------

export {
  classifyAction,
  DEFAULT_AUTONOMY_CONFIG,
  DEFAULT_AUTONOMY_LEVEL,
  determineGate,
  resolveAutonomyConfig,
  resolveAutonomyLevel,
  type ActionClassification,
  type AutonomyConfig,
  type GateDecision,
} from './plugin/autonomy'

export {
  enforcePreDispatchGate,
  transformResponse,
  type GateContext,
  type PreDispatchResult,
} from './plugin/gates'

export {
  executeWithRetry,
  shouldAutoRetry,
  type RetryContext,
  type RetryDecision,
  type RetryExecutor,
} from './plugin/retry'
