import { z } from 'zod'
import { BaseEnvelopeSchema, ResponseEnvelopeSchema } from './common'
import {
  AnswerPayloadSchema,
  CheckpointPayloadSchema,
  EscalationPayloadSchema,
  FailurePayloadSchema,
  InterruptPayloadSchema,
  PlanPayloadSchema,
  QuestionPayloadSchema,
  TaskPayloadSchema,
  UserInputPayloadSchema,
} from './payloads'

/**
 * Task message - Orca assigns work to a specialist agent
 */
export const TaskMessageSchema = BaseEnvelopeSchema.extend({
  type: z.literal('task'),
  payload: TaskPayloadSchema,
})

export type TaskMessage = z.infer<typeof TaskMessageSchema>

/**
 * Plan message - Strategist returns an execution plan
 */
export const PlanMessageSchema = ResponseEnvelopeSchema.extend({
  type: z.literal('plan'),
  payload: PlanPayloadSchema,
})

export type PlanMessage = z.infer<typeof PlanMessageSchema>

/**
 * Answer message - Agent response with optional sources and annotations
 */
export const AnswerMessageSchema = ResponseEnvelopeSchema.extend({
  type: z.literal('answer'),
  payload: AnswerPayloadSchema,
})

export type AnswerMessage = z.infer<typeof AnswerMessageSchema>

/**
 * Question message - Agent asks for clarification
 */
export const QuestionMessageSchema = ResponseEnvelopeSchema.extend({
  type: z.literal('question'),
  payload: QuestionPayloadSchema,
})

export type QuestionMessage = z.infer<typeof QuestionMessageSchema>

/**
 * Escalation message - Agent escalates to Orca for a decision
 */
export const EscalationMessageSchema = ResponseEnvelopeSchema.extend({
  type: z.literal('escalation'),
  payload: EscalationPayloadSchema,
})

export type EscalationMessage = z.infer<typeof EscalationMessageSchema>

/**
 * User input message - User provides input
 */
export const UserInputMessageSchema = BaseEnvelopeSchema.extend({
  type: z.literal('user_input'),
  payload: UserInputPayloadSchema,
})

export type UserInputMessage = z.infer<typeof UserInputMessageSchema>

/**
 * Interrupt message - User interrupts execution
 */
export const InterruptMessageSchema = BaseEnvelopeSchema.extend({
  type: z.literal('interrupt'),
  payload: InterruptPayloadSchema,
})

export type InterruptMessage = z.infer<typeof InterruptMessageSchema>

/**
 * Failure message - Agent reports a failure
 */
export const FailureMessageSchema = ResponseEnvelopeSchema.extend({
  type: z.literal('failure'),
  payload: FailurePayloadSchema,
})

export type FailureMessage = z.infer<typeof FailureMessageSchema>

/**
 * Checkpoint message - Supervision checkpoint requiring user approval
 */
export const CheckpointMessageSchema = ResponseEnvelopeSchema.extend({
  type: z.literal('checkpoint'),
  payload: CheckpointPayloadSchema,
})

export type CheckpointMessage = z.infer<typeof CheckpointMessageSchema>

/**
 * Message envelope - Discriminated union of all message types
 */
export const MessageEnvelopeSchema = z.discriminatedUnion('type', [
  TaskMessageSchema,
  PlanMessageSchema,
  AnswerMessageSchema,
  QuestionMessageSchema,
  EscalationMessageSchema,
  UserInputMessageSchema,
  InterruptMessageSchema,
  FailureMessageSchema,
  CheckpointMessageSchema,
])

export type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>

/**
 * Message type literal union
 */
export type MessageType = MessageEnvelope['type']
