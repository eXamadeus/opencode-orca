import * as agents from '../agents'
import { MessageEnvelopeSchema, generateProtocolDocumentation } from '../schemas'
import type { AgentConfig } from './config'

/**
 * Extract message types from the discriminated union schema
 */
function getMessageTypes(): string[] {
  return MessageEnvelopeSchema.options.map((opt) => {
    const shape = opt.shape
    // Zod 4 uses `values` array instead of `value`
    return shape.type.def.values[0]
  })
}

/**
 * Generate protocol documentation from the actual schema
 */
function generateProtocolDocs(): string {
  const messageTypes = getMessageTypes()
  const jsonSchema = generateProtocolDocumentation()

  return `
## Orca Communication Protocol

When communicating with other agents via the \`orca_dispatch\` tool, use this JSON message format:

\`\`\`json
{
  "type": "${messageTypes.join('" | "')}",
  "session_id": "uuid",
  "timestamp": "ISO8601_datetime",
  "payload": { ... type-specific payload ... }
}
\`\`\`

Message types:
- **task**: Dispatch a task to another agent (payload: agent_id, prompt, context?, parent_session_id?, plan_context?)
- **result**: Return successful completion with output (payload: agent_id, content, artifacts?)
- **question**: Ask for clarification (payload: agent_id, question, options?, blocking)
- **answer**: Respond to a question (payload: agent_id, content, sources?)
- **failure**: Report an error with code and message (payload: agent_id?, code, message, cause?)
- **plan**: Propose a multi-step plan for approval (payload: agent_id, goal, steps, assumptions?, files_touched?)
- **escalation**: Request human decision between options (payload: agent_id, decision_id, decision, options, context)
- **checkpoint**: Supervision checkpoint requiring user approval (payload: agent_id, prompt, step_index?, plan_goal?)
- **interrupt**: User interruption signal (payload: reason, agent_id?)
- **user_input**: Direct user input to resume (payload: content, in_response_to?)

Always validate messages before sending. Invalid messages will be rejected.

<details>
<summary>Full JSON Schema (click to expand)</summary>

\`\`\`json
${jsonSchema}
\`\`\`

</details>
`.trim()
}

/**
 * Protocol injection - appended to agent prompts to enable the Orca message format
 * Generated from the actual Zod schemas to ensure accuracy
 */
export const PROTOCOL_INJECTION = generateProtocolDocs()

/**
 * Append protocol injection to an agent's prompt
 */
function withProtocol(agent: AgentConfig): AgentConfig {
  return {
    ...agent,
    prompt: `${agent.prompt}\n\n${PROTOCOL_INJECTION}`,
  }
}

/**
 * Default agent definitions for the Orca orchestration system
 *
 * These are injected into OpenCode's agent config and can be
 * overridden or extended via .opencode/orca.json
 */
export const DEFAULT_AGENTS: Record<string, AgentConfig> = {
  orca: withProtocol(agents.orca),
  strategist: withProtocol(agents.strategist),
  coder: withProtocol(agents.coder),
  tester: withProtocol(agents.tester),
  reviewer: withProtocol(agents.reviewer),
  researcher: withProtocol(agents.researcher),
  'document-writer': withProtocol(agents.documentWriter),
  architect: withProtocol(agents.architect),
}

/**
 * Deep merge two agent configs
 * User config values override defaults, with special handling for nested objects
 */
function mergeAgentConfig(base: AgentConfig, override: AgentConfig): AgentConfig {
  const result: AgentConfig = { ...base }

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue

    const baseValue = base[key as keyof typeof override]

    // Deep merge for nested objects (tools, permission)
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof baseValue === 'object' &&
      baseValue !== null &&
      !Array.isArray(baseValue)
    ) {
      result[key] = {
        ...baseValue,
        ...value,
      }
    } else {
      // Direct override for primitives and arrays
      result[key] = value
    }
  }

  return result
}

/**
 * Merge default agents with user overrides/additions
 *
 * - If user provides config for an existing agent, it's merged (user overrides defaults)
 * - If user provides a new agent, it's added as-is
 * - If user sets `disable: true`, the agent is excluded from the result
 *
 * @param defaults - Default agent definitions
 * @param userAgents - User agent configurations (overrides and additions)
 * @returns Merged agent configurations
 */
export function mergeAgentConfigs(
  defaults: Record<string, AgentConfig>,
  userAgents?: Record<string, AgentConfig>,
): Record<string, AgentConfig> {
  // Start with defaults
  const result: Record<string, AgentConfig> = {}

  // Process defaults, applying any user overrides
  for (const [agentId, defaultConfig] of Object.entries(defaults)) {
    const userOverride = userAgents?.[agentId]

    if (userOverride) {
      // Merge user override with default
      const merged = mergeAgentConfig(defaultConfig, userOverride)

      // Skip disabled agents
      if (merged.disable) continue

      result[agentId] = merged
    } else {
      result[agentId] = defaultConfig
    }
  }

  // Add any new agents from user config (not in defaults)
  if (userAgents) {
    for (const [agentId, userConfig] of Object.entries(userAgents)) {
      if (agentId in defaults) continue // Already processed
      if (userConfig.disable) continue // Skip disabled

      result[agentId] = userConfig
    }
  }

  return result
}
