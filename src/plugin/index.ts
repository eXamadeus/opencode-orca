import { type Plugin, tool } from '@opencode-ai/plugin'
import type { AgentConfig as OpenCodeAgentConfig } from '@opencode-ai/sdk'
import { DEFAULT_AGENTS, mergeAgentConfigs } from './agents'
import { resolveAutonomyConfig } from './autonomy'
import { type AgentConfig, type OrcaSettings, loadUserConfig } from './config'
import { type DispatchContext, dispatchToAgent } from './dispatch'
import { resolveValidationConfig } from './types'

/**
 * Convert our AgentConfig to OpenCode's AgentConfig format
 * They're compatible but we need to ensure type safety
 */
function toOpenCodeAgentConfig(config: AgentConfig): OpenCodeAgentConfig {
  return config as OpenCodeAgentConfig
}

/**
 * Create the Orca plugin instance
 *
 * This is the factory function that creates a configured plugin.
 * Use this if you need to customize plugin behavior before initialization.
 */
export const createOrcaPlugin = (): Plugin => {
  return async (input) => {
    const { client, directory } = input

    // Load user config (graceful fallback if missing)
    let userConfig: Awaited<ReturnType<typeof loadUserConfig>>
    try {
      userConfig = await loadUserConfig(directory)
    } catch (err) {
      // Log error but don't crash - use defaults only
      console.error(
        `[opencode-orca] Failed to load user config: ${err instanceof Error ? err.message : err}`,
      )
      userConfig = undefined
    }

    // Merge default agents with user overrides/additions
    const agents = mergeAgentConfigs(DEFAULT_AGENTS, userConfig?.agents)

    // Resolve validation config from user settings
    const validationConfig = resolveValidationConfig(userConfig?.settings)

    // Resolve autonomy config from user settings
    const autonomyConfig = resolveAutonomyConfig(userConfig?.settings)

    return {
      /**
       * Config hook - injects Orca agent definitions into OpenCode
       */
      async config(config) {
        // Initialize agent record if needed
        config.agent = config.agent ?? {}

        // Inject all Orca agents
        for (const [agentId, agentConfig] of Object.entries(agents)) {
          config.agent[agentId] = toOpenCodeAgentConfig(agentConfig)
        }
      },

      /**
       * Tool definitions for Orca agent orchestration
       */
      tool: {
        /**
         * orca_dispatch - Route a task message to a specialist agent
         *
         * This tool enables the Orca orchestrator to dispatch typed messages
         * to specialist agents with validation, retry logic, and graceful degradation.
         */
        orca_dispatch: tool({
          description:
            'Route a task message to a specialist agent. Input must be a JSON TaskMessage envelope with type, session_id, timestamp, and payload (agent_id, prompt, context?, parent_session_id?).',
          args: {
            message: tool.schema.string().describe('JSON TaskMessage envelope to dispatch'),
          },
          async execute(args, ctx) {
            const dispatchCtx: DispatchContext = {
              client,
              agents,
              validationConfig,
              autonomyConfig,
              abort: ctx.abort,
            }

            return dispatchToAgent(args.message, dispatchCtx)
          },
        }),
      },

      /**
       * HITL hooks for observability and autonomy enforcement logging
       */
      'tool.execute.before': async (input, _output) => {
        if (input.tool === 'orca_dispatch') {
          // Log dispatch request with autonomy context for observability
          console.log(
            `[opencode-orca] Dispatching: session=${input.sessionID} autonomy=${autonomyConfig.level}`,
          )
        }
      },

      'tool.execute.after': async (input, output) => {
        if (input.tool === 'orca_dispatch') {
          // Parse result to determine outcome
          let outcome = 'unknown'
          try {
            const result = JSON.parse(output.output)
            if (result.type === 'failure') {
              outcome = `failure:${result.payload?.code ?? 'unknown'}`
            } else if (result.type === 'escalation') {
              outcome = 'escalation:approval_required'
            } else {
              outcome = `success:${result.type}`
            }
          } catch {
            outcome = 'parse_error'
          }

          console.log(
            `[opencode-orca] Dispatch complete: session=${input.sessionID} outcome=${outcome}`,
          )
        }
      },
    }
  }
}

/**
 * Default Orca plugin instance
 *
 * This is the standard export for OpenCode plugin registration.
 * Add to your opencode.jsonc: "plugin": ["opencode-orca"]
 */
export default createOrcaPlugin()
