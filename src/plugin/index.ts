import { type Plugin, tool } from '@opencode-ai/plugin'
import type { Event, AgentConfig as OpenCodeAgentConfig } from '@opencode-ai/sdk'
import dedent from 'dedent'
import { AgentId } from '../schemas/common'
import { TaskMessage } from '../schemas/messages'
import { DEFAULT_AGENTS, mergeAgentConfigs } from './agents'
import { type AgentConfig, type OrcaSettings, loadUserConfig } from './config'
import { type DispatchContext, dispatchToAgent } from './dispatch'
import { resolveValidationConfig } from './types'
import { runUpdateNotifier } from './update-notifier'
import { getPluginVersion } from './version'

export const createOrcaPlugin = (): Plugin => {
  return async (input) => {
    const { client, directory } = input

    let userConfig: Awaited<ReturnType<typeof loadUserConfig>>
    try {
      userConfig = await loadUserConfig(directory)
    } catch (error) {
      userConfig = undefined
      // Log error but don't crash - use defaults only
      const message = error instanceof Error ? error.message : error
      console.error(`[opencode-orca] Failed to load user config: ${message}`)
    }

    // Merge default agents with user overrides/additions
    const agents = mergeAgentConfigs(DEFAULT_AGENTS, userConfig?.agents)
    const validationConfig = resolveValidationConfig(userConfig?.settings)

    const agentNames = Object.keys(agents).map((name) => `"${name.toLowerCase()}"`)

    // Track plugin entry for update notifier (will be populated in config hook)
    let pluginEntry: string | undefined

    return {
      async config(config) {
        config.agent = config.agent ?? {}

        // Inject all Orca agents
        for (const [agentId, agentConfig] of Object.entries(agents)) {
          config.agent[agentId] = agentConfig
        }

        // Find our plugin entry for update notifier
        pluginEntry = config.plugin?.find(
          (p) => p === '@ex-machina/opencode-orca' || p.startsWith('@ex-machina/opencode-orca@'),
        )
      },

      async event({ event }) {
        // Run update notifier on session creation (fire-and-forget)
        if (event.type === 'session.created') {
          runUpdateNotifier({
            client,
            currentVersion: getPluginVersion(),
            pluginEntry,
            settings: userConfig?.settings,
          }).catch(() => {
            // Silently ignore update notifier errors
          })
        }
      },

      tool: {
        orca_dispatch: tool({
          description: `Route a task message to a specialist agent. Available agents: ${agentNames.join(', ')}`,
          args: TaskMessage.shape,
          async execute(args, ctx) {
            const dispatchCtx: DispatchContext = {
              client,
              agents,
              validationConfig,
              settings: userConfig?.settings,
              abort: ctx.abort,
            }

            return dispatchToAgent(args, dispatchCtx)
          },
        }),
      },

      /**
       * TODO: HITL hooks for observability and future approval gates
       */
      'tool.execute.before': async (input, output) => {
        if (input.tool === 'orca_dispatch') {
          console.log(`[opencode-orca] Dispatching: session=${input.sessionID}`)
        }
      },

      'tool.execute.after': async (input, output) => {
        if (input.tool === 'orca_dispatch') {
          console.log(`[opencode-orca] Dispatch complete: session=${input.sessionID}`)
        }
      },
    }
  }
}

/**
 * Default Orca plugin instance
 *
 * This is the standard export for OpenCode plugin registration.
 * Add to your opencode.jsonc: "plugin": ["@ex-machina/opencode-orca"]
 */
export default createOrcaPlugin()
