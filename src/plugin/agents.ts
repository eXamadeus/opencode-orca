import { architect } from '../agents/architect'
import { coder } from '../agents/coder'
import { documentWriter } from '../agents/document-writer'
import { orca } from '../agents/orca'
import { planner } from '../agents/planner'
import { researcher } from '../agents/researcher'
import { reviewer } from '../agents/reviewer'
import { tester } from '../agents/tester'
import type { AgentConfig, ResponseType } from './config'
import { PROTECTED_AGENTS, SPECIALIST_LIST_PLACEHOLDER } from './constants'
import { generateResponseFormatInstructions } from './response-format'
import { DEFAULT_RESPONSE_TYPES } from './types'

// Re-export constants for backward compatibility
export { PROTECTED_AGENTS, SPECIALIST_LIST_PLACEHOLDER } from './constants'

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
  orca: withProtocol('orca', orca),
  planner: withProtocol('planner', { ...planner, specialist: true }),
  coder: withProtocol('coder', { ...coder, specialist: true }),
  tester: withProtocol('tester', { ...tester, specialist: true }),
  reviewer: withProtocol('reviewer', { ...reviewer, specialist: true }),
  researcher: withProtocol('researcher', { ...researcher, specialist: true }),
  'document-writer': withProtocol('document-writer', { ...documentWriter, specialist: true }),
  architect: withProtocol('architect', { ...architect, specialist: true }),
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
 * - If user sets `enabled: false`, the agent is excluded from the result
 * - Built-in agents default to `specialist: true`, user-defined agents default to `specialist: false`
 *
 * @param defaults - Default agent definitions
 * @param userAgents - User agent configurations (overrides and additions)
 * @returns Merged agent configurations
 */
export function mergeAgentConfigs(
  defaults: Record<string, AgentConfig>,
  userAgents?: Record<string, AgentConfig>,
): Record<string, AgentConfig> {
  // Warn about protected agent overrides (user config will be ignored)
  if (userAgents) {
    for (const agentId of PROTECTED_AGENTS) {
      if (agentId in userAgents) {
        console.warn(
          `[orca] Warning: "${agentId}" agent cannot be overridden. User config ignored.`,
        )
      }
    }
  }

  // Start with defaults
  const result: Record<string, AgentConfig> = {}

  // Process defaults, applying any user overrides
  for (const [agentId, defaultConfig] of Object.entries(defaults)) {
    // Protected agents: use default config as-is (ignore user overrides entirely)
    if (PROTECTED_AGENTS.includes(agentId as (typeof PROTECTED_AGENTS)[number])) {
      result[agentId] = defaultConfig
      continue
    }

    const userOverride = userAgents?.[agentId]

    if (userOverride) {
      // Merge user override with default
      const merged = mergeAgentConfig(defaultConfig, userOverride)

      // Skip disabled agents (legacy `disable` or new `enabled: false`)
      if (merged.disable) continue
      if (merged.enabled === false) continue

      result[agentId] = merged
    } else {
      // Skip agents with enabled: false (though built-ins shouldn't have this)
      if (defaultConfig.enabled === false) continue

      result[agentId] = defaultConfig
    }
  }

  // Add any new agents from user config (not in defaults)
  if (userAgents) {
    for (const [agentId, userConfig] of Object.entries(userAgents)) {
      if (agentId in defaults) continue // Already processed
      if (userConfig.disable) continue // Skip disabled (legacy)
      if (userConfig.enabled === false) continue // Skip disabled

      // User-defined agents default to specialist: false
      const config: AgentConfig = {
        specialist: false, // Default for user agents
        ...userConfig,
      }

      result[agentId] = config
    }
  }

  return result
}

/**
 * Generate a markdown list of available specialists from agent configs.
 * Only includes agents where specialist === true, excluding orca and planner.
 *
 * @param agentConfigs - Merged agent configurations
 * @returns Markdown formatted list of specialists (e.g., "- **coder**: Implements code...")
 */
export function generateSpecialistList(agentConfigs: Record<string, AgentConfig>): string {
  const specialists: string[] = []

  for (const [agentId, config] of Object.entries(agentConfigs)) {
    // Skip orca and planner - they're orchestration, not specialists
    if (agentId === 'orca' || agentId === 'planner') continue

    // Only include agents marked as specialists
    if (config.specialist !== true) continue

    const description = config.description ?? 'No description'
    specialists.push(`- **${agentId}**: ${description}`)
  }

  return specialists.join('\n')
}

/**
 * Inject the specialist list into the planner's prompt.
 * Replaces the {{SPECIALIST_LIST}} placeholder with the generated list.
 *
 * @param agentConfigs - Merged agent configurations
 * @returns Updated agent configurations with planner prompt modified
 */
export function injectSpecialistList(
  agentConfigs: Record<string, AgentConfig>,
): Record<string, AgentConfig> {
  const planner = agentConfigs.planner
  if (!planner?.prompt) return agentConfigs

  // Only replace if placeholder exists
  if (!planner.prompt.includes(SPECIALIST_LIST_PLACEHOLDER)) {
    return agentConfigs
  }

  const specialistList = generateSpecialistList(agentConfigs)
  const updatedPrompt = planner.prompt.replace(SPECIALIST_LIST_PLACEHOLDER, specialistList)

  return {
    ...agentConfigs,
    planner: {
      ...planner,
      prompt: updatedPrompt,
    },
  }
}
