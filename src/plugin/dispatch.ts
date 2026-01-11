import type { OpencodeClient, Part } from '@opencode-ai/sdk'
import {
  type CheckpointMessage,
  DispatchPayload,
  type DispatchResponse,
  type Message,
  type TaskMessage,
} from '../schemas/messages'
import type { AgentConfig, OrcaSettings } from './config'
import type { ValidationConfig } from './types'
import { createFailureMessage, validateWithRetry } from './validation'

/**
 * Context for dispatch operations
 */
export interface DispatchContext {
  /** OpenCode SDK client */
  client: OpencodeClient
  /** Registered agents */
  agents: Record<string, AgentConfig>
  /** Validation configuration */
  validationConfig: ValidationConfig
  /** Orca settings (for defaultSupervised) */
  settings?: OrcaSettings
  /** Abort signal for cancellation */
  abort?: AbortSignal
}

/**
 * Determine if an agent requires supervision
 *
 * Resolution order:
 * 1. Agent's explicit `supervised` setting (if defined)
 * 2. Global `defaultSupervised` setting (if defined)
 * 3. Default to false (no supervision)
 */
export function isAgentSupervised(
  agentId: string,
  agents: Record<string, AgentConfig>,
  settings?: OrcaSettings,
): boolean {
  const agent = agents[agentId]
  if (agent?.supervised !== undefined) {
    return agent.supervised
  }
  return settings?.defaultSupervised ?? false
}

/**
 * Create a checkpoint message for a supervised agent
 * Note: Checkpoint is a response message (no session_id)
 */
export function createCheckpointMessage(task: TaskMessage): CheckpointMessage {
  return {
    type: 'checkpoint',
    prompt: task.prompt,
    step_index: task.plan_context?.step_index,
    plan_goal: task.plan_context?.goal,
  }
}

function isTextPart(part: Part): part is Part & { type: 'text'; text: string } {
  return part.type === 'text' && 'text' in part
}

function extractTextFromParts(parts: Part[]): string {
  return parts
    .filter(isTextPart)
    .map((part) => part.text)
    .join('\n')
}

/**
 * Helper to create a DispatchResponse envelope
 */
function createResponse(message: Message, sessionId?: string): DispatchResponse {
  return sessionId ? { session_id: sessionId, message } : { message }
}

/**
 * Dispatch a message to a specialist agent
 *
 * @param payload - Dispatch payload with agent_id, optional session_id, and message
 * @param ctx - Dispatch context with client, agents, and config
 * @returns JSON string of DispatchResponse
 */
export async function dispatchToAgent(
  payload: DispatchPayload,
  ctx: DispatchContext,
): Promise<string> {
  // Validate payload structure (early failure - no session)
  const parsed = DispatchPayload.safeParse(payload)
  if (!parsed.success) {
    return JSON.stringify(
      createResponse(
        createFailureMessage({
          code: 'VALIDATION_ERROR',
          message: 'Invalid message format',
          cause: parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        }),
      ),
    )
  }

  const { agent_id: agentId, session_id: sessionId, message } = parsed.data

  // Verify target agent exists (early failure - no session)
  if (!ctx.agents[agentId]) {
    return JSON.stringify(
      createResponse(
        createFailureMessage({
          code: 'UNKNOWN_AGENT',
          message: `Unknown agent: ${agentId}`,
          cause: `Available agents: ${Object.keys(ctx.agents).join(', ')}`,
        }),
      ),
    )
  }

  try {
    // Create or reuse session BEFORE supervision check
    let currentSession = sessionId

    if (!currentSession) {
      const createResult = await ctx.client.session.create({})

      if (!createResult.data?.id) {
        return JSON.stringify(
          createResponse(
            createFailureMessage({
              code: 'SESSION_NOT_FOUND',
              message: 'Failed to create session',
              cause: 'Session creation returned no ID',
            }),
          ),
        )
      }

      currentSession = createResult.data.id
    }

    // Check supervision for task messages (now has session context)
    if (message.type === 'task') {
      const supervised = isAgentSupervised(agentId, ctx.agents, ctx.settings)
      const approvedRemaining = message.plan_context?.approved_remaining ?? false

      if (supervised && !approvedRemaining) {
        return JSON.stringify(createResponse(createCheckpointMessage(message), currentSession))
      }
    }

    // Send prompt to agent
    const promptResult = await ctx.client.session.prompt({
      path: { id: currentSession },
      body: {
        agent: agentId,
        parts: [{ type: 'text', text: JSON.stringify(message, null, 2) }],
      },
    })

    // Extract response text from parts
    const responseParts = promptResult.data?.parts ?? []
    const responseText = extractTextFromParts(responseParts)

    if (!responseText) {
      return JSON.stringify(
        createResponse(
          createFailureMessage({
            code: 'AGENT_ERROR',
            message: 'Agent returned empty response',
            cause: `Agent ${agentId} produced no text output`,
          }),
          currentSession,
        ),
      )
    }

    // Validate response with retry logic
    const validatedMessage = await validateWithRetry(
      responseText,
      ctx.validationConfig,
      // Retry sender: re-prompt the agent with correction
      async (correctionPrompt) => {
        const retryResult = await ctx.client.session.prompt({
          path: { id: currentSession },
          body: {
            agent: agentId,
            parts: [{ type: 'text', text: correctionPrompt }],
          },
        })

        const retryParts = retryResult.data?.parts ?? []
        return extractTextFromParts(retryParts)
      },
    )

    return JSON.stringify(createResponse(validatedMessage, currentSession))
  } catch (err) {
    // Check for abort/timeout
    if (ctx.abort?.aborted) {
      return JSON.stringify(
        createResponse(
          createFailureMessage({
            code: 'TIMEOUT',
            message: 'Request timed out or was cancelled',
          }),
        ),
      )
    }

    // Generic agent error
    return JSON.stringify(
      createResponse(
        createFailureMessage({
          code: 'AGENT_ERROR',
          message: 'Agent execution failed',
          cause: err instanceof Error ? err.message : String(err),
        }),
      ),
    )
  }
}
