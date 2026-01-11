import type { Message, MessageType } from '../schemas/messages'
import type { AgentConfig } from './config'

/**
 * Type-safe response examples for each response type.
 * TypeScript ensures these stay in sync with the message schemas.
 */
type ResponseExamples = {
  [responseType in MessageType]: Extract<Message, { type: responseType }>
}

export const responseReciprocal: { [message in MessageType]: MessageType[] } = {
  question: ['answer'],
  task: ['success', 'failure', 'checkpoint'],
  answer: [],
  plan: [],
  checkpoint: [],
  failure: [],
  success: [],
  interrupt: [],
}

export const RESPONSE_EXAMPLES: ResponseExamples = {
  answer: {
    type: 'answer',
    content: 'The implementation uses...',
    sources: [
      {
        type: 'file',
        ref: 'src/index.ts',
        title: 'Main entry',
        excerpt: 'export function...',
      },
    ],
  },

  checkpoint: {
    type: 'checkpoint',
    prompt: 'The agent is requesting to ... Continue?',
  },

  failure: {
    type: 'failure',
    code: 'AGENT_ERROR',
    message: 'Unable to complete the task due to...',
    cause: 'Missing required configuration...',
  },

  interrupt: {
    type: 'interrupt',
    reason: 'This requires manual intervention!',
  },

  plan: {
    type: 'plan',
    goal: 'Implement feature X with tests',
    steps: [
      { description: 'Create the data model in src/models/...' },
      { description: 'Add validation logic...', command: 'coder' },
      { description: 'Write unit tests...', command: 'tester' },
    ],
    assumptions: ['Using existing auth middleware', 'PostgreSQL database'],
    files_touched: ['src/models/user.ts', 'src/services/auth.ts'],
    verification: [
      'Run test suite: bun test',
      'Verify API responds correctly: curl localhost:3000/api/feature',
    ],
    risks: [
      'Migration may fail on production data - test with staging first',
      'Rollback: revert migration and redeploy previous version',
    ],
  },

  question: {
    type: 'question',
    question: 'Should the API return paginated results or the full list?',
    options: ['Paginated (recommended for large datasets)', 'Full list'],
    blocking: true,
  },

  success: {
    type: 'success',
    summary: 'This task was completed successfully!',
    artifacts: ['src/auth/login.ts', 'docs/auth/login.md'],
    verification: ['All tests passing', 'Lint clean'],
    notes: ['There are markdown table inconsistencies'],
  },

  task: {
    type: 'task',
    prompt: 'Continue with step 2 and implement the user login flow...',
    plan_context: {
      goal: 'Implement user authentication flow',
      step_index: 2,
      approved_remaining: false,
    },
  },
}

/**
 * One-line guidance for when to use each response type.
 */
export const TYPE_GUIDANCE: Record<MessageType, string> = {
  answer: 'Use when providing information, completing analysis, or returning results.',
  checkpoint: 'Use then HITL supervision is required.',
  failure: 'Use when the task cannot be completed due to an error or blocker.',
  interrupt: 'Use when the agent requires immediate attention or intervention.',
  plan: 'Use when proposing a multi-step execution plan that requires approval.',
  question: 'Use when you need clarification or user input to proceed.',
  success: 'Use when a task has been completed successfully with details of what was done.',
  task: 'Use when the agent needs to delegate a subtask to a specialist agent.',
}

export const RESPONSE_FORMAT_INJECTION_HEADER = '## Response Format (REQUIRED)'

export const responseTypesForAgentConfig = (agentConfig: AgentConfig): MessageType[] => {
  const responseTypes: Set<MessageType> = new Set()

  for (const type of agentConfig.messageTypes ?? []) {
    const reciprocals = responseReciprocal[type]
    if (reciprocals) {
      for (const r of reciprocals) responseTypes.add(r)
    }
  }

  if (agentConfig.specialist) {
    const specialistResponseTypes: MessageType[] = ['success', 'failure', 'interrupt']
    for (const responseType of specialistResponseTypes) responseTypes.add(responseType)
  }
  if (agentConfig.supervised) responseTypes.add('checkpoint')

  return responseTypes.values().toArray()
}

/**
 * Generate response format instructions for an agent prompt.
 *
 * @param agentId - The agent identifier to inject into examples
 * @param agentConfig - The configuration for the agent to generate instructions for
 * @returns Formatted markdown instructions, or empty string if no response types
 */
export function generateResponseFormatInstructions(
  agentId: string,
  agentConfig: AgentConfig,
): string {
  if (agentId === 'orca') return ''

  const responseTypes = responseTypesForAgentConfig(agentConfig)

  if (agentId === 'planner') responseTypes.push('plan')

  const typeList = responseTypes.map((t) => `\`${t}\``).join(', ')
  const guidanceLines = responseTypes.map((t) => `- **${t}**: ${TYPE_GUIDANCE[t]}`).join('\n')

  const examples = responseTypes
    .map((t) => {
      const example = JSON.stringify(RESPONSE_EXAMPLES[t], null, 2)
      return `### ${t}\n${example}`
    })
    .join('\n\n')

  return [
    RESPONSE_FORMAT_INJECTION_HEADER,
    'You MUST respond with a valid JSON object. Nothing else.',
    `**Allowed response types:** ${typeList}`,
    '### Type Selection Guidance',
    guidanceLines,
    '### JSON Examples',
    examples,
  ].join('\n\n')
}
