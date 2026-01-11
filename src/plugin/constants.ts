/**
 * Constants for the Orca plugin.
 *
 * This file contains constants that need to be imported by agent definitions
 * without creating circular dependencies. Keep this file dependency-free.
 */

/**
 * Placeholder in planner prompt that gets replaced with the specialist list
 */
export const SPECIALIST_LIST_PLACEHOLDER = '{{SPECIALIST_LIST}}'

/**
 * Core orchestration agents that cannot be overridden by user configuration.
 * User config for these agents is completely ignored to ensure system integrity.
 */
export const PROTECTED_AGENTS = ['orca', 'planner'] as const
