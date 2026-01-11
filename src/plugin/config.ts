import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import dedent from 'dedent'
import { z } from 'zod'
import { AgentId, SessionId, Timestamp } from '../schemas/common'
import {
  AnswerMessage,
  FailureMessage,
  type MessageType,
  PlanMessage,
  QuestionMessage,
  SuccessMessage,
} from '../schemas/messages'

export const PermissionConfig = z
  .strictObject({
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
  .describe('Permission settings for agent actions')
export type PermissionConfig = z.infer<typeof PermissionConfig>

export const ResponseType = z
  .enum(['answer', 'success', 'plan', 'question', 'failure'] satisfies MessageType[])
  .describe('Response types that can be returned by user-configurable agents')
export type ResponseType = z.infer<typeof ResponseType>

export const AgentConfig = z
  .looseObject({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    prompt: z.string().optional(),
    tools: z.record(z.string(), z.boolean()).optional(),
    disable: z.boolean().optional().describe('Whether to disable this agent'),
    description: z.string().optional(),
    mode: z.enum(['subagent', 'primary', 'all']).optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    maxSteps: z.number().int().positive().optional(),
    permission: PermissionConfig.optional(),
    supervised: z
      .boolean()
      .optional()
      .describe('Whether this agent requires approval before dispatch'),
    responseTypes: z
      .array(ResponseType)
      .optional()
      .describe(dedent`
      Message types this agent can respond with.
      Used to generate format instructions in the prompt.
      Defaults to ['answer', 'failure'] for subagents.
    `),
    specialist: z
      .boolean()
      .optional()
      .describe(dedent`
      Whether this agent appears in Orca's "Available specialists" list.
      Defaults to true for built-in subagents, false for user-defined agents.
    `),
  })
  .describe(dedent`
    Agent configuration for the Orca plugin.
    Matches OpenCode's AgentConfig structure.
  `)
export type AgentConfig = z.infer<typeof AgentConfig>

export const OrcaSettings = z
  .strictObject({
    defaultSupervised: z
      .boolean()
      .optional()
      .describe('Whether agents require approval by default'),
    defaultModel: z.string().optional().describe("Default model for agents that don't specify one"),
    validation: z
      .strictObject({
        maxRetries: z
          .number()
          .int()
          .min(0)
          .max(10)
          .optional()
          .describe('Max retries for validation failures'),

        wrapPlainText: z
          .boolean()
          .optional()
          .describe('Wrap plain text responses in result messages'),
      })
      .optional()
      .describe('Validation settings'),
    updateNotifier: z
      .boolean()
      .default(true)
      .optional()
      .describe('Show notifications about plugin updates (default: true)'),
  })
  .describe('Orca specific settings')
export type OrcaSettings = z.infer<typeof OrcaSettings>

export const OrcaUserConfig = z
  .strictObject({
    agents: z
      .record(AgentId, AgentConfig)
      .default({})
      .describe('Agent configurations for override or new agents'),
    settings: OrcaSettings.default(OrcaSettings.parse({})).describe('Global Orca settings'),
  })
  .describe(dedent`
    User configuration for the Orca plugin.
    
    Supports:
    - Overriding default agent settings (partial configs)
    - Adding completely new custom agents (full configs)
    - Global Orca settings (default supervision, default model)
  `)

export type OrcaUserConfig = z.infer<typeof OrcaUserConfig>

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
  const result = OrcaUserConfig.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid ${USER_CONFIG_PATH}:\n${issues}`)
  }

  return result.data
}
