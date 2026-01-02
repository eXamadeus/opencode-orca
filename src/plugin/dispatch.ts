import type { OpencodeClient, Part } from '@opencode-ai/sdk'
import { ErrorCode } from '../schemas/errors'
import type { MessageEnvelope, TaskMessage } from '../schemas/messages'
import { TaskMessageSchema } from '../schemas/messages'
import type { AgentConfig } from './config'
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
  /** Abort signal for cancellation */
  abort?: AbortSignal
}

/**
 * Parse and validate incoming task message
 */
function parseTaskMessage(messageJson: string): TaskMessage | null {
  try {
    const parsed = JSON.parse(messageJson)
    const result = TaskMessageSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/**
 * Check if a Part is a TextPart with text content
 */
function isTextPart(part: Part): part is Part & { type: 'text'; text: string } {
  return part.type === 'text' && 'text' in part
}

/**
 * Extract text content from response parts
 */
function extractTextFromParts(parts: Part[]): string {
  return parts
    .filter(isTextPart)
    .map((part) => part.text)
    .join('\n')
}

/**
 * Dispatch a task message to a specialist agent
 *
 * @param messageJson - JSON string of TaskMessage envelope
 * @param ctx - Dispatch context with client, agents, and config
 * @returns JSON string of response MessageEnvelope
 */
export async function dispatchToAgent(messageJson: string, ctx: DispatchContext): Promise<string> {
  // Parse the incoming task message
  const task = parseTaskMessage(messageJson)
  if (!task) {
    return JSON.stringify(
      createFailureMessage(
        ErrorCode.VALIDATION_ERROR,
        'Invalid task message format',
        'Message must be a valid TaskMessage JSON envelope',
      ),
    )
  }

  const { agent_id: targetAgentId, prompt, parent_session_id } = task.payload

  // Verify target agent exists
  if (!ctx.agents[targetAgentId]) {
    return JSON.stringify(
      createFailureMessage(
        ErrorCode.UNKNOWN_AGENT,
        `Unknown agent: ${targetAgentId}`,
        `Available agents: ${Object.keys(ctx.agents).join(', ')}`,
      ),
    )
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
            ErrorCode.SESSION_NOT_FOUND,
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
          ErrorCode.AGENT_ERROR,
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
      return JSON.stringify(
        createFailureMessage(ErrorCode.TIMEOUT, 'Request timed out or was cancelled'),
      )
    }

    // Generic agent error
    return JSON.stringify(
      createFailureMessage(
        ErrorCode.AGENT_ERROR,
        'Agent execution failed',
        err instanceof Error ? err.message : String(err),
      ),
    )
  }
}
