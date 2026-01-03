import { describe, expect, test } from 'bun:test'
import type { TaskMessage } from '../schemas/messages'
import {
  type ActionClassification,
  type AutonomyConfig,
  DEFAULT_AUTONOMY_CONFIG,
  DEFAULT_AUTONOMY_LEVEL,
  type GateDecision,
  classifyAction,
  determineGate,
  resolveAutonomyConfig,
  resolveAutonomyLevel,
} from './autonomy'
import type { AgentConfig, AutonomyLevel, OrcaSettings } from './config'

/**
 * Create a valid TaskMessage for testing
 */
function createTaskMessage(agentId: string, prompt: string): TaskMessage {
  return {
    type: 'task',
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    timestamp: '2024-01-01T00:00:00.000Z',
    payload: {
      agent_id: agentId,
      prompt,
    },
  }
}

const testAgents: Record<string, AgentConfig> = {
  researcher: { mode: 'subagent', description: 'Researches things' },
  coder: { mode: 'subagent', description: 'Codes things' },
  reviewer: { mode: 'subagent', description: 'Reviews things' },
  tester: { mode: 'subagent', description: 'Tests things' },
  'document-writer': { mode: 'subagent', description: 'Writes docs' },
  strategist: { mode: 'subagent', description: 'Plans things' },
  'custom-agent': { mode: 'subagent', description: 'Custom agent' },
}

describe('resolveAutonomyLevel', () => {
  test('returns default level when no settings provided', () => {
    expect(resolveAutonomyLevel()).toBe(DEFAULT_AUTONOMY_LEVEL)
    expect(resolveAutonomyLevel(undefined)).toBe(DEFAULT_AUTONOMY_LEVEL)
  })

  test('returns default level when settings have no autonomy', () => {
    const settings: OrcaSettings = {}
    expect(resolveAutonomyLevel(settings)).toBe(DEFAULT_AUTONOMY_LEVEL)
  })

  test('returns configured autonomy level', () => {
    expect(resolveAutonomyLevel({ autonomy: 'supervised' })).toBe('supervised')
    expect(resolveAutonomyLevel({ autonomy: 'assisted' })).toBe('assisted')
    expect(resolveAutonomyLevel({ autonomy: 'autonomous' })).toBe('autonomous')
  })
})

describe('resolveAutonomyConfig', () => {
  test('returns default config when no settings provided', () => {
    const config = resolveAutonomyConfig()
    expect(config.level).toBe(DEFAULT_AUTONOMY_LEVEL)
    expect(config.maxRetries).toBe(DEFAULT_AUTONOMY_CONFIG.maxRetries)
  })

  test('returns configured autonomy level with default retries', () => {
    const config = resolveAutonomyConfig({ autonomy: 'autonomous' })
    expect(config.level).toBe('autonomous')
    expect(config.maxRetries).toBe(DEFAULT_AUTONOMY_CONFIG.maxRetries)
  })
})

describe('classifyAction', () => {
  describe('agent-based classification', () => {
    test('classifies researcher as routine', () => {
      const task = createTaskMessage('researcher', 'Find information about X')
      expect(classifyAction(task, testAgents)).toBe('routine')
    })

    test('classifies reviewer as routine', () => {
      const task = createTaskMessage('reviewer', 'Review this code')
      expect(classifyAction(task, testAgents)).toBe('routine')
    })

    test('classifies coder as significant', () => {
      const task = createTaskMessage('coder', 'Do something')
      expect(classifyAction(task, testAgents)).toBe('significant')
    })

    test('classifies tester as significant', () => {
      const task = createTaskMessage('tester', 'Run tests')
      expect(classifyAction(task, testAgents)).toBe('significant')
    })

    test('classifies document-writer as significant', () => {
      const task = createTaskMessage('document-writer', 'Write docs')
      expect(classifyAction(task, testAgents)).toBe('significant')
    })

    test('classifies strategist as significant', () => {
      const task = createTaskMessage('strategist', 'Plan something')
      expect(classifyAction(task, testAgents)).toBe('significant')
    })

    test('classifies unknown agent as routine by default', () => {
      const task = createTaskMessage('custom-agent', 'Do something generic')
      expect(classifyAction(task, testAgents)).toBe('routine')
    })
  })

  describe('pattern-based classification (dangerous)', () => {
    test('detects delete pattern as dangerous', () => {
      const task = createTaskMessage('researcher', 'Delete all the old files')
      expect(classifyAction(task, testAgents)).toBe('dangerous')
    })

    test('detects drop pattern as dangerous', () => {
      const task = createTaskMessage('coder', 'Drop the database table')
      expect(classifyAction(task, testAgents)).toBe('dangerous')
    })

    test('detects remove all pattern as dangerous', () => {
      const task = createTaskMessage('coder', 'Remove all test data')
      expect(classifyAction(task, testAgents)).toBe('dangerous')
    })

    test('detects truncate pattern as dangerous', () => {
      const task = createTaskMessage('coder', 'Truncate the logs table')
      expect(classifyAction(task, testAgents)).toBe('dangerous')
    })

    test('detects wipe pattern as dangerous', () => {
      const task = createTaskMessage('coder', 'Wipe the cache')
      expect(classifyAction(task, testAgents)).toBe('dangerous')
    })

    test('detects destroy pattern as dangerous', () => {
      const task = createTaskMessage('coder', 'Destroy the old resources')
      expect(classifyAction(task, testAgents)).toBe('dangerous')
    })

    test('detects rm -rf pattern as dangerous', () => {
      const task = createTaskMessage('coder', 'Run rm -rf on temp folder')
      expect(classifyAction(task, testAgents)).toBe('dangerous')
    })

    test('detects force push pattern as dangerous', () => {
      const task = createTaskMessage('coder', 'Force push to main branch')
      expect(classifyAction(task, testAgents)).toBe('dangerous')
    })

    test('detects --force flag as dangerous', () => {
      const task = createTaskMessage('coder', 'Run git push --force')
      expect(classifyAction(task, testAgents)).toBe('dangerous')
    })

    test('detects reset --hard pattern as dangerous', () => {
      const task = createTaskMessage('coder', 'Do git reset --hard HEAD~5')
      expect(classifyAction(task, testAgents)).toBe('dangerous')
    })
  })

  describe('pattern-based classification (significant)', () => {
    test('detects modify pattern as significant for routine agent', () => {
      const task = createTaskMessage('researcher', 'Modify the configuration')
      expect(classifyAction(task, testAgents)).toBe('significant')
    })

    test('detects update pattern as significant for routine agent', () => {
      const task = createTaskMessage('reviewer', 'Update the documentation')
      expect(classifyAction(task, testAgents)).toBe('significant')
    })

    test('detects create pattern as significant for routine agent', () => {
      const task = createTaskMessage('researcher', 'Create a new file')
      expect(classifyAction(task, testAgents)).toBe('significant')
    })

    test('detects implement pattern as significant for routine agent', () => {
      const task = createTaskMessage('reviewer', 'Implement the feature')
      expect(classifyAction(task, testAgents)).toBe('significant')
    })

    test('detects refactor pattern as significant for routine agent', () => {
      const task = createTaskMessage('researcher', 'Refactor the module')
      expect(classifyAction(task, testAgents)).toBe('significant')
    })

    test('detects deploy pattern as significant for routine agent', () => {
      const task = createTaskMessage('researcher', 'Deploy to production')
      expect(classifyAction(task, testAgents)).toBe('significant')
    })

    test('detects install pattern as significant for routine agent', () => {
      const task = createTaskMessage('researcher', 'Install new dependencies')
      expect(classifyAction(task, testAgents)).toBe('significant')
    })

    test('detects migration pattern as significant for routine agent', () => {
      const task = createTaskMessage('researcher', 'Run database migrations')
      expect(classifyAction(task, testAgents)).toBe('significant')
    })
  })

  describe('priority ordering', () => {
    test('dangerous patterns override agent classification', () => {
      // Even for researcher (normally routine), dangerous pattern wins
      const task = createTaskMessage('researcher', 'Delete all files')
      expect(classifyAction(task, testAgents)).toBe('dangerous')
    })

    test('dangerous patterns override significant patterns', () => {
      // "update" is significant, but "delete" is dangerous
      const task = createTaskMessage('coder', 'Delete and update the files')
      expect(classifyAction(task, testAgents)).toBe('dangerous')
    })
  })
})

describe('determineGate', () => {
  describe('supervised mode', () => {
    const level: AutonomyLevel = 'supervised'

    test('requires approval for routine actions', () => {
      expect(determineGate(level, 'routine')).toBe('require_approval')
    })

    test('requires approval for significant actions', () => {
      expect(determineGate(level, 'significant')).toBe('require_approval')
    })

    test('blocks dangerous actions', () => {
      expect(determineGate(level, 'dangerous')).toBe('block')
    })
  })

  describe('assisted mode', () => {
    const level: AutonomyLevel = 'assisted'

    test('proceeds with routine actions', () => {
      expect(determineGate(level, 'routine')).toBe('proceed')
    })

    test('requires approval for significant actions', () => {
      expect(determineGate(level, 'significant')).toBe('require_approval')
    })

    test('blocks dangerous actions', () => {
      expect(determineGate(level, 'dangerous')).toBe('block')
    })
  })

  describe('autonomous mode', () => {
    const level: AutonomyLevel = 'autonomous'

    test('proceeds with routine actions', () => {
      expect(determineGate(level, 'routine')).toBe('proceed')
    })

    test('proceeds with significant actions', () => {
      expect(determineGate(level, 'significant')).toBe('proceed')
    })

    test('requires approval for dangerous actions', () => {
      expect(determineGate(level, 'dangerous')).toBe('require_approval')
    })
  })
})
