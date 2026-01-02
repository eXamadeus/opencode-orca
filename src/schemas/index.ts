// Contract schemas for Orca agent communication

// Error codes
export { ErrorCode, ErrorCodeSchema } from './errors'
export type { ErrorCode as ErrorCodeType } from './errors'

// Common primitives
export {
  AgentIdSchema,
  BaseEnvelopeSchema,
  SessionIdSchema,
  TimestampSchema,
} from './common'
export type {
  AgentId,
  BaseEnvelope,
  SessionId,
  Timestamp,
} from './common'

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
} from './payloads'
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
} from './payloads'

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
} from './messages'

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
} from './messages'

// JSON Schema generation
export { generateMessageJsonSchema, generateProtocolDocumentation } from './jsonschema'
