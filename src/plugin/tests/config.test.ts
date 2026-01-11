import { describe, expect, test } from 'bun:test'
import { merge } from 'lodash'
import { MessageEnvelope } from '../../schemas/messages'
import {
  AgentConfig,
  OrcaSettings,
  OrcaUserConfig,
  PermissionConfig,
  ResponseType,
} from '../config'

describe('config', () => {
  describe('PermissionConfig', () => {
    test('accepts valid permission config', () => {
      const config = {
        edit: 'ask' as const,
        bash: 'allow' as const,
        webfetch: 'deny' as const,
      }
      expect(PermissionConfig.parse(config)).toEqual(config)
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
    test('accepts minimal agent config', () => {
      const config = {}
      expect(AgentConfig.parse(config)).toEqual(config)
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
      expect(AgentConfig.parse(config)).toEqual(config)
    })

    test('validates color format', () => {
      expect(AgentConfig.parse({ color: '#AABBCC' })).toEqual({ color: '#AABBCC' })
      expect(() => AgentConfig.parse({ color: 'red' })).toThrow()
      expect(() => AgentConfig.parse({ color: '#GGG' })).toThrow()
    })

    test('validates temperature range', () => {
      expect(AgentConfig.parse({ temperature: 0 })).toEqual({ temperature: 0 })
      expect(AgentConfig.parse({ temperature: 2 })).toEqual({ temperature: 2 })
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
      expect(result).toEqual(config)
      expect(result.reasoningEffort).toBe('high')
      expect(result.customProviderOption).toBe('value')
    })

    test('accepts supervised flag', () => {
      expect(AgentConfig.parse({ supervised: true })).toEqual({ supervised: true })
      expect(AgentConfig.parse({ supervised: false })).toEqual({ supervised: false })
    })

    test('allows supervised to be undefined (optional)', () => {
      const config = { model: 'some-model' }
      const result = AgentConfig.parse(config)
      expect(result.supervised).toBeUndefined()
    })

    test('accepts responseTypes array', () => {
      const result = AgentConfig.parse({ responseTypes: ['answer', 'failure'] })
      expect(result.responseTypes).toEqual(['answer', 'failure'])
    })

    test('accepts empty responseTypes array', () => {
      const result = AgentConfig.parse({ responseTypes: [] })
      expect(result.responseTypes).toEqual([])
    })

    test('rejects invalid responseTypes values', () => {
      expect(() => AgentConfig.parse({ responseTypes: ['invalid'] })).toThrow()
      expect(() => AgentConfig.parse({ responseTypes: ['result'] })).toThrow()
    })

    test('accepts specialist boolean', () => {
      expect(AgentConfig.parse({ specialist: true })).toEqual({ specialist: true })
      expect(AgentConfig.parse({ specialist: false })).toEqual({ specialist: false })
    })

    test('allows specialist to be undefined (optional)', () => {
      const config = { model: 'some-model' }
      const result = AgentConfig.parse(config)
      expect(result.specialist).toBeUndefined()
    })

    test('accepts enabled boolean', () => {
      expect(AgentConfig.parse({ enabled: true })).toEqual({ enabled: true })
      expect(AgentConfig.parse({ enabled: false })).toEqual({ enabled: false })
    })

    test('allows enabled to be undefined (optional)', () => {
      const config = { model: 'some-model' }
      const result = AgentConfig.parse(config)
      expect(result.enabled).toBeUndefined()
    })
  })

  describe('ResponseType', () => {
    test('accepts valid response types', () => {
      expect(ResponseType.parse('answer')).toBe('answer')
      expect(ResponseType.parse('plan')).toBe('plan')
      expect(ResponseType.parse('question')).toBe('question')
      expect(ResponseType.parse('failure')).toBe('failure')
      expect(ResponseType.parse('success')).toBe('success')
    })

    test('rejects invalid response types', () => {
      expect(() => ResponseType.parse('result')).toThrow()
      expect(() => ResponseType.parse('invalid')).toThrow()
    })

    test('every ResponseType is a valid MessageType (sync check)', () => {
      // Get all valid message types from the discriminated union
      // Each option has a literal 'type' field with a .value property
      const messageTypes = new Set(MessageEnvelope.options.map((schema) => schema.shape.type.value))

      // Get all response types from the enum (.options is the public API)
      const responseTypes = ResponseType.options

      // Every response type must be a valid message type
      // (ResponseType is intentionally a subset - excludes task, checkpoint, interrupt)
      for (const responseType of responseTypes) {
        expect(messageTypes.has(responseType)).toBe(true)
      }
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
      expect(OrcaUserConfig.parse(config)).toEqual(withDefaults(config))
    })

    test('accepts config with only agents', () => {
      const config = {
        agents: {
          orca: { model: 'openai/gpt-4o' },
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
          architect: { disable: true },
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
