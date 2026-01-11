import { describe, expect, test } from 'bun:test'
import { merge } from 'lodash'
import { AgentConfig, OrcaSettings, OrcaUserConfig, PermissionConfig } from '../config'

describe('config', () => {
  describe('PermissionConfig', () => {
    const withDefaults = (config: Partial<PermissionConfig>) =>
      merge(PermissionConfig.parse({}), config)

    test('accepts valid permission config', () => {
      const config = {
        edit: 'ask' as const,
        bash: 'allow' as const,
        webfetch: 'deny' as const,
      }
      expect(PermissionConfig.parse(config)).toEqual(withDefaults(config))
    })

    test('accepts bash as object with patterns', () => {
      const config = {
        bash: {
          'git *': 'allow' as const,
          'rm *': 'deny' as const,
        },
      }
      expect(PermissionConfig.parse(config)).toEqual(config)
    })

    test('rejects invalid permission values', () => {
      expect(() => PermissionConfig.parse({ edit: 'invalid' })).toThrow()
    })

    test('rejects extra fields (strict mode)', () => {
      expect(() =>
        PermissionConfig.parse({
          edit: 'ask',
          unknown_field: 'value',
        }),
      ).toThrow()
    })
  })

  describe('AgentConfig', () => {
    const withDefaults = (config: Partial<AgentConfig>) => merge(AgentConfig.parse({}), config)

    test('accepts minimal agent config', () => {
      const config = {}
      expect(AgentConfig.parse(config)).toEqual(withDefaults(config))
    })

    test('accepts full agent config', () => {
      const config = {
        model: 'anthropic/claude-sonnet-4-20250514',
        temperature: 0.7,
        top_p: 0.9,
        prompt: 'You are a helpful assistant.',
        tools: { read: true, edit: false },
        disable: false,
        description: 'Test agent',
        mode: 'subagent' as const,
        color: '#FF5733',
        maxSteps: 10,
        permission: { edit: 'ask' as const },
      }
      expect(AgentConfig.parse(config)).toEqual(withDefaults(config))
    })

    test('validates color format', () => {
      expect(AgentConfig.parse({ color: '#AABBCC' })).toEqual(withDefaults({ color: '#AABBCC' }))
      expect(() => AgentConfig.parse({ color: 'red' })).toThrow()
      expect(() => AgentConfig.parse({ color: '#GGG' })).toThrow()
    })

    test('validates temperature range', () => {
      expect(AgentConfig.parse({ temperature: 0 })).toEqual(withDefaults({ temperature: 0 }))
      expect(AgentConfig.parse({ temperature: 2 })).toEqual(withDefaults({ temperature: 2 }))
      expect(() => AgentConfig.parse({ temperature: -1 })).toThrow()
      expect(() => AgentConfig.parse({ temperature: 3 })).toThrow()
    })

    test('allows pass-through provider options (loose mode)', () => {
      // AgentConfig uses looseObject to allow provider-specific options
      // like reasoningEffort, textVerbosity, etc. to pass through to the SDK
      const config = {
        model: 'openai/o1',
        reasoningEffort: 'high',
        customProviderOption: 'value',
      }
      const result = AgentConfig.parse(config)
      expect(result).toEqual(withDefaults(config))
      expect(result.reasoningEffort).toBe('high')
      expect(result.customProviderOption).toBe('value')
    })

    test('accepts supervised flag', () => {
      expect(AgentConfig.parse({ supervised: true })).toEqual(withDefaults({ supervised: true }))
      expect(AgentConfig.parse({ supervised: false })).toEqual(withDefaults({ supervised: false }))
    })

    test('allows supervised to be undefined (optional)', () => {
      const config = { model: 'some-model' }
      const result = AgentConfig.parse(config)
      expect(result.supervised).toBeUndefined()
    })

    test('accepts messageTypes array', () => {
      const result = AgentConfig.parse({ messageTypes: ['answer', 'failure'] })
      expect(result.messageTypes).toEqual(['answer', 'failure'])
    })

    test('accepts empty messageTypes array', () => {
      const result = AgentConfig.parse({ messageTypes: [] })
      expect(result.messageTypes).toEqual([])
    })

    test('rejects invalid messageTypes values', () => {
      expect(() => AgentConfig.parse({ messageTypes: ['invalid'] })).toThrow()
      expect(() => AgentConfig.parse({ messageTypes: ['result'] })).toThrow()
    })

    test('accepts specialist boolean', () => {
      expect(AgentConfig.parse({ specialist: true })).toEqual(withDefaults({ specialist: true }))
      expect(AgentConfig.parse({ specialist: false })).toEqual(withDefaults({ specialist: false }))
    })

    test('allows specialist to be undefined (optional)', () => {
      const config = { model: 'some-model' }
      const result = AgentConfig.parse(config)
      expect(result.specialist).toBeUndefined()
    })

    test('accepts enabled boolean', () => {
      expect(AgentConfig.parse({ enabled: true })).toEqual(withDefaults({ enabled: true }))
      expect(AgentConfig.parse({ enabled: false })).toEqual(withDefaults({ enabled: false }))
    })

    test('allows enabled to be undefined (optional)', () => {
      const config = { model: 'some-model' }
      const result = AgentConfig.parse(config)
      expect(result.enabled).toBeUndefined()
    })
  })

  describe('OrcaSettings', () => {
    const defaults = OrcaSettings.parse({})

    test('accepts valid settings and provides defaults', () => {
      const settings = {
        defaultSupervised: true,
        defaultModel: 'anthropic/claude-sonnet-4-20250514',
      }
      expect(OrcaSettings.parse(settings)).toEqual({ ...defaults, ...settings })
    })

    test('accepts empty settings', () => {
      expect(OrcaSettings.parse({})).toEqual(defaults)
    })

    test('rejects extra fields (strict mode)', () => {
      expect(() =>
        OrcaSettings.parse({
          defaultSupervised: true,
          unknown: 'value',
        }),
      ).toThrow()
    })

    test('accepts validation settings', () => {
      const settings = {
        validation: {
          maxRetries: 5,
          wrapPlainText: false,
        },
      }
      expect(OrcaSettings.parse(settings)).toEqual({ ...defaults, ...settings })
    })

    test('validates maxRetries range (0-10)', () => {
      expect(() => OrcaSettings.parse({ validation: { maxRetries: -1 } })).toThrow()
      expect(() => OrcaSettings.parse({ validation: { maxRetries: 11 } })).toThrow()
      expect(OrcaSettings.parse({ validation: { maxRetries: 0 } })).toEqual({
        ...defaults,
        validation: { maxRetries: 0 },
      })
      expect(OrcaSettings.parse({ validation: { maxRetries: 10 } })).toEqual({
        ...defaults,
        validation: { maxRetries: 10 },
      })
    })

    test('rejects extra fields in validation (strict mode)', () => {
      expect(() =>
        OrcaSettings.parse({
          ...defaults,
          validation: { maxRetries: 3, unknownField: 'value' },
        }),
      ).toThrow()
    })

    test('accepts defaultSupervised boolean', () => {
      expect(OrcaSettings.parse({ defaultSupervised: true })).toEqual({
        ...defaults,
        defaultSupervised: true,
      })
      expect(OrcaSettings.parse({ defaultSupervised: false })).toEqual({
        ...defaults,
        defaultSupervised: false,
      })
    })

    test('rejects old autonomy field', () => {
      expect(() => OrcaSettings.parse({ autonomy: 'supervised' })).toThrow()
    })
  })

  describe('OrcaUserConfig', () => {
    const withDefaults = (config: Partial<OrcaUserConfig>) =>
      merge(OrcaUserConfig.parse({}), config)

    test('accepts minimal config (empty object)', () => {
      expect(OrcaUserConfig.parse({})).toMatchInlineSnapshot(`
        {
          "agents": {},
          "settings": {
            "updateNotifier": true,
          },
        }
      `)
    })

    test('accepts full config with overrides and custom agents', () => {
      const config = {
        agents: {
          // Override default agent
          coder: AgentConfig.parse({
            model: 'openai/gpt-4o',
            temperature: 0.5,
          }),
          // Add custom agent
          'my-specialist': AgentConfig.parse({
            mode: 'subagent' as const,
            description: 'My custom specialist',
            prompt: 'You are a custom specialist.',
          }),
        },
        settings: {
          defaultSupervised: false,
          defaultModel: 'anthropic/claude-sonnet-4-20250514',
        },
      }
      expect(OrcaUserConfig.parse(config)).toEqual(withDefaults(config))
    })

    test('accepts config with only agents', () => {
      const config = {
        agents: {
          orca: AgentConfig.parse({ model: 'openai/gpt-4o' }),
        },
      }
      expect(OrcaUserConfig.parse(config)).toEqual(withDefaults(config))
    })

    test('accepts config with only settings', () => {
      const config = {
        settings: { defaultSupervised: true },
      }
      expect(OrcaUserConfig.parse(config)).toEqual(withDefaults(config))
    })

    test('accepts disabled agents', () => {
      const config = {
        agents: {
          architect: AgentConfig.parse({ disable: true }),
        },
      }
      expect(OrcaUserConfig.parse(config)).toEqual(withDefaults(config))
    })

    test('rejects extra fields at top level (strict mode)', () => {
      expect(() =>
        OrcaUserConfig.parse({
          agents: {},
          unknown_field: 'value',
        }),
      ).toThrow()
    })
  })
})
