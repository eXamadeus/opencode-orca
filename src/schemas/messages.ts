import { z } from 'zod'
import { AgentId, SessionId } from './common'
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

export const TaskMessage = z
  .strictObject({
    type: z.literal('task'),
    prompt: z.string().min(1),
    context: z.record(z.string(), z.unknown()).optional(),
    parent_session_id: SessionId.optional(),
    plan_context: PlanContext.optional(),
  })
  .describe('A `task` is used to request a specialist to perform a specific goal (write-capable)')
export type TaskMessage = z.infer<typeof TaskMessage>

export const PlanMessage = z
  .strictObject({
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
  .describe('A `plan` contains the details necessary for orca to execute')
export type PlanMessage = z.infer<typeof PlanMessage>

export const AnswerMessage = z
  .strictObject({
    type: z.literal('answer'),
    content: z.string(),
    sources: z.array(Source).optional(),
    annotations: z.array(Annotation).optional(),
  })
  .describe('An `answer` is used to provide a response to a `question`')
export type AnswerMessage = z.infer<typeof AnswerMessage>

export const QuestionMessage = z
  .strictObject({
    type: z.literal('question'),
    question: z.string().min(1),
    options: z.array(z.string()).optional(),
    blocking: z.boolean(),
  })
  .describe('A `question` is used when asking a specialist or the planner a question (read-only)')
export type QuestionMessage = z.infer<typeof QuestionMessage>

export const InterruptMessage = z
  .strictObject({
    type: z.literal('interrupt'),
    reason: z.string().min(1),
  })
  .describe('Used when an interrupt in plan execution occurs')
export type InterruptMessage = z.infer<typeof InterruptMessage>

export const FailureMessage = z.strictObject({
  type: z.literal('failure'),
  code: ErrorCode,
  message: z.string().min(1),
  cause: z.string().optional(),
})
export type FailureMessage = z.infer<typeof FailureMessage>

export const CheckpointMessage = z.strictObject({
  type: z.literal('checkpoint'),
  prompt: z.string().min(1),
  step_index: z.number().int().nonnegative().optional(),
  plan_goal: z.string().optional(),
})
export type CheckpointMessage = z.infer<typeof CheckpointMessage>

export const SuccessMessage = z.strictObject({
  type: z.literal('success'),
  summary: z.string().min(1).describe('Brief description of what was completed'),
  artifacts: z.array(z.string()).optional().describe('Files created or modified'),
  verification: z.array(z.string()).optional().describe('Verification steps performed'),
  notes: z.array(z.string()).optional().describe('Additional context or caveats'),
})
export type SuccessMessage = z.infer<typeof SuccessMessage>

const messages = [
  QuestionMessage,
  AnswerMessage,
  SuccessMessage,
  PlanMessage,
  TaskMessage,
  CheckpointMessage,
  FailureMessage,
  InterruptMessage,
] as const

export const messageTypes = messages.map((m) => m.shape.type.value)

export const Message = z.discriminatedUnion('type', messages)
export type Message = z.infer<typeof Message>

export const MessageType = z.enum(messages.map((m) => m.shape.type.value))
export type MessageType = z.infer<typeof MessageType>

export const DispatchPayload = z.strictObject({
  agent_id: AgentId,
  session_id: SessionId.optional().describe(
    'Optional OpenCode session_id for resuming communication with a previous session.',
  ),
  message: Message,
})
export type DispatchPayload = z.infer<typeof DispatchPayload>

export const DispatchResponse = z.strictObject({
  session_id: SessionId.optional().describe(
    'Session ID for continuing the conversation. Absent on early failures (unknown agent, validation error).',
  ),
  message: Message,
})
export type DispatchResponse = z.infer<typeof DispatchResponse>
