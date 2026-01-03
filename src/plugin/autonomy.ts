import type { TaskMessage } from '../schemas/messages'
import type { AgentConfig, AutonomyLevel, OrcaSettings } from './config'

/**
 * Classification of action severity for autonomy gating
 * - routine: Low-risk operations (research, questions, reading)
 * - significant: Medium-risk operations (coding, testing, document writing)
 * - dangerous: High-risk operations (destructive patterns, system changes)
 */
export type ActionClassification = 'routine' | 'significant' | 'dangerous'

/**
 * Gate decision based on autonomy level and action classification
 * - proceed: Execute without user confirmation
 * - require_approval: Wrap in plan/escalation for user approval
 * - block: Reject the operation entirely
 */
export type GateDecision = 'proceed' | 'require_approval' | 'block'

/**
 * Default autonomy level when not specified in config
 */
export const DEFAULT_AUTONOMY_LEVEL: AutonomyLevel = 'supervised'

/**
 * Agents classified by their default risk level
 */
const ROUTINE_AGENTS = new Set(['researcher', 'reviewer'])
const SIGNIFICANT_AGENTS = new Set(['coder', 'tester', 'document-writer', 'strategist'])
const DANGEROUS_AGENTS = new Set<string>() // Currently none by default

/**
 * Patterns in prompts that indicate dangerous operations
 * These trigger elevated classification regardless of target agent
 */
const DANGEROUS_PATTERNS = [
  /\bdelete\b/i,
  /\bdrop\b/i,
  /\bremove\s+all\b/i,
  /\btruncate\b/i,
  /\bwipe\b/i,
  /\bdestroy\b/i,
  /\brm\s+-rf\b/i,
  /\bforce\s+push\b/i,
  /--force\b/i, // No leading word boundary - dashes break \b
  /\breset\s+--hard\b/i,
]

/**
 * Patterns that indicate significant operations
 */
const SIGNIFICANT_PATTERNS = [
  /\bmodify\b/i,
  /\bupdate\b/i,
  /\bchange\b/i,
  /\bcreate\b/i,
  /\bwrite\b/i,
  /\bimplement\b/i,
  /\brefactor\b/i,
  /\bfix\b/i,
  /\badd\b/i,
  /\bmigrat/i,
  /\bdeploy/i,
  /\binstall\b/i,
]

/**
 * Resolve autonomy level from settings with default fallback
 *
 * @param settings - Orca settings (optional)
 * @returns The resolved autonomy level
 */
export function resolveAutonomyLevel(settings?: OrcaSettings): AutonomyLevel {
  return settings?.autonomy ?? DEFAULT_AUTONOMY_LEVEL
}

/**
 * Classify an action based on target agent and prompt content
 *
 * Classification priority:
 * 1. Dangerous patterns in prompt → dangerous
 * 2. Dangerous agent → dangerous
 * 3. Significant agent → significant
 * 4. Significant patterns in prompt → significant
 * 5. Routine agent → routine
 * 6. Default → routine
 *
 * @param task - The task message being dispatched
 * @param agents - Available agent configurations (for potential future use)
 * @returns The action classification
 */
export function classifyAction(
  task: TaskMessage,
  _agents: Record<string, AgentConfig>,
): ActionClassification {
  const { agent_id: targetAgentId, prompt } = task.payload

  // Check for dangerous patterns first (highest priority)
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(prompt)) {
      return 'dangerous'
    }
  }

  // Check agent classification
  if (DANGEROUS_AGENTS.has(targetAgentId)) {
    return 'dangerous'
  }

  if (SIGNIFICANT_AGENTS.has(targetAgentId)) {
    return 'significant'
  }

  // Check for significant patterns in prompt
  for (const pattern of SIGNIFICANT_PATTERNS) {
    if (pattern.test(prompt)) {
      return 'significant'
    }
  }

  if (ROUTINE_AGENTS.has(targetAgentId)) {
    return 'routine'
  }

  // Default to routine for unknown agents (conservative for new agents)
  return 'routine'
}

/**
 * Determine gate decision based on autonomy level and action classification
 *
 * Decision matrix:
 *
 * | Level      | Routine  | Significant      | Dangerous        |
 * |------------|----------|------------------|------------------|
 * | supervised | approval | approval         | block            |
 * | assisted   | proceed  | approval         | block            |
 * | autonomous | proceed  | proceed          | approval         |
 *
 * @param level - Current autonomy level
 * @param classification - Action classification
 * @returns The gate decision
 */
export function determineGate(
  level: AutonomyLevel,
  classification: ActionClassification,
): GateDecision {
  switch (level) {
    case 'supervised':
      // All actions require approval except dangerous which are blocked
      if (classification === 'dangerous') return 'block'
      return 'require_approval'

    case 'assisted':
      // Routine auto-approved, significant needs approval, dangerous blocked
      if (classification === 'dangerous') return 'block'
      if (classification === 'significant') return 'require_approval'
      return 'proceed'

    case 'autonomous':
      // Everything auto-approved except dangerous which needs approval
      if (classification === 'dangerous') return 'require_approval'
      return 'proceed'

    default:
      // Unknown level - be conservative
      return 'require_approval'
  }
}

/**
 * Configuration for autonomy behavior
 */
export interface AutonomyConfig {
  /** Current autonomy level */
  level: AutonomyLevel
  /** Maximum retry attempts for assisted mode (default: 2) */
  maxRetries: number
}

/**
 * Default autonomy configuration
 */
export const DEFAULT_AUTONOMY_CONFIG: AutonomyConfig = {
  level: DEFAULT_AUTONOMY_LEVEL,
  maxRetries: 2,
}

/**
 * Resolve full autonomy config from settings
 */
export function resolveAutonomyConfig(settings?: OrcaSettings): AutonomyConfig {
  return {
    level: resolveAutonomyLevel(settings),
    maxRetries: DEFAULT_AUTONOMY_CONFIG.maxRetries,
  }
}
