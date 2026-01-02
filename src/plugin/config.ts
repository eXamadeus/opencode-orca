import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'

/**
 * Autonomy levels for Orca orchestration
 * - supervised: All actions require approval
 * - assisted: Routine actions auto-approved, significant actions require approval
 * - autonomous: All actions auto-approved (use with caution)
 */
export const AutonomyLevelSchema = z.enum(['supervised', 'assisted', 'autonomous'])
export type AutonomyLevel = z.infer<typeof AutonomyLevelSchema>

/**
 * Permission settings for agent actions
 */
export const PermissionConfigSchema = z
  .object({
    edit: z.enum(['ask', 'allow', 'deny']).optional(),
    bash: z
      .union([
        z.enum(['ask', 'allow', 'deny']),
        z.record(z.string(), z.enum(['ask', 'allow', 'deny'])),
      ])
      .optional(),
    webfetch: z.enum(['ask', 'allow', 'deny']).optional(),
    doom_loop: z.enum(['ask', 'allow', 'deny']).optional(),
    external_directory: z.enum(['ask', 'allow', 'deny']).optional(),
  })
  .strict()

export type PermissionConfig = z.infer<typeof PermissionConfigSchema>

/**
 * Agent configuration that can be provided by users
 * Matches OpenCode's AgentConfig structure
 */
export const AgentConfigSchema = z
  .object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    prompt: z.string().optional(),
    tools: z.record(z.string(), z.boolean()).optional(),
    disable: z.boolean().optional(),
    description: z.string().optional(),
    mode: z.enum(['subagent', 'primary', 'all']).optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    maxSteps: z.number().int().positive().optional(),
    permission: PermissionConfigSchema.optional(),
  })
  .strict()

export type AgentConfig = z.infer<typeof AgentConfigSchema>

/**
 * Orca-specific settings
 */
export const OrcaSettingsSchema = z
  .object({
    /** Default autonomy level for all agents */
    autonomy: AutonomyLevelSchema.optional(),
    /** Default model for agents that don't specify one */
    defaultModel: z.string().optional(),
    /** Validation settings */
    validation: z
      .object({
        /** Max retries for message validation failures (default: 3) */
        maxRetries: z.number().int().min(0).max(10).optional(),
        /** Wrap plain text responses in result messages (default: true) */
        wrapPlainText: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export type OrcaSettings = z.infer<typeof OrcaSettingsSchema>

/**
 * User configuration schema for .opencode/orca.json
 *
 * Supports:
 * - Overriding default agent settings (partial configs)
 * - Adding completely new custom agents (full configs)
 * - Global Orca settings (autonomy level, default model)
 */
export const OrcaUserConfigSchema = z
  .object({
    /** Agent configurations - overrides or new agents */
    agents: z.record(z.string(), AgentConfigSchema).optional(),
    /** Global Orca settings */
    settings: OrcaSettingsSchema.optional(),
  })
  .strict()

export type OrcaUserConfig = z.infer<typeof OrcaUserConfigSchema>

/** Path to the user config file relative to the project root */
export const USER_CONFIG_PATH = '.opencode/orca.json'

/**
 * Load user configuration from .opencode/orca.json
 *
 * @param directory - Project root directory
 * @returns Validated user config, or undefined if file doesn't exist
 * @throws Error if a file exists but is invalid JSON or fails validation
 */
export async function loadUserConfig(directory: string): Promise<OrcaUserConfig | undefined> {
  const configPath = join(directory, USER_CONFIG_PATH)

  // Graceful fallback: no config file is fine
  if (!existsSync(configPath)) {
    return undefined
  }

  // File exists - parse and validate
  let raw: unknown
  try {
    const content = await readFile(configPath, 'utf-8')
    raw = JSON.parse(content)
  } catch (err) {
    throw new Error(
      `Failed to parse ${USER_CONFIG_PATH}: ${err instanceof Error ? err.message : 'Invalid JSON'}`,
    )
  }

  // Validate with Zod
  const result = OrcaUserConfigSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid ${USER_CONFIG_PATH}:\n${issues}`)
  }

  return result.data
}
