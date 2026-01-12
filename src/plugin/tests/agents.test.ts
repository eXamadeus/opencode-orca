import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import {
  DEFAULT_AGENTS,
  generateSpecialistList,
  injectSpecialistList,
  mergeAgentConfigs,
  parseAgentConfig,
} from '../agents'
import type { AgentConfig } from '../config'
import { PROTECTED_AGENTS, SPECIALIST_LIST_PLACEHOLDER } from '../constants'
import { RESPONSE_FORMAT_INJECTION_HEADER } from '../response-format'

describe('DEFAULT_AGENTS', () => {
  test('contains all expected agents', () => {
    expect(Object.keys(DEFAULT_AGENTS).sort()).toMatchInlineSnapshot(`
      [
        "architect",
        "coder",
        "document-writer",
        "orca",
        "planner",
        "researcher",
        "reviewer",
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

  test('all subagents have specialist: true', () => {
    const subagents = Object.entries(DEFAULT_AGENTS).filter(
      ([id]) => id !== 'orca' && id !== 'planner',
    )
    for (const [id, config] of subagents) {
      expect(config.specialist).toBe(true)
    }
  })

  test('orca is not a specialist', () => {
    expect(DEFAULT_AGENTS.orca.specialist).toBeFalse()
  })
})

describe('Orca agent prompt', () => {
  test('documents checkpoint handling for supervised agents', () => {
    const orcaPrompt = DEFAULT_AGENTS.orca.prompt ?? ''
    expect(orcaPrompt).toContain('Checkpoint Handling')
    expect(orcaPrompt).toContain('supervised')
    expect(orcaPrompt).toContain('approved_remaining')
  })

  test('does not contain hardcoded specialist list', () => {
    const orcaPrompt = DEFAULT_AGENTS.orca.prompt ?? ''
    // Should not have the old hardcoded "Available specialists:" section
    expect(orcaPrompt).not.toContain('Available specialists:')
    // Should not enumerate specific agents
    expect(orcaPrompt).not.toContain('- **coder**:')
    expect(orcaPrompt).not.toContain('- **planner**:')
    expect(orcaPrompt).not.toContain('- **tester**:')
  })
})

describe('Planner agent prompt', () => {
  test('contains specialist list placeholder before injection', () => {
    // Import the raw planner config before DEFAULT_AGENTS processing
    const { planner } = require('../../agents/planner')
    expect(planner.prompt).toContain(SPECIALIST_LIST_PLACEHOLDER)
  })

  test('contains instruction to only use listed specialists', () => {
    const { planner } = require('../../agents/planner')
    expect(planner.prompt).toContain('You may ONLY assign steps to the following specialists')
    expect(planner.prompt).toContain('Do NOT reference agents outside this list')
  })
})

describe('DEFAULT_AGENTS accepts', () => {
  test('orca has empty accepts', () => {
    expect(DEFAULT_AGENTS.orca.accepts).toEqual([])
  })

  test('planner has empty accepts', () => {
    expect(DEFAULT_AGENTS.planner.accepts).toEqual([])
  })

  test.each([
    'coder',
    'tester',
    'document-writer',
    'architect',
    'researcher',
    'reviewer',
  ] satisfies (keyof typeof DEFAULT_AGENTS)[])('%s has correct accepts', (specialist) => {
    expect(DEFAULT_AGENTS[specialist].accepts).toMatchSnapshot()
  })
})

describe('PROTECTED_AGENTS', () => {
  test('contains orca and planner', () => {
    expect(PROTECTED_AGENTS).toContain('orca')
    expect(PROTECTED_AGENTS).toContain('planner')
  })
})

describe('protected agents in mergeAgentConfigs', () => {
  let warnSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  test('orca config cannot be overridden', () => {
    const defaults: Record<string, AgentConfig> = {
      orca: { mode: 'primary', accepts: [], prompt: 'Default prompt', color: '#000000' },
    }
    const user: Record<string, AgentConfig> = {
      orca: { accepts: ['task'], prompt: 'Custom prompt', model: 'gpt-4o' },
    }
    const result = mergeAgentConfigs(defaults, user)

    // Entire config should be unchanged
    expect(result.orca).toEqual(defaults.orca)
    expect(result.orca.accepts).toEqual([])
    expect(result.orca.prompt).toBe('Default prompt')
    expect(result.orca.model).toBeUndefined()
  })

  test('planner config cannot be overridden', () => {
    const defaults: Record<string, AgentConfig> = {
      planner: {
        mode: 'subagent',
        accepts: ['question'],
        prompt: 'Default planner prompt',
      },
    }
    const user: Record<string, AgentConfig> = {
      planner: { accepts: ['task'], prompt: 'Custom prompt', model: 'gpt-4o' },
    }
    const result = mergeAgentConfigs(defaults, user)

    // Entire config should be unchanged
    expect(result.planner).toEqual(defaults.planner)
    expect(result.planner.accepts).toEqual(['question'])
    expect(result.planner.prompt).toBe('Default planner prompt')
    expect(result.planner.model).toBeUndefined()
  })

  test('emits warning when user tries to override orca', () => {
    const defaults: Record<string, AgentConfig> = {
      orca: { mode: 'primary', accepts: [] },
    }
    const user: Record<string, AgentConfig> = {
      orca: { model: 'gpt-4o' },
    }
    mergeAgentConfigs(defaults, user)

    expect(warnSpy).toHaveBeenCalledWith(
      '[orca] Warning: "orca" agent cannot be overridden. User config ignored.',
    )
  })

  test('emits warning when user tries to override planner', () => {
    const defaults: Record<string, AgentConfig> = {
      planner: { mode: 'subagent' },
    }
    const user: Record<string, AgentConfig> = {
      planner: { model: 'gpt-4o' },
    }
    mergeAgentConfigs(defaults, user)

    expect(warnSpy).toHaveBeenCalledWith(
      '[orca] Warning: "planner" agent cannot be overridden. User config ignored.',
    )
  })

  test('emits warnings for both protected agents when both are overridden', () => {
    const defaults: Record<string, AgentConfig> = {
      orca: { mode: 'primary' },
      planner: { mode: 'subagent' },
    }
    const user: Record<string, AgentConfig> = {
      orca: { model: 'gpt-4o' },
      planner: { model: 'gpt-4o' },
    }
    mergeAgentConfigs(defaults, user)

    expect(warnSpy).toHaveBeenCalledTimes(2)
  })

  test('no warning when user config does not include protected agents', () => {
    const defaults: Record<string, AgentConfig> = {
      orca: { mode: 'primary' },
      coder: { mode: 'subagent' },
    }
    const user: Record<string, AgentConfig> = {
      coder: { model: 'gpt-4o' },
    }
    mergeAgentConfigs(defaults, user)

    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('non-protected agents can override accepts', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', accepts: ['task'] },
    }
    const user: Record<string, AgentConfig> = {
      coder: { accepts: ['question'] },
    }
    const result = mergeAgentConfigs(defaults, user)
    expect(result.coder.accepts).toEqual(['question'])
  })

  test('custom agents can set accepts', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent' },
    }
    const user: Record<string, AgentConfig> = {
      'my-specialist': {
        mode: 'subagent',
        accepts: ['task', 'question'],
      },
    }
    const result = mergeAgentConfigs(defaults, user)
    expect(result['my-specialist'].accepts).toEqual(['task', 'question'])
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

  test('excludes agents with enabled: false', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', prompt: 'Coder' },
      tester: { mode: 'subagent', prompt: 'Tester' },
    }
    const user: Record<string, AgentConfig> = {
      coder: { enabled: false },
    }
    const result = mergeAgentConfigs(defaults, user)

    expect(result.coder).toBeUndefined()
    expect(result.tester).toBeDefined()
  })

  test('excludes custom agents with enabled: false', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent' },
    }
    const user: Record<string, AgentConfig> = {
      'my-specialist': { mode: 'subagent', enabled: false },
    }
    const result = mergeAgentConfigs(defaults, user)

    expect(result.coder).toBeDefined()
    expect(result['my-specialist']).toBeUndefined()
  })

  test('user-defined agents default to specialist: false', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', specialist: true },
    }
    const user: Record<string, AgentConfig> = {
      'my-agent': { mode: 'subagent', prompt: 'Custom agent' },
    }
    const result = mergeAgentConfigs(defaults, user)

    expect(result['my-agent'].specialist).toBe(false)
  })

  test('user-defined agents can override specialist to true', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', specialist: true },
    }
    const user: Record<string, AgentConfig> = {
      'my-agent': { mode: 'subagent', prompt: 'Custom agent', specialist: true },
    }
    const result = mergeAgentConfigs(defaults, user)

    expect(result['my-agent'].specialist).toBe(true)
  })

  test('built-in agents preserve specialist: true when overridden', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', specialist: true },
    }
    const user: Record<string, AgentConfig> = {
      coder: { model: 'gpt-4o' }, // Override without specialist
    }
    const result = mergeAgentConfigs(defaults, user)

    expect(result.coder.specialist).toBe(true)
    expect(result.coder.model).toBe('gpt-4o')
  })

  test('user can explicitly set specialist: false on built-in agents', () => {
    const defaults: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', specialist: true },
    }
    const user: Record<string, AgentConfig> = {
      coder: { specialist: false },
    }
    const result = mergeAgentConfigs(defaults, user)

    expect(result.coder.specialist).toBe(false)
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

describe('generateSpecialistList', () => {
  test('includes agents with specialist: true', () => {
    const agents: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', specialist: true, description: 'Writes code' },
      tester: { mode: 'subagent', specialist: true, description: 'Writes tests' },
    }
    const result = generateSpecialistList(agents)

    expect(result).toContain('- **coder**: Writes code')
    expect(result).toContain('- **tester**: Writes tests')
  })

  test('excludes agents with specialist: false', () => {
    const agents: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', specialist: true, description: 'Writes code' },
      helper: { mode: 'subagent', specialist: false, description: 'Helper agent' },
    }
    const result = generateSpecialistList(agents)

    expect(result).toContain('- **coder**: Writes code')
    expect(result).not.toContain('helper')
  })

  test('excludes agents without specialist flag', () => {
    const agents: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', specialist: true, description: 'Writes code' },
      helper: { mode: 'subagent', description: 'Helper agent' },
    }
    const result = generateSpecialistList(agents)

    expect(result).toContain('- **coder**: Writes code')
    expect(result).not.toContain('helper')
  })

  test('excludes orca even with specialist: true', () => {
    const agents: Record<string, AgentConfig> = {
      orca: { mode: 'primary', specialist: true, description: 'Orchestrator' },
      coder: { mode: 'subagent', specialist: true, description: 'Writes code' },
    }
    const result = generateSpecialistList(agents)

    expect(result).not.toContain('orca')
    expect(result).toContain('- **coder**: Writes code')
  })

  test('excludes planner even with specialist: true', () => {
    const agents: Record<string, AgentConfig> = {
      planner: { mode: 'subagent', specialist: true, description: 'Plans tasks' },
      coder: { mode: 'subagent', specialist: true, description: 'Writes code' },
    }
    const result = generateSpecialistList(agents)

    expect(result).not.toContain('planner')
    expect(result).toContain('- **coder**: Writes code')
  })

  test('uses "No description" when description is missing', () => {
    const agents: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', specialist: true },
    }
    const result = generateSpecialistList(agents)

    expect(result).toBe('- **coder**: No description')
  })

  test('includes user-defined specialists', () => {
    const agents: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', specialist: true, description: 'Writes code' },
      'my-specialist': { mode: 'subagent', specialist: true, description: 'Custom specialist' },
    }
    const result = generateSpecialistList(agents)

    expect(result).toContain('- **coder**: Writes code')
    expect(result).toContain('- **my-specialist**: Custom specialist')
  })

  test('returns empty string when no specialists', () => {
    const agents: Record<string, AgentConfig> = {
      orca: { mode: 'primary', description: 'Orchestrator' },
      helper: { mode: 'subagent', specialist: false, description: 'Helper' },
    }
    const result = generateSpecialistList(agents)

    expect(result).toBe('')
  })
})

describe('injectSpecialistList', () => {
  test('replaces placeholder in planner prompt', () => {
    const agents: Record<string, AgentConfig> = {
      planner: {
        mode: 'subagent',
        prompt: `Available:\n${SPECIALIST_LIST_PLACEHOLDER}\nEnd`,
      },
      coder: { mode: 'subagent', specialist: true, description: 'Writes code' },
    }
    const result = injectSpecialistList(agents)

    expect(result.planner.prompt).not.toContain(SPECIALIST_LIST_PLACEHOLDER)
    expect(result.planner.prompt).toContain('- **coder**: Writes code')
    expect(result.planner.prompt).toContain('Available:')
    expect(result.planner.prompt).toContain('End')
  })

  test('preserves other agents unchanged', () => {
    const agents: Record<string, AgentConfig> = {
      planner: {
        mode: 'subagent',
        prompt: `Specialists:\n${SPECIALIST_LIST_PLACEHOLDER}`,
      },
      coder: { mode: 'subagent', specialist: true, description: 'Writes code' },
      tester: { mode: 'subagent', specialist: true, description: 'Writes tests' },
    }
    const result = injectSpecialistList(agents)

    expect(result.coder).toEqual(agents.coder)
    expect(result.tester).toEqual(agents.tester)
  })

  test('returns unchanged if planner has no prompt', () => {
    const agents: Record<string, AgentConfig> = {
      planner: { mode: 'subagent' },
      coder: { mode: 'subagent', specialist: true, description: 'Writes code' },
    }
    const result = injectSpecialistList(agents)

    expect(result).toEqual(agents)
  })

  test('returns unchanged if planner prompt has no placeholder', () => {
    const agents: Record<string, AgentConfig> = {
      planner: { mode: 'subagent', prompt: 'No placeholder here' },
      coder: { mode: 'subagent', specialist: true, description: 'Writes code' },
    }
    const result = injectSpecialistList(agents)

    expect(result).toEqual(agents)
  })

  test('returns unchanged if no planner agent', () => {
    const agents: Record<string, AgentConfig> = {
      coder: { mode: 'subagent', specialist: true, description: 'Writes code' },
    }
    const result = injectSpecialistList(agents)

    expect(result).toEqual(agents)
  })

  test('works with DEFAULT_AGENTS', () => {
    const result = injectSpecialistList(DEFAULT_AGENTS)

    // Should have replaced the placeholder
    expect(result.planner.prompt).not.toContain(SPECIALIST_LIST_PLACEHOLDER)

    // Should include all built-in specialists
    expect(result.planner.prompt).toContain('- **coder**:')
    expect(result.planner.prompt).toContain('- **tester**:')
    expect(result.planner.prompt).toContain('- **reviewer**:')
    expect(result.planner.prompt).toContain('- **researcher**:')
    expect(result.planner.prompt).toContain('- **document-writer**:')
    expect(result.planner.prompt).toContain('- **architect**:')

    // Should NOT include orca or planner itself
    expect(result.planner.prompt).not.toMatch(/- \*\*orca\*\*:/)
    expect(result.planner.prompt).not.toMatch(/- \*\*planner\*\*:/)
  })
})

describe('parseAgentConfig', () => {
  describe('orca agent', () => {
    test('defaults supervised to false', () => {
      const result = parseAgentConfig('orca', {})
      expect(result.supervised).toBe(false)
    })

    test('defaults specialist to false', () => {
      const result = parseAgentConfig('orca', {})
      expect(result.specialist).toBe(false)
    })

    test('defaults mode to primary', () => {
      const result = parseAgentConfig('orca', {})
      expect(result.mode).toBe('primary')
    })

    test('allows explicit overrides', () => {
      const result = parseAgentConfig('orca', {
        supervised: true,
        specialist: true,
        mode: 'subagent',
      })
      expect(result.supervised).toBe(true)
      expect(result.specialist).toBe(true)
      expect(result.mode).toBe('subagent')
    })

    test('preserves other config values', () => {
      const result = parseAgentConfig('orca', {
        prompt: 'Test prompt',
        model: 'gpt-4o',
        color: '#FF0000',
      })
      expect(result.prompt).toBe('Test prompt')
      expect(result.model).toBe('gpt-4o')
      expect(result.color).toBe('#FF0000')
    })

    test('initializes accepts to empty array', () => {
      const result = parseAgentConfig('orca', {})
      expect(result.accepts).toEqual([])
    })
  })

  describe('planner agent', () => {
    test('defaults supervised to false', () => {
      const result = parseAgentConfig('planner', {})
      expect(result.supervised).toBe(false)
    })

    test('defaults specialist to false', () => {
      const result = parseAgentConfig('planner', {})
      expect(result.specialist).toBe(false)
    })

    test('defaults mode to subagent', () => {
      const result = parseAgentConfig('planner', {})
      expect(result.mode).toBe('subagent')
    })

    test('allows explicit overrides', () => {
      const result = parseAgentConfig('planner', {
        supervised: true,
        specialist: true,
        mode: 'primary',
      })
      expect(result.supervised).toBe(true)
      expect(result.specialist).toBe(true)
      expect(result.mode).toBe('primary')
    })

    test('preserves other config values', () => {
      const result = parseAgentConfig('planner', {
        prompt: 'Planner prompt',
        model: 'claude-3',
        temperature: 0.5,
      })
      expect(result.prompt).toBe('Planner prompt')
      expect(result.model).toBe('claude-3')
      expect(result.temperature).toBe(0.5)
    })

    test('initializes accepts to empty array', () => {
      const result = parseAgentConfig('planner', {})
      expect(result.accepts).toEqual([])
    })
  })

  describe('specialist agents', () => {
    test('defaults to task and question accepts when specialist: true', () => {
      const result = parseAgentConfig('coder', { specialist: true })
      expect(result.accepts).toEqual(['task', 'question'])
    })

    test('does not add accepts when specialist: false', () => {
      const result = parseAgentConfig('coder', { specialist: false })
      expect(result.accepts).toEqual([])
    })

    test('does not add accepts when specialist not set', () => {
      const result = parseAgentConfig('coder', {})
      expect(result.accepts).toEqual([])
    })

    test('defaults to subagent mode when specialist: true and no mode provided', () => {
      const result = parseAgentConfig('coder', { specialist: true })
      expect(result.mode).toBe('subagent')
    })

    test('uses provided mode when specialist: true', () => {
      const result = parseAgentConfig('coder', { specialist: true, mode: 'primary' })
      expect(result.mode).toBe('primary')
    })

    test('provided accepts completely replaces defaults', () => {
      const result = parseAgentConfig('coder', {
        specialist: true,
        accepts: ['task'],
      })
      expect(result.accepts).toEqual(['task'])
      expect(result.accepts).not.toContain('question')
    })

    test('deduplicates accepts using Set', () => {
      const result = parseAgentConfig('coder', {
        accepts: ['question', 'question', 'task'],
      })
      expect(result.accepts).toEqual(['question', 'task'])
    })
  })

  describe('general behavior', () => {
    test('validates config through AgentConfig schema', () => {
      expect(() =>
        parseAgentConfig('test', {
          temperature: 3, // Invalid: max is 2
        }),
      ).toThrow()
    })

    test('allows pass-through fields from loose schema', () => {
      const result = parseAgentConfig('test', {
        customField: 'value',
      } as AgentConfig)
      expect((result as Record<string, unknown>).customField).toBe('value')
    })

    test('provides default accepts as empty array', () => {
      const result = parseAgentConfig('custom-agent', {})
      expect(result.accepts).toEqual([])
    })
  })
})
