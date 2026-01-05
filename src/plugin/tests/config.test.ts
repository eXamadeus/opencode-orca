import { describe, expect, test } from 'bun:test'
import {
  AgentConfigSchema,
  OrcaSettingsSchema,
  OrcaUserConfigSchema,
  PermissionConfigSchema,
  ResponseTypeSchema,
} from '../config'

describe('config schemas', () => {
  describe('PermissionConfigSchema', () => {
    test('accepts valid permission config', () => {
      const config = {
        edit: 'ask' as const,
        bash: 'allow' as const,
        webfetch: 'deny' as const,
      }
      expect(PermissionConfigSchema.parse(config)).toEqual(config)
    })

    test('accepts bash as object with patterns', () => {
      const config = {
        bash: {
          'git *': 'allow' as const,
          'rm *': 'deny' as const,
        },
      }
      expect(PermissionConfigSchema.parse(config)).toEqual(config)
    })

    test('rejects invalid permission values', () => {
      expect(() => PermissionConfigSchema.parse({ edit: 'invalid' })).toThrow()
    })

    test('rejects extra fields (strict mode)', () => {
      expect(() =>
        PermissionConfigSchema.parse({
          edit: 'ask',
          unknown_field: 'value',
        }),
      ).toThrow()
    })
  })

  describe('AgentConfigSchema', () => {
    test('accepts minimal agent config', () => {
      const config = {}
      expect(AgentConfigSchema.parse(config)).toEqual(config)
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
      expect(AgentConfigSchema.parse(config)).toEqual(config)
    })

    test('validates color format', () => {
      expect(AgentConfigSchema.parse({ color: '#AABBCC' })).toEqual({ color: '#AABBCC' })
      expect(() => AgentConfigSchema.parse({ color: 'red' })).toThrow()
      expect(() => AgentConfigSchema.parse({ color: '#GGG' })).toThrow()
    })

    test('validates temperature range', () => {
      expect(AgentConfigSchema.parse({ temperature: 0 })).toEqual({ temperature: 0 })
      expect(AgentConfigSchema.parse({ temperature: 2 })).toEqual({ temperature: 2 })
      expect(() => AgentConfigSchema.parse({ temperature: -1 })).toThrow()
      expect(() => AgentConfigSchema.parse({ temperature: 3 })).toThrow()
    })

    test('allows pass-through provider options (loose mode)', () => {
      // AgentConfigSchema uses looseObject to allow provider-specific options
      // like reasoningEffort, textVerbosity, etc. to pass through to the SDK
      const config = {
        model: 'openai/o1',
        reasoningEffort: 'high',
        customProviderOption: 'value',
      }
      const result = AgentConfigSchema.parse(config)
      expect(result).toEqual(config)
      expect(result.reasoningEffort).toBe('high')
      expect(result.customProviderOption).toBe('value')
    })

    test('accepts supervised flag', () => {
      expect(AgentConfigSchema.parse({ supervised: true })).toEqual({ supervised: true })
      expect(AgentConfigSchema.parse({ supervised: false })).toEqual({ supervised: false })
    })

    test('allows supervised to be undefined (optional)', () => {
      const config = { model: 'some-model' }
      const result = AgentConfigSchema.parse(config)
      expect(result.supervised).toBeUndefined()
    })

    test('accepts responseTypes array', () => {
      const result = AgentConfigSchema.parse({ responseTypes: ['answer', 'failure'] })
      expect(result.responseTypes).toEqual(['answer', 'failure'])
    })

    test('accepts empty responseTypes array', () => {
      const result = AgentConfigSchema.parse({ responseTypes: [] })
      expect(result.responseTypes).toEqual([])
    })

    test('rejects invalid responseTypes values', () => {
      expect(() => AgentConfigSchema.parse({ responseTypes: ['invalid'] })).toThrow()
      expect(() => AgentConfigSchema.parse({ responseTypes: ['result'] })).toThrow()
    })
  })

  describe('ResponseTypeSchema', () => {
    test('accepts valid response types', () => {
      expect(ResponseTypeSchema.parse('answer')).toBe('answer')
      expect(ResponseTypeSchema.parse('plan')).toBe('plan')
      expect(ResponseTypeSchema.parse('question')).toBe('question')
      expect(ResponseTypeSchema.parse('escalation')).toBe('escalation')
      expect(ResponseTypeSchema.parse('failure')).toBe('failure')
    })

    test('rejects invalid response types', () => {
      expect(() => ResponseTypeSchema.parse('result')).toThrow()
      expect(() => ResponseTypeSchema.parse('invalid')).toThrow()
    })
  })

  describe('OrcaSettingsSchema', () => {
    test('accepts valid settings', () => {
      const settings = {
        defaultSupervised: true,
        defaultModel: 'anthropic/claude-sonnet-4-20250514',
      }
      expect(OrcaSettingsSchema.parse(settings)).toEqual(settings)
    })

    test('accepts empty settings', () => {
      expect(OrcaSettingsSchema.parse({})).toEqual({})
    })

    test('rejects extra fields (strict mode)', () => {
      expect(() =>
        OrcaSettingsSchema.parse({
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
      expect(OrcaSettingsSchema.parse(settings)).toEqual(settings)
    })

    test('validates maxRetries range (0-10)', () => {
      expect(() => OrcaSettingsSchema.parse({ validation: { maxRetries: -1 } })).toThrow()
      expect(() => OrcaSettingsSchema.parse({ validation: { maxRetries: 11 } })).toThrow()
      expect(OrcaSettingsSchema.parse({ validation: { maxRetries: 0 } })).toEqual({
        validation: { maxRetries: 0 },
      })
      expect(OrcaSettingsSchema.parse({ validation: { maxRetries: 10 } })).toEqual({
        validation: { maxRetries: 10 },
      })
    })

    test('rejects extra fields in validation (strict mode)', () => {
      expect(() =>
        OrcaSettingsSchema.parse({
          validation: { maxRetries: 3, unknownField: 'value' },
        }),
      ).toThrow()
    })

    test('accepts defaultSupervised boolean', () => {
      expect(OrcaSettingsSchema.parse({ defaultSupervised: true })).toEqual({
        defaultSupervised: true,
      })
      expect(OrcaSettingsSchema.parse({ defaultSupervised: false })).toEqual({
        defaultSupervised: false,
      })
    })

    test('rejects old autonomy field', () => {
      expect(() => OrcaSettingsSchema.parse({ autonomy: 'supervised' })).toThrow()
    })
  })

  describe('OrcaUserConfigSchema', () => {
    test('accepts minimal config (empty object)', () => {
      expect(OrcaUserConfigSchema.parse({})).toEqual({})
    })

    test('accepts full config with overrides and custom agents', () => {
      const config = {
        agents: {
          // Override default agent
          coder: {
            model: 'openai/gpt-4o',
            temperature: 0.5,
          },
          // Add custom agent
          'my-specialist': {
            mode: 'subagent' as const,
            description: 'My custom specialist',
            prompt: 'You are a custom specialist.',
          },
        },
        settings: {
          defaultSupervised: false,
          defaultModel: 'anthropic/claude-sonnet-4-20250514',
        },
      }
      expect(OrcaUserConfigSchema.parse(config)).toEqual(config)
    })

    test('accepts config with only agents', () => {
      const config = {
        agents: {
          orca: { model: 'openai/gpt-4o' },
        },
      }
      expect(OrcaUserConfigSchema.parse(config)).toEqual(config)
    })

    test('accepts config with only settings', () => {
      const config = {
        settings: { defaultSupervised: true },
      }
      expect(OrcaUserConfigSchema.parse(config)).toEqual(config)
    })

    test('accepts disabled agents', () => {
      const config = {
        agents: {
          architect: { disable: true },
        },
      }
      expect(OrcaUserConfigSchema.parse(config)).toEqual(config)
    })

    test('rejects extra fields at top level (strict mode)', () => {
      expect(() =>
        OrcaUserConfigSchema.parse({
          agents: {},
          unknown_field: 'value',
        }),
      ).toThrow()
    })
  })
})
