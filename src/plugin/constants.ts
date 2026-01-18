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

/** Timeout for HITL questions before they are considered abandoned (30 minutes) */
export const QUESTION_TIMEOUT_MS = 30 * 60 * 1000
