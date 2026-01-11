import type { OpencodeClient, Part } from '@opencode-ai/sdk'
import { type CheckpointMessage, TaskMessage } from '../schemas/messages'
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
    timestamp: new Date().toISOString(),
    type: 'checkpoint',
    agent_id: task.agent_id,
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
 * Dispatch a task message to a specialist agent
 *
 * @param unsafeTask - possible TaskMessage
 * @param ctx - Dispatch context with client, agents, and config
 * @returns JSON string of response MessageEnvelope
 */
export async function dispatchToAgent(
  unsafeTask: TaskMessage,
  ctx: DispatchContext,
): Promise<string> {
  const task = TaskMessage.safeParse(unsafeTask)
  if (!task.success) {
    return JSON.stringify(
      createFailureMessage(
        'VALIDATION_ERROR',
        'Invalid task message format',
        'Message must be a valid TaskMessage JSON envelope',
      ),
    )
  }

  const { agent_id: targetAgentId, prompt, parent_session_id, plan_context } = task.data

  // Verify target agent exists
  if (!ctx.agents[targetAgentId]) {
    return JSON.stringify(
      createFailureMessage(
        'UNKNOWN_AGENT',
        `Unknown agent: ${targetAgentId}`,
        `Available agents: ${Object.keys(ctx.agents).join(', ')}`,
      ),
    )
  }

  // Check if agent requires supervision
  const supervised = isAgentSupervised(targetAgentId, ctx.agents, ctx.settings)
  const approvedRemaining = plan_context?.approved_remaining ?? false

  // Return checkpoint if supervised and not pre-approved
  if (supervised && !approvedRemaining) {
    return JSON.stringify(createCheckpointMessage(task.data))
  }

  try {
    // Create or use existing session
    let sessionId: string

    if (parent_session_id) {
      // Use existing parent session
      sessionId = parent_session_id
    } else {
      // Create new session
      const createResult = await ctx.client.session.create({})

      if (!createResult.data?.id) {
        return JSON.stringify(
          createFailureMessage(
            'SESSION_NOT_FOUND',
            'Failed to create session',
            'Session creation returned no ID',
          ),
        )
      }

      sessionId = createResult.data.id
    }

    // Send prompt to agent
    const promptResult = await ctx.client.session.prompt({
      path: { id: sessionId },
      body: {
        agent: targetAgentId,
        parts: [{ type: 'text', text: prompt }],
      },
    })

    // Extract response text from parts
    const responseParts = promptResult.data?.parts ?? []
    const responseText = extractTextFromParts(responseParts)

    if (!responseText) {
      return JSON.stringify(
        createFailureMessage(
          'AGENT_ERROR',
          'Agent returned empty response',
          `Agent ${targetAgentId} produced no text output`,
        ),
      )
    }

    // Validate response with retry logic
    const validatedMessage = await validateWithRetry(
      responseText,
      targetAgentId,
      ctx.validationConfig,
      // Retry sender: re-prompt the agent with correction
      async (correctionPrompt) => {
        const retryResult = await ctx.client.session.prompt({
          path: { id: sessionId },
          body: {
            agent: targetAgentId,
            parts: [{ type: 'text', text: correctionPrompt }],
          },
        })

        const retryParts = retryResult.data?.parts ?? []
        return extractTextFromParts(retryParts)
      },
    )

    return JSON.stringify(validatedMessage)
  } catch (err) {
    // Check for abort/timeout
    if (ctx.abort?.aborted) {
      return JSON.stringify(createFailureMessage('TIMEOUT', 'Request timed out or was cancelled'))
    }

    // Generic agent error
    return JSON.stringify(
      createFailureMessage(
        'AGENT_ERROR',
        'Agent execution failed',
        err instanceof Error ? err.message : String(err),
      ),
    )
  }
}
