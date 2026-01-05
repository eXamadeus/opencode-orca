// Contract schemas for Orca agent communication

// Error codes
export { ErrorCode, ErrorCodeSchema } from './errors'
export type { ErrorCode as ErrorCodeType } from './errors'

// Common primitives
export {
  AgentIdSchema,
  BaseEnvelopeSchema,
  ResponseEnvelopeSchema,
  SessionIdSchema,
  TimestampSchema,
} from './common'
export type {
  AgentId,
  BaseEnvelope,
  ResponseEnvelope,
  SessionId,
  Timestamp,
} from './common'

// Payload schemas
export {
  AnnotationSchema,
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
  SourceSchema,
  TaskPayloadSchema,
  UserInputPayloadSchema,
} from './payloads'
export type {
  Annotation,
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
  Source,
  TaskPayload,
  UserInputPayload,
} from './payloads'

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
  TaskMessageSchema,
  UserInputMessageSchema,
} from './messages'

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
} from './messages'

// JSON Schema generation
export { generateMessageJsonSchema, generateProtocolDocumentation } from './jsonschema'
