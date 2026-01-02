import { describe, expect, test } from 'bun:test'
import {
  AgentConfigSchema,
  OrcaSettingsSchema,
  OrcaUserConfigSchema,
  PermissionConfigSchema,
} from './config'

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

    test('rejects extra fields (strict mode)', () => {
      expect(() =>
        AgentConfigSchema.parse({
          model: 'test',
          unknown_field: 'value',
        }),
      ).toThrow()
    })
  })

  describe('OrcaSettingsSchema', () => {
    test('accepts valid settings', () => {
      const settings = {
        autonomy: 'assisted' as const,
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
          autonomy: 'supervised',
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
          autonomy: 'assisted' as const,
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
        settings: { autonomy: 'supervised' as const },
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
