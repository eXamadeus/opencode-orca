import { z } from 'zod'
import { ResponseType } from '../plugin/config'
import { RequestEnvelope, ResponseEnvelope, SessionId, Timestamp } from './common'
import { ErrorCode } from './errors'

export const PlanContext = z
  .strictObject({
    goal: z.string().min(1).describe('The overall plan objective'),
    step_index: z.number().int().nonnegative().describe('Current step number (0-based)'),
    approved_remaining: z
      .boolean()
      .describe('If true, skip checkpoints for remaining steps in this plan'),
  })
  .describe('Plan context for tracking approval state within a plan.')
export type PlanContext = z.infer<typeof PlanContext>

export const PlanStep = z.strictObject({
  description: z.string().min(1),
  command: z.string().optional(),
})
export type PlanStep = z.infer<typeof PlanStep>

export const Source = z.strictObject({
  type: z.enum(['file', 'url', 'artifact']),
  ref: z.string(),
  title: z.string().optional(),
  excerpt: z.string().optional(),
})
export type Source = z.infer<typeof Source>

export const Annotation = z.strictObject({
  type: z.enum(['note', 'warning', 'assumption', 'caveat']),
  content: z.string(),
})
export type Annotation = z.infer<typeof Annotation>

export const TaskMessage = RequestEnvelope.extend({
  type: z.literal('task'),
  prompt: z.string().min(1),
  context: z.record(z.string(), z.unknown()).optional(),
  parent_session_id: SessionId.optional(),
  plan_context: PlanContext.optional(),
})
export type TaskMessage = z.infer<typeof TaskMessage>

export const PlanMessage = ResponseEnvelope.extend({
  type: z.literal('plan'),
  goal: z.string().min(1).describe('Clear statement of what we are achieving'),
  steps: z.array(PlanStep).min(1).describe('Numbered steps with specific actions'),
  assumptions: z.array(z.string()).min(1).describe('What we are assuming or need to clarify'),
  files_touched: z.array(z.string()).min(1).describe('List of files that will be modified'),
  verification: z
    .array(z.string())
    .min(1)
    .describe('How to confirm success - commands, tests, or checks to run'),
  risks: z.array(z.string()).min(1).describe('What could go wrong and how to recover/rollback'),
})
export type PlanMessage = z.infer<typeof PlanMessage>

export const AnswerMessage = ResponseEnvelope.extend({
  type: z.literal('answer'),
  content: z.string(),
  sources: z.array(Source).optional(),
  annotations: z.array(Annotation).optional(),
})
export type AnswerMessage = z.infer<typeof AnswerMessage>

export const QuestionMessage = ResponseEnvelope.extend({
  type: z.literal('question'),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  blocking: z.boolean(),
})
export type QuestionMessage = z.infer<typeof QuestionMessage>

export const InterruptMessage = RequestEnvelope.extend({
  type: z.literal('interrupt'),
  reason: z.string().min(1),
})
export type InterruptMessage = z.infer<typeof InterruptMessage>

export const FailureMessage = ResponseEnvelope.omit({ agent_id: true }).extend({
  type: z.literal('failure'),
  code: ErrorCode,
  message: z.string().min(1),
  cause: z.string().optional(),
})
export type FailureMessage = z.infer<typeof FailureMessage>

export const CheckpointMessage = ResponseEnvelope.extend({
  type: z.literal('checkpoint'),
  prompt: z.string().min(1),
  step_index: z.number().int().nonnegative().optional(),
  plan_goal: z.string().optional(),
})
export type CheckpointMessage = z.infer<typeof CheckpointMessage>

export const SuccessMessage = ResponseEnvelope.extend({
  type: z.literal('success'),
  summary: z.string().min(1).describe('Brief description of what was completed'),
  artifacts: z.array(z.string()).optional().describe('Files created or modified'),
  verification: z.array(z.string()).optional().describe('Verification steps performed'),
  notes: z.array(z.string()).optional().describe('Additional context or caveats'),
})
export type SuccessMessage = z.infer<typeof SuccessMessage>

export const MessageEnvelope = z.discriminatedUnion('type', [
  QuestionMessage,
  AnswerMessage,
  SuccessMessage,
  PlanMessage,
  TaskMessage,
  CheckpointMessage,
  FailureMessage,
  InterruptMessage,
])

export type MessageEnvelope = z.infer<typeof MessageEnvelope>
export type MessageType = MessageEnvelope['type']
