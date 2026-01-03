import { describe, expect, test } from 'bun:test'
import { DEFAULT_AGENTS, PROTOCOL_INJECTION, mergeAgentConfigs } from './agents'
import type { AgentConfig } from './config'

describe('DEFAULT_AGENTS', () => {
  test('contains all expected agents', () => {
    const expectedAgents = [
      'orca',
      'strategist',
      'coder',
      'tester',
      'reviewer',
      'researcher',
      'document-writer',
      'architect',
    ]
    expect(Object.keys(DEFAULT_AGENTS).sort()).toEqual(expectedAgents.sort())
  })

  test('orca is the primary agent', () => {
    expect(DEFAULT_AGENTS.orca.mode).toBe('primary')
  })

  test('all specialists are subagents', () => {
    const specialists = Object.entries(DEFAULT_AGENTS).filter(([id]) => id !== 'orca')
    for (const [id, config] of specialists) {
      expect(config.mode).toBe('subagent')
    }
  })

  test('all agents have valid hex colors', () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/
    for (const [id, config] of Object.entries(DEFAULT_AGENTS)) {
      expect(config.color).toMatch(hexColorRegex)
    }
  })

  test('all agents have descriptions', () => {
    for (const [id, config] of Object.entries(DEFAULT_AGENTS)) {
      expect(config.description).toBeDefined()
      expect(config.description?.length).toBeGreaterThan(10)
    }
  })

  test('all agents have prompts with protocol injection', () => {
    for (const [id, config] of Object.entries(DEFAULT_AGENTS)) {
      expect(config.prompt).toBeDefined()
      expect(config.prompt).toContain('Orca Communication Protocol')
    }
  })
})

describe('PROTOCOL_INJECTION', () => {
  test('contains protocol header', () => {
    expect(PROTOCOL_INJECTION).toContain('## Orca Communication Protocol')
  })

  test('documents all message types', () => {
    const expectedTypes = [
      'task',
      'result',
      'question',
      'answer',
      'failure',
      'plan',
      'escalation',
      'interrupt',
      'user_input',
    ]
    for (const type of expectedTypes) {
      expect(PROTOCOL_INJECTION).toContain(`**${type}**`)
    }
  })

  test('includes JSON schema in expandable section', () => {
    expect(PROTOCOL_INJECTION).toContain('<details>')
    expect(PROTOCOL_INJECTION).toContain('Full JSON Schema')
    expect(PROTOCOL_INJECTION).toContain('</details>')
  })
})

describe('mergeAgentConfigs', () => {
  test('returns defaults when no user config provided', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', prompt: 'Default prompt' },
    }
    const result = mergeAgentConfigs(defaults)
    expect(result).toEqual(defaults)
  })

  test('returns defaults when user config is empty', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', prompt: 'Default prompt' },
    }
    const result = mergeAgentConfigs(defaults, {})
    expect(result).toEqual(defaults)
  })

  test('merges user overrides with defaults', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', prompt: 'Default prompt', color: '#000000' },
    }
    const user: Record<string, AgentConfig> = {
      coder: { model: 'gpt-4o' },
    }
    const result = mergeAgentConfigs(defaults, user)

    // User's model applied
    expect(result.coder.model).toBe('gpt-4o')
    // Defaults preserved
    expect(result.coder.prompt).toBe('Default prompt')
    expect(result.coder.color).toBe('#000000')
    expect(result.coder.mode).toBe('subagent')
  })

  test('user values override defaults for same field', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', prompt: 'Default prompt' },
    }
    const user: Record<string, AgentConfig> = {
      coder: { prompt: 'Custom prompt' },
    }
    const result = mergeAgentConfigs(defaults, user)
    expect(result.coder.prompt).toBe('Custom prompt')
    expect(result.coder.mode).toBe('subagent')
  })

  test('excludes disabled agents', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', prompt: 'Coder' },
      tester: { mode: 'subagent', prompt: 'Tester' },
    }
    const user: Record<string, AgentConfig> = {
      coder: { disable: true },
    }
    const result = mergeAgentConfigs(defaults, user)

    expect(result.coder).toBeUndefined()
    expect(result.tester).toBeDefined()
  })

  test('adds new custom agents from user config', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', prompt: 'Coder' },
    }
    const user: Record<string, AgentConfig> = {
      'my-specialist': { mode: 'subagent', prompt: 'Custom specialist', color: '#FF0000' },
    }
    const result = mergeAgentConfigs(defaults, user)

    expect(result.coder).toBeDefined()
    expect(result['my-specialist']).toBeDefined()
    expect(result['my-specialist'].prompt).toBe('Custom specialist')
  })

  test('excludes disabled custom agents', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent' },
    }
    const user: Record<string, AgentConfig> = {
      'my-specialist': { mode: 'subagent', disable: true },
    }
    const result = mergeAgentConfigs(defaults, user)

    expect(result.coder).toBeDefined()
    expect(result['my-specialist']).toBeUndefined()
  })

  test('deep merges nested objects (tools)', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: {
        mode: 'subagent',
        tools: { read: true, edit: true, bash: false },
      },
    }
    const user: Record<string, AgentConfig> = {
      coder: {
        tools: { bash: true, webfetch: true },
      },
    }
    const result = mergeAgentConfigs(defaults, user)

    expect(result.coder.tools).toEqual({
      read: true, // preserved from default
      edit: true, // preserved from default
      bash: true, // overridden by user
      webfetch: true, // added by user
    })
  })

  test('deep merges nested objects (permission)', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: {
        mode: 'subagent',
        permission: { edit: 'ask', bash: 'deny' },
      },
    }
    const user: Record<string, AgentConfig> = {
      coder: {
        permission: { bash: 'allow' },
      },
    }
    const result = mergeAgentConfigs(defaults, user)

    expect(result.coder.permission).toEqual({
      edit: 'ask', // preserved from default
      bash: 'allow', // overridden by user
    })
  })

  test('preserves pass-through provider options during merge', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', prompt: 'Default' },
    }
    const user: Record<string, AgentConfig> = {
      coder: {
        model: 'openai/o1',
        reasoningEffort: 'high', // pass-through option
      } as AgentConfig,
    }
    const result = mergeAgentConfigs(defaults, user)

    expect(result.coder.model).toBe('openai/o1')
    expect((result.coder as Record<string, unknown>).reasoningEffort).toBe('high')
    expect(result.coder.prompt).toBe('Default')
  })

  test('handles undefined values in user config gracefully', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', prompt: 'Default', color: '#000000' },
    }
    const user: Record<string, AgentConfig> = {
      coder: { model: 'gpt-4o', color: undefined },
    }
    const result = mergeAgentConfigs(defaults, user)

    expect(result.coder.model).toBe('gpt-4o')
    expect(result.coder.color).toBe('#000000') // undefined doesn't override
  })
})
