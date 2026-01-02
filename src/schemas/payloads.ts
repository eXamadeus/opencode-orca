import { z } from 'zod'
import { AgentIdSchema, SessionIdSchema } from './common'
import { ErrorCodeSchema } from './errors'

/**
 * Task payload - Orca assigns work to a specialist agent
 */
export const TaskPayloadSchema = z
  .object({
    agent_id: AgentIdSchema,
    prompt: z.string().min(1),
    context: z.record(z.string(), z.unknown()).optional(),
    parent_session_id: SessionIdSchema.optional(),
  })
  .strict()

export type TaskPayload = z.infer<typeof TaskPayloadSchema>

/**
 * Result payload - Specialist returns completed work
 */
export const ResultPayloadSchema = z
  .object({
    agent_id: AgentIdSchema,
    content: z.string(),
    artifacts: z.array(z.string()).optional(),
  })
  .strict()

export type ResultPayload = z.infer<typeof ResultPayloadSchema>

/**
 * Plan step schema
 */
export const PlanStepSchema = z
  .object({
    description: z.string().min(1),
    command: z.string().optional(),
  })
  .strict()

export type PlanStep = z.infer<typeof PlanStepSchema>

/**
 * Plan payload - Strategist returns an execution plan
 */
export const PlanPayloadSchema = z
  .object({
    agent_id: AgentIdSchema,
    goal: z.string().min(1),
    steps: z.array(PlanStepSchema).min(1),
    assumptions: z.array(z.string()).optional(),
    files_touched: z.array(z.string()).optional(),
  })
  .strict()

export type PlanPayload = z.infer<typeof PlanPayloadSchema>

/**
 * Answer payload - Response to a question
 */
export const AnswerPayloadSchema = z
  .object({
    agent_id: AgentIdSchema,
    content: z.string(),
    sources: z.array(z.string()).optional(),
  })
  .strict()

export type AnswerPayload = z.infer<typeof AnswerPayloadSchema>

/**
 * Question payload - Agent asks for clarification
 */
export const QuestionPayloadSchema = z
  .object({
    agent_id: AgentIdSchema,
    question: z.string().min(1),
    options: z.array(z.string()).optional(),
    blocking: z.boolean(),
  })
  .strict()

export type QuestionPayload = z.infer<typeof QuestionPayloadSchema>

/**
 * Escalation option schema
 */
export const EscalationOptionSchema = z
  .object({
    label: z.string().min(1),
    value: z.string().min(1),
  })
  .strict()

export type EscalationOption = z.infer<typeof EscalationOptionSchema>

/**
 * Escalation payload - Agent escalates to Orca for a decision
 */
export const EscalationPayloadSchema = z
  .object({
    agent_id: AgentIdSchema,
    decision_id: z.string().min(1),
    decision: z.string().min(1),
    options: z.array(EscalationOptionSchema).min(1),
    context: z.string(),
  })
  .strict()

export type EscalationPayload = z.infer<typeof EscalationPayloadSchema>

/**
 * User input payload - User provides input
 */
export const UserInputPayloadSchema = z
  .object({
    content: z.string(),
    in_response_to: SessionIdSchema.optional(),
  })
  .strict()

export type UserInputPayload = z.infer<typeof UserInputPayloadSchema>

/**
 * Interrupt payload - User interrupts execution
 */
export const InterruptPayloadSchema = z
  .object({
    reason: z.string().min(1),
    agent_id: AgentIdSchema.optional(),
  })
  .strict()

export type InterruptPayload = z.infer<typeof InterruptPayloadSchema>

/**
 * Failure payload - Agent reports a failure
 */
export const FailurePayloadSchema = z
  .object({
    agent_id: AgentIdSchema.optional(),
    code: ErrorCodeSchema,
    message: z.string().min(1),
    cause: z.string().optional(),
  })
  .strict()

export type FailurePayload = z.infer<typeof FailurePayloadSchema>
