import { type Plugin, tool } from '@opencode-ai/plugin'
import { DispatchPayload } from '../schemas/messages'
import { DEFAULT_AGENTS, mergeAgentConfigs } from './agents'
import { loadUserConfig } from './config'
import { type DispatchContext, dispatchToAgent } from './dispatch'
import { resolveValidationConfig } from './types'
import { runUpdateNotifier } from './update-notifier'
import { getPluginVersion } from './version'

export const createOrcaPlugin = (): Plugin => {
  return async (input) => {
    const { client, directory } = input

    let userConfig: Awaited<ReturnType<typeof loadUserConfig>>
    let configLoadError: string | undefined
    try {
      userConfig = await loadUserConfig(directory)
    } catch (error) {
      userConfig = undefined
      configLoadError = error instanceof Error ? error.message : String(error)
      console.error(`[opencode-orca] Failed to load user config: ${configLoadError}`)
    }

    // Merge default agents with user overrides/additions
    const agents = mergeAgentConfigs(DEFAULT_AGENTS, userConfig?.agents)
    const validationConfig = resolveValidationConfig(userConfig?.settings)

    // Track plugin entry for update notifier (will be populated in config hook)
    let pluginEntry: string | undefined
    let hasRunUpdateNotifier = false

    return {
      tool: {
        orca_dispatch: tool({
          description:
            'Dispatches a message to a specified agent with an optional session ID to maintain long conversations.',
          args: DispatchPayload.shape,
          execute: async (args, ctx) => {
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
        // Only run once per startup
        if (hasRunUpdateNotifier) return

        // Skip sub-sessions (background tasks)
        const props = event.properties as { info?: { parentID?: string } } | undefined
        if (props?.info?.parentID) return

        hasRunUpdateNotifier = true

        // Show config error toast on first interaction (TUI not ready during init)
        if (configLoadError) {
          setTimeout(() => {
            client.tui
              .showToast({
                body: {
                  title: 'Orca Config Error',
                  message: configLoadError,
                  variant: 'error',
                  duration: 20_000,
                },
              })
              .catch(() => {})
          }, 0)
        }

        // Run update notifier on first interaction (uses internal caching for npm checks)
        setTimeout(() => {
          runUpdateNotifier({
            client,
            currentVersion: getPluginVersion(),
            pluginEntry,
            settings: userConfig?.settings,
          }).catch(() => {
            // Silently ignore update notifier errors
          })
        }, 0)
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
