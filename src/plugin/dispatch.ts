import type { OpencodeClient, Part } from '@opencode-ai/sdk'
import { ErrorCode } from '../schemas/errors'
import type { FailureMessage, MessageEnvelope, TaskMessage } from '../schemas/messages'
import { TaskMessageSchema } from '../schemas/messages'
import type { AutonomyConfig } from './autonomy'
import { DEFAULT_AUTONOMY_CONFIG, classifyAction, determineGate } from './autonomy'
import type { AgentConfig } from './config'
import { enforcePreDispatchGate, transformResponse } from './gates'
import { executeWithRetry } from './retry'
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
  /** Autonomy configuration */
  autonomyConfig: AutonomyConfig
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
 * Execute the actual dispatch to an agent (internal helper)
 * This is separated to allow retry logic to wrap the core dispatch
 */
async function executeDispatch(task: TaskMessage, ctx: DispatchContext): Promise<MessageEnvelope> {
  const { agent_id: targetAgentId, prompt, parent_session_id } = task.payload

  // Create or use existing session
  let sessionId: string

  if (parent_session_id) {
    sessionId = parent_session_id
  } else {
    const createResult = await ctx.client.session.create({})

    if (!createResult.data?.id) {
      return createFailureMessage(
        ErrorCode.SESSION_NOT_FOUND,
        'Failed to create session',
        'Session creation returned no ID',
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
    return createFailureMessage(
      ErrorCode.AGENT_ERROR,
      'Agent returned empty response',
      `Agent ${targetAgentId} produced no text output`,
    )
  }

  // Validate response with retry logic
  return validateWithRetry(
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
}

/**
 * Dispatch a task message to a specialist agent
 *
 * Enforces autonomy gates before dispatch and handles retry logic
 * for failures based on the current autonomy level.
 *
 * @param messageJson - JSON string of TaskMessage envelope
 * @param ctx - Dispatch context with client, agents, and config
 * @returns JSON string of response MessageEnvelope
 */
export async function dispatchToAgent(messageJson: string, ctx: DispatchContext): Promise<string> {
  // Use default autonomy config if not provided
  const autonomyConfig = ctx.autonomyConfig ?? DEFAULT_AUTONOMY_CONFIG

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

  const { agent_id: targetAgentId } = task.payload

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

  // === AUTONOMY GATE CHECK ===
  // Classify the action and determine gate decision
  const classification = classifyAction(task, ctx.agents)
  const decision = determineGate(autonomyConfig.level, classification)

  // Enforce pre-dispatch gate
  const gateResult = enforcePreDispatchGate({
    task,
    autonomyLevel: autonomyConfig.level,
    classification,
    decision,
  })

  if (!gateResult.allowed) {
    // Gate blocked the dispatch - return the gate response
    return JSON.stringify(gateResult.response)
  }

  // === EXECUTE DISPATCH ===
  try {
    let result = await executeDispatch(task, ctx)

    // === RETRY LOGIC FOR FAILURES ===
    // In assisted/autonomous mode, auto-retry transient failures
    if (result.type === 'failure') {
      result = await executeWithRetry(
        result as FailureMessage,
        autonomyConfig.level,
        autonomyConfig.maxRetries,
        () => executeDispatch(task, ctx),
      )
    }

    // === RESPONSE TRANSFORMATION ===
    // Transform response based on autonomy level if needed
    const transformedResult = transformResponse(result, autonomyConfig.level, classification)

    return JSON.stringify(transformedResult)
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
