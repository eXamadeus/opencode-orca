import { z } from 'zod'
import { AgentIdSchema, SessionIdSchema } from './common'
import { ErrorCodeSchema } from './errors'

/**
 * Plan context for tracking approval state within a plan
 */
export const PlanContextSchema = z.strictObject({
  goal: z.string().min(1),
  step_index: z.number().int().nonnegative(),
  approved_remaining: z.boolean(),
})

export type PlanContext = z.infer<typeof PlanContextSchema>

/**
 * Task payload - Orca assigns work to a specialist agent
 */
export const TaskPayloadSchema = z.strictObject({
  agent_id: AgentIdSchema,
  prompt: z.string().min(1),
  context: z.record(z.string(), z.unknown()).optional(),
  parent_session_id: SessionIdSchema.optional(),
  plan_context: PlanContextSchema.optional(),
})

export type TaskPayload = z.infer<typeof TaskPayloadSchema>

/**
 * Result payload - Specialist returns completed work
 */
export const ResultPayloadSchema = z.strictObject({
  agent_id: AgentIdSchema,
  content: z.string(),
  artifacts: z.array(z.string()).optional(),
})

export type ResultPayload = z.infer<typeof ResultPayloadSchema>

/**
 * Plan step schema
 */
export const PlanStepSchema = z.strictObject({
  description: z.string().min(1),
  command: z.string().optional(),
})

export type PlanStep = z.infer<typeof PlanStepSchema>

/**
 * Plan payload - Strategist returns an execution plan
 */
export const PlanPayloadSchema = z.strictObject({
  agent_id: AgentIdSchema,
  goal: z.string().min(1),
  steps: z.array(PlanStepSchema).min(1),
  assumptions: z.array(z.string()).optional(),
  files_touched: z.array(z.string()).optional(),
})

export type PlanPayload = z.infer<typeof PlanPayloadSchema>

/**
 * Answer payload - Response to a question
 */
export const AnswerPayloadSchema = z.strictObject({
  agent_id: AgentIdSchema,
  content: z.string(),
  sources: z.array(z.string()).optional(),
})

export type AnswerPayload = z.infer<typeof AnswerPayloadSchema>

/**
 * Question payload - Agent asks for clarification
 */
export const QuestionPayloadSchema = z.strictObject({
  agent_id: AgentIdSchema,
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  blocking: z.boolean(),
})

export type QuestionPayload = z.infer<typeof QuestionPayloadSchema>

/**
 * Escalation option schema
 */
export const EscalationOptionSchema = z.strictObject({
  label: z.string().min(1),
  value: z.string().min(1),
})

export type EscalationOption = z.infer<typeof EscalationOptionSchema>

/**
 * Escalation payload - Agent escalates to Orca for a decision
 */
export const EscalationPayloadSchema = z.strictObject({
  agent_id: AgentIdSchema,
  decision_id: z.string().min(1),
  decision: z.string().min(1),
  options: z.array(EscalationOptionSchema).min(1),
  context: z.string(),
})

export type EscalationPayload = z.infer<typeof EscalationPayloadSchema>

/**
 * User input payload - User provides input
 */
export const UserInputPayloadSchema = z.strictObject({
  content: z.string(),
  in_response_to: SessionIdSchema.optional(),
})

export type UserInputPayload = z.infer<typeof UserInputPayloadSchema>

/**
 * Interrupt payload - User interrupts execution
 */
export const InterruptPayloadSchema = z.strictObject({
  reason: z.string().min(1),
  agent_id: AgentIdSchema.optional(),
})

export type InterruptPayload = z.infer<typeof InterruptPayloadSchema>

/**
 * Failure payload - Agent reports a failure
 */
export const FailurePayloadSchema = z.strictObject({
  agent_id: AgentIdSchema.optional(),
  code: ErrorCodeSchema,
  message: z.string().min(1),
  cause: z.string().optional(),
})

export type FailurePayload = z.infer<typeof FailurePayloadSchema>

/**
 * Checkpoint payload - Supervision checkpoint requiring user approval
 */
export const CheckpointPayloadSchema = z.strictObject({
  agent_id: AgentIdSchema,
  prompt: z.string().min(1),
  step_index: z.number().int().nonnegative().optional(),
  plan_goal: z.string().optional(),
})

export type CheckpointPayload = z.infer<typeof CheckpointPayloadSchema>
