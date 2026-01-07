import { describe, expect, test } from 'bun:test'
import { DEFAULT_AGENTS, PROTECTED_AGENTS, mergeAgentConfigs } from '../agents'
import type { AgentConfig } from '../config'
import { RESPONSE_FORMAT_INJECTION_HEADER } from '../response-format'

describe('DEFAULT_AGENTS', () => {
  test('contains all expected agents', () => {
    expect(Object.keys(DEFAULT_AGENTS).sort()).toMatchInlineSnapshot(`
      [
        "architect",
        "coder",
        "document-writer",
        "orca",
        "researcher",
        "reviewer",
        "strategist",
        "tester",
      ]
    `)
  })

  test('orca is the primary agent', () => {
    expect(DEFAULT_AGENTS.orca.mode).toBe('primary')
  })

  test('all specialists are subagents', () => {
    const specialists = Object.entries(DEFAULT_AGENTS).filter(([id]) => id !== 'orca')
    for (const [_, config] of specialists) {
      expect(config.mode).toBe('subagent')
    }
  })

  test('all agents have valid hex colors', () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/
    for (const [_, config] of Object.entries(DEFAULT_AGENTS)) {
      expect(config.color).toMatch(hexColorRegex)
    }
  })

  test('all agents have descriptions', () => {
    for (const [id, config] of Object.entries(DEFAULT_AGENTS)) {
      expect(config.description).toBeDefined()
      expect(config.description?.length).toBeGreaterThan(10)
    }
  })

  test('all subagents have prompts with response format injection', () => {
    for (const [id, config] of Object.entries(DEFAULT_AGENTS)) {
      expect(config.prompt).toBeDefined()
      if (id === 'orca') {
        // Orca doesn't get response format injection
        expect(config.prompt).not.toContain(RESPONSE_FORMAT_INJECTION_HEADER)
      } else {
        expect(config.prompt).toContain(RESPONSE_FORMAT_INJECTION_HEADER)
      }
    }
  })
})

describe('Orca agent prompt', () => {
  test('documents checkpoint handling for supervised agents', () => {
    const orcaPrompt = DEFAULT_AGENTS.orca.prompt ?? ''
    expect(orcaPrompt).toContain('Checkpoint Handling')
    expect(orcaPrompt).toContain('supervised')
    expect(orcaPrompt).toContain('approved_remaining')
  })
})

describe('DEFAULT_AGENTS responseTypes', () => {
  test('orca has empty responseTypes', () => {
    expect(DEFAULT_AGENTS.orca.responseTypes).toEqual([])
  })

  test('strategist has full responseTypes', () => {
    expect(DEFAULT_AGENTS.strategist.responseTypes).toEqual([
      'plan',
      'question',
      'escalation',
      'answer',
      'failure',
    ])
  })

  test('specialists have default responseTypes', () => {
    const specialists = [
      'coder',
      'tester',
      'reviewer',
      'researcher',
      'document-writer',
      'architect',
    ]
    for (const id of specialists) {
      expect(DEFAULT_AGENTS[id].responseTypes).toEqual(['answer', 'failure'])
    }
  })
})

describe('PROTECTED_AGENTS', () => {
  test('contains orca and strategist', () => {
    expect(PROTECTED_AGENTS).toContain('orca')
    expect(PROTECTED_AGENTS).toContain('strategist')
  })
})

describe('protected agents in mergeAgentConfigs', () => {
  test('orca responseTypes cannot be overridden', () => {
    const defaults: Record<string, AgentConfig> = {
      orca: { mode: 'primary', responseTypes: [] },
    }
    const user: Record<string, AgentConfig> = {
      orca: { responseTypes: ['answer'] },
    }
    const result = mergeAgentConfigs(defaults, user)
    expect(result.orca.responseTypes).toEqual([])
  })

  test('strategist responseTypes cannot be overridden', () => {
    const defaults: Record<string, AgentConfig> = {
      strategist: {
        mode: 'subagent',
        responseTypes: ['plan', 'question', 'escalation', 'answer', 'failure'],
      },
    }
    const user: Record<string, AgentConfig> = {
      strategist: { responseTypes: ['answer'] },
    }
    const result = mergeAgentConfigs(defaults, user)
    expect(result.strategist.responseTypes).toEqual([
      'plan',
      'question',
      'escalation',
      'answer',
      'failure',
    ])
  })

  test('non-protected agents can override responseTypes', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', responseTypes: ['answer', 'failure'] },
    }
    const user: Record<string, AgentConfig> = {
      coder: { responseTypes: ['answer', 'question'] },
    }
    const result = mergeAgentConfigs(defaults, user)
    expect(result.coder.responseTypes).toEqual(['answer', 'question'])
  })

  test('custom agents can set responseTypes', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent' },
    }
    const user: Record<string, AgentConfig> = {
      'my-specialist': {
        mode: 'subagent',
        responseTypes: ['answer', 'question'],
      },
    }
    const result = mergeAgentConfigs(defaults, user)
    expect(result['my-specialist'].responseTypes).toEqual(['answer', 'question'])
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
