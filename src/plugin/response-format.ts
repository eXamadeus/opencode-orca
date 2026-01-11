import type { MessageEnvelope } from '../schemas/messages'
import type { ResponseType } from './config'

/**
 * Type-safe response examples for each response type.
 * TypeScript ensures these stay in sync with the message schemas.
 */
type ResponseExamples = {
  [responseType in ResponseType]: Extract<MessageEnvelope, { type: responseType }>
}

/**
 * Create type-safe example messages for all response types.
 * These are used to generate prompt documentation for agents.
 *
 * @param agentId - The agent identifier to use in examples
 * @returns Object with example messages for each response type
 */
export function createResponseExamples(agentId: string): ResponseExamples {
  return {
    answer: {
      type: 'answer',
      timestamp: '2024-01-15T10:30:00.000Z',
      agent_id: agentId,
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

    success: {
      type: 'success',
      timestamp: '2024-01-15T10:30:00.000Z',
      agent_id: agentId,
      summary: 'Implemented the user authentication flow',
      artifacts: ['src/auth/login.ts', 'src/auth/middleware.ts'],
      verification: ['All tests passing', 'Lint clean'],
      notes: ['Added bcrypt dependency for password hashing'],
    },

    plan: {
      type: 'plan',
      timestamp: '2024-01-15T10:30:00.000Z',
      agent_id: agentId,
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
      timestamp: '2024-01-15T10:30:00.000Z',
      agent_id: agentId,
      question: 'Should the API return paginated results or the full list?',
      options: ['Paginated (recommended for large datasets)', 'Full list'],
      blocking: true,
    },

    failure: {
      type: 'failure',
      timestamp: '2024-01-15T10:30:00.000Z',
      code: 'AGENT_ERROR',
      message: 'Unable to complete the task due to...',
      cause: 'Missing required configuration...',
    },
  }
}

/**
 * One-line guidance for when to use each response type.
 */
export const TYPE_GUIDANCE: Record<ResponseType, string> = {
  answer: 'Use when providing information, completing analysis, or returning results.',
  success: 'Use when a task has been completed successfully with details of what was done.',
  plan: 'Use when proposing a multi-step execution plan that requires approval.',
  question: 'Use when you need clarification or user input to proceed.',
  failure: 'Use when the task cannot be completed due to an error or blocker.',
}

export const RESPONSE_FORMAT_INJECTION_HEADER = '## Response Format (REQUIRED)'

/**
 * Generate response format instructions for an agent prompt.
 *
 * @param agentId - The agent identifier to inject into examples
 * @param responseTypes - The response types this agent is allowed to produce
 * @returns Formatted markdown instructions, or empty string if no response types
 */
export function generateResponseFormatInstructions(
  agentId: string,
  responseTypes: ResponseType[],
): string {
  if (responseTypes.length === 0) {
    return ''
  }

  const typeList = responseTypes.map((t) => `\`${t}\``).join(', ')
  const guidanceLines = responseTypes.map((t) => `- **${t}**: ${TYPE_GUIDANCE[t]}`).join('\n')
  const allExamples = createResponseExamples(agentId)

  const examples = responseTypes
    .map((t) => {
      const example = JSON.stringify(allExamples[t], null, 2)
      return `### ${t}\n\`\`\`json\n${example}\n\`\`\``
    })
    .join('\n\n')

  return [
    RESPONSE_FORMAT_INJECTION_HEADER,
    'You MUST respond with a valid JSON message envelope.',
    `**Allowed response types:** ${typeList}`,
    '### Type Selection Guidance',
    guidanceLines,
    '### JSON Examples',
    examples,
  ].join('\n\n')
}
