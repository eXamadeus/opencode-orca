import * as agents from '../agents'
import type { AgentConfig, ResponseType } from './config'
import { generateResponseFormatInstructions } from './response-format'
import { DEFAULT_RESPONSE_TYPES } from './types'

/**
 * Agents whose responseTypes cannot be overridden by user configuration.
 * These are core orchestration agents with specific response type requirements.
 */
export const PROTECTED_AGENTS = ['orca', 'strategist'] as const

/**
 * Append response format instructions to an agent's prompt.
 * Uses the agent's responseTypes configuration to generate appropriate examples.
 */
function withProtocol(agentId: string, agent: AgentConfig): AgentConfig {
  const responseTypes = agent.responseTypes ?? DEFAULT_RESPONSE_TYPES
  const formatInstructions = generateResponseFormatInstructions(
    agentId,
    responseTypes as ResponseType[],
  )

  if (!formatInstructions) {
    return agent // Orca gets no injection (empty responseTypes)
  }

  return {
    ...agent,
    prompt: agent.prompt ? `${agent.prompt}\n\n${formatInstructions}` : formatInstructions,
  }
}

/**
 * Default agent definitions for the Orca orchestration system
 *
 * These are injected into OpenCode's agent config and can be
 * overridden or extended via .opencode/orca.json
 */
export const DEFAULT_AGENTS: Record<string, AgentConfig> = {
  orca: withProtocol('orca', agents.orca),
  strategist: withProtocol('strategist', agents.strategist),
  coder: withProtocol('coder', agents.coder),
  tester: withProtocol('tester', agents.tester),
  reviewer: withProtocol('reviewer', agents.reviewer),
  researcher: withProtocol('researcher', agents.researcher),
  'document-writer': withProtocol('document-writer', agents.documentWriter),
  architect: withProtocol('architect', agents.architect),
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

      // Protected agents: preserve default responseTypes (ignore user override)
      if (PROTECTED_AGENTS.includes(agentId as (typeof PROTECTED_AGENTS)[number])) {
        merged.responseTypes = defaultConfig.responseTypes
      }

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
