import { randomUUID } from 'node:crypto'
import { ErrorCode } from '../schemas/errors'
import type {
  EscalationMessage,
  FailureMessage,
  MessageEnvelope,
  TaskMessage,
} from '../schemas/messages'
import type { ActionClassification, GateDecision } from './autonomy'
import type { AutonomyLevel } from './config'

/**
 * Generate current ISO8601 timestamp
 */
function nowTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Context for gate enforcement decisions
 */
export interface GateContext {
  /** The task being dispatched */
  task: TaskMessage
  /** Current autonomy level */
  autonomyLevel: AutonomyLevel
  /** Classification of the action */
  classification: ActionClassification
  /** Gate decision */
  decision: GateDecision
}

/**
 * Result of pre-dispatch gate check
 */
export type PreDispatchResult =
  | { allowed: true }
  | { allowed: false; response: FailureMessage | EscalationMessage }

/**
 * Create a failure message for blocked operations
 */
function createBlockedFailure(ctx: GateContext): FailureMessage {
  return {
    type: 'failure',
    session_id: randomUUID(),
    timestamp: nowTimestamp(),
    payload: {
      agent_id: ctx.task.payload.agent_id,
      code: ErrorCode.AUTONOMY_BLOCKED,
      message: `Operation blocked: ${ctx.classification} action not permitted in ${ctx.autonomyLevel} mode`,
      cause: `The operation targeting agent "${ctx.task.payload.agent_id}" was classified as "${ctx.classification}" and is blocked under the current autonomy level "${ctx.autonomyLevel}".`,
    },
  }
}

/**
 * Create an escalation message for operations requiring approval
 */
function createApprovalEscalation(ctx: GateContext): EscalationMessage {
  return {
    type: 'escalation',
    session_id: ctx.task.session_id,
    timestamp: nowTimestamp(),
    payload: {
      agent_id: 'orca',
      decision_id: `approval-${ctx.task.session_id}`,
      decision: `Approve ${ctx.classification} action to ${ctx.task.payload.agent_id}?`,
      options: [
        { label: 'Approve', value: 'approve' },
        { label: 'Reject', value: 'reject' },
        { label: 'Approve All (switch to autonomous)', value: 'approve_all' },
      ],
      context: `**Target Agent**: ${ctx.task.payload.agent_id}
**Action Type**: ${ctx.classification}
**Autonomy Level**: ${ctx.autonomyLevel}

**Task Prompt**:
${ctx.task.payload.prompt}

This action requires user approval under the current autonomy settings.`,
    },
  }
}

/**
 * Enforce pre-dispatch gate based on autonomy level and action classification
 *
 * @param ctx - Gate context with task, level, classification, and decision
 * @returns PreDispatchResult indicating whether dispatch should proceed
 */
export function enforcePreDispatchGate(ctx: GateContext): PreDispatchResult {
  switch (ctx.decision) {
    case 'proceed':
      return { allowed: true }

    case 'require_approval':
      return {
        allowed: false,
        response: createApprovalEscalation(ctx),
      }

    case 'block':
      return {
        allowed: false,
        response: createBlockedFailure(ctx),
      }

    default:
      // Unknown decision - be conservative and require approval
      return {
        allowed: false,
        response: createApprovalEscalation(ctx),
      }
  }
}

/**
 * Transform a response message based on autonomy level
 *
 * In supervised mode, result messages may be wrapped to require confirmation
 * before the orchestrator acts on them. This is handled at the orchestrator
 * level rather than in the plugin, as the plugin returns the raw response.
 *
 * Currently, response transformation is minimal - the main gating happens
 * pre-dispatch. Post-response transformation may be added for:
 * - Wrapping results in confirmation-required structures
 * - Filtering sensitive information
 * - Adding metadata about the autonomy decision
 *
 * @param response - The response from the agent
 * @param _level - Current autonomy level
 * @param _classification - Original action classification
 * @returns Potentially transformed response
 */
export function transformResponse(
  response: MessageEnvelope,
  _level: AutonomyLevel,
  _classification: ActionClassification,
): MessageEnvelope {
  // Currently pass-through - gate enforcement is pre-dispatch
  // Post-dispatch transformation can be added here if needed
  return response
}
