import { describe, expect, test } from 'bun:test'
import type { PluginInput } from '@opencode-ai/plugin'
import type { Config } from '@opencode-ai/sdk'
import { DEFAULT_AGENTS } from '../agents'
import { createOrcaPlugin } from '../index'

// Mock the plugin input - using type assertion to avoid needing full mock
const createMockInput = (directory: string): PluginInput =>
  ({
    client: {},
    project: { id: 'test-project' },
    directory,
    worktree: directory,
    serverUrl: new URL('http://localhost:3000'),
    $: {},
  }) as unknown as PluginInput

describe('createOrcaPlugin', () => {
  describe('default agent injection', () => {
    test('injects all default agents into config', async () => {
      const plugin = createOrcaPlugin()
      const hooks = await plugin(createMockInput('/tmp/test-project'))

      const config: Partial<Config> = {}
      if (hooks.config) {
        await hooks.config(config as Config)
      }

      // Verify all default agents are injected
      expect(config.agent).toBeDefined()
      const agents = config.agent ?? {}
      for (const agentId of Object.keys(DEFAULT_AGENTS)) {
        expect(agents[agentId]).toBeDefined()
        expect(agents[agentId]?.description).toBe(DEFAULT_AGENTS[agentId].description)
      }
    })

    test('sets orca as primary agent', async () => {
      const plugin = createOrcaPlugin()
      const hooks = await plugin(createMockInput('/tmp/test-project'))

      const config: Partial<Config> = {}
      if (hooks.config) {
        await hooks.config(config as Config)
      }

      const agents = config.agent ?? {}
      expect(agents.orca?.mode).toBe('primary')
    })

    test('sets specialists as subagents', async () => {
      const plugin = createOrcaPlugin()
      const hooks = await plugin(createMockInput('/tmp/test-project'))

      const config: Partial<Config> = {}
      if (hooks.config) {
        await hooks.config(config as Config)
      }

      const agents = config.agent ?? {}
      const specialists = [
        'planner',
        'coder',
        'tester',
        'reviewer',
        'researcher',
        'document-writer',
        'architect',
      ]
      for (const specialist of specialists) {
        expect(agents[specialist]?.mode).toBe('subagent')
      }
    })

    test('preserves existing config.agent entries', async () => {
      const plugin = createOrcaPlugin()
      const hooks = await plugin(createMockInput('/tmp/test-project'))

      const config: Partial<Config> = {
        agent: {
          'custom-agent': {
            mode: 'subagent',
            description: 'A custom agent',
            prompt: 'Custom prompt',
          },
        },
      }
      if (hooks.config) {
        await hooks.config(config as Config)
      }

      const agents = config.agent ?? {}

      // Custom agent should still exist
      expect(agents['custom-agent']).toBeDefined()
      expect(agents['custom-agent']?.description).toBe('A custom agent')

      // Orca agents should also be present
      expect(agents.orca).toBeDefined()
    })

    test('initializes config.agent if undefined', async () => {
      const plugin = createOrcaPlugin()
      const hooks = await plugin(createMockInput('/tmp/test-project'))

      const config: Partial<Config> = {}
      if (hooks.config) {
        await hooks.config(config as Config)
      }

      expect(config.agent).toBeDefined()
      expect(typeof config.agent).toBe('object')
    })
  })

  describe('graceful fallback', () => {
    test('works when user config does not exist', async () => {
      const plugin = createOrcaPlugin()
      // Use a directory that doesn't have .opencode/orca.json
      const hooks = await plugin(createMockInput('/tmp/nonexistent-project'))

      const config: Partial<Config> = {}
      if (hooks.config) {
        await hooks.config(config as Config)
      }

      // Should still inject default agents
      expect(config.agent).toBeDefined()
      const agents = config.agent ?? {}
      expect(agents.orca).toBeDefined()
    })
  })

  describe('tool hook', () => {
    test('exposes empty tool object for future orca_dispatch', async () => {
      const plugin = createOrcaPlugin()
      const hooks = await plugin(createMockInput('/tmp/test-project'))

      expect(hooks.tool).toBeDefined()
      expect(typeof hooks.tool).toBe('object')
    })
  })
})
